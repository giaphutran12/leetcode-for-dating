import type { Attempt, PracticeActivityEntry } from "./types";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromLocalKey(value: string): Date | undefined {
  if (!LOCAL_DATE_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function addLocalDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function activityEntryFromAttempt(
  attempt: Attempt,
): PracticeActivityEntry | undefined {
  if (
    attempt.status !== "complete" ||
    !attempt.result ||
    !attempt.completedAt
  ) {
    return undefined;
  }
  const completed = new Date(attempt.completedAt);
  if (Number.isNaN(completed.getTime())) return undefined;
  const capturedLocalDate = attempt.completedLocalDate;
  return {
    attemptId: attempt.id,
    scenarioId: attempt.scenarioId,
    completedAt: completed.toISOString(),
    localDate:
      capturedLocalDate && dateFromLocalKey(capturedLocalDate)
        ? capturedLocalDate
        : localDateKey(completed),
  };
}

export function activityEntryForCompletion(
  attempt: Pick<Attempt, "id" | "scenarioId">,
  completed = new Date(),
): PracticeActivityEntry {
  return {
    attemptId: attempt.id,
    scenarioId: attempt.scenarioId,
    completedAt: completed.toISOString(),
    localDate: localDateKey(completed),
  };
}

export function mergeActivityEntries(
  ...sources: Array<readonly PracticeActivityEntry[]>
): PracticeActivityEntry[] {
  const byAttempt = new Map<string, PracticeActivityEntry>();
  for (const entries of sources) {
    for (const entry of entries) {
      if (!dateFromLocalKey(entry.localDate)) continue;
      const completedAt = new Date(entry.completedAt);
      if (Number.isNaN(completedAt.getTime())) continue;
      const current = byAttempt.get(entry.attemptId);
      if (
        !current ||
        Date.parse(entry.completedAt) > Date.parse(current.completedAt)
      ) {
        byAttempt.set(entry.attemptId, {
          ...entry,
          completedAt: completedAt.toISOString(),
        });
      }
    }
  }
  return [...byAttempt.values()].sort(
    (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt),
  );
}

export function activityFromAttempts(
  attempts: readonly Attempt[],
): PracticeActivityEntry[] {
  return mergeActivityEntries(
    attempts
      .map(activityEntryFromAttempt)
      .filter((entry): entry is PracticeActivityEntry => Boolean(entry)),
  );
}

export type ActivityDay = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  future: boolean;
};

export type ActivityWeek = {
  monthLabel?: string;
  days: ActivityDay[];
};

function intensity(count: number): ActivityDay["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function buildActivityCalendar(
  entries: readonly PracticeActivityEntry[],
  options: { today?: Date; weekCount?: number; locale?: string } = {},
): { weeks: ActivityWeek[]; total: number; startDate: string; endDate: string } {
  const today = options.today ?? new Date();
  const weekCount = Math.max(1, options.weekCount ?? 53);
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );
  const currentWeekStart = addLocalDays(end, -end.getDay());
  const start = addLocalDays(currentWeekStart, -(weekCount - 1) * 7);
  const counts = new Map<string, number>();
  for (const entry of mergeActivityEntries(entries)) {
    counts.set(entry.localDate, (counts.get(entry.localDate) ?? 0) + 1);
  }
  const dateFormatter = new Intl.DateTimeFormat(options.locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const monthFormatter = new Intl.DateTimeFormat(options.locale, {
    month: "short",
  });
  const weeks: ActivityWeek[] = [];
  let total = 0;
  let previousMonth = -1;

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekStart = addLocalDays(start, weekIndex * 7);
    const days: ActivityDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addLocalDays(weekStart, weekday);
      const key = localDateKey(date);
      const future = date > end;
      const count = future ? 0 : counts.get(key) ?? 0;
      if (!future) total += count;
      const attemptLabel =
        future
          ? "Future date"
          : count === 0
          ? "No completed practice attempts"
          : `${count} completed practice ${count === 1 ? "attempt" : "attempts"}`;
      days.push({
        date: key,
        count,
        level: intensity(count),
        label: `${dateFormatter.format(date)}: ${attemptLabel}${count > 0 ? ". Nice work." : ""}`,
        future,
      });
    }
    const month = weekStart.getMonth();
    weeks.push({
      ...(month !== previousMonth
        ? { monthLabel: monthFormatter.format(weekStart) }
        : {}),
      days,
    });
    previousMonth = month;
  }

  return {
    weeks,
    total,
    startDate: localDateKey(start),
    endDate: localDateKey(end),
  };
}
