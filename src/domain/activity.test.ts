import { describe, expect, it } from "vitest";
import type { Attempt, PracticeActivityEntry } from "./types";
import {
  activityFromAttempts,
  buildActivityCalendar,
  mergeActivityEntries,
} from "./activity";

function entry(
  attemptId: string,
  localDate: string,
  completedAt = `${localDate}T12:00:00.000Z`,
): PracticeActivityEntry {
  return { attemptId, scenarioId: "RC-001", localDate, completedAt };
}

describe("practice activity", () => {
  it("keeps a captured ledger date when a reconstructed attempt ties", () => {
    const captured = entry(
      "same-attempt",
      "2026-07-20",
      "2026-07-20T00:30:00.000Z",
    );
    const reconstructed = { ...captured, localDate: "2026-07-19" };

    expect(mergeActivityEntries([captured], [reconstructed])).toEqual([
      captured,
    ]);
  });

  it("counts completed attempts by captured local calendar date", () => {
    const calendar = buildActivityCalendar(
      [entry("one", "2026-07-19"), entry("two", "2026-07-19")],
      { today: new Date(2026, 6, 20, 12), weekCount: 2, locale: "en-US" },
    );
    const day = calendar.weeks.flatMap((week) => week.days).find(
      ({ date }) => date === "2026-07-19",
    );
    expect(day).toMatchObject({ count: 2, level: 2 });
    expect(day?.label).toContain("2 completed practice attempts");
    expect(day?.label).toContain("Nice work.");
    expect(calendar.total).toBe(2);
  });

  it("uses four-plus as the highest visible intensity", () => {
    const calendar = buildActivityCalendar(
      [1, 2, 3, 4, 5].map((value) => entry(String(value), "2026-07-20")),
      { today: new Date(2026, 6, 20, 12), weekCount: 1 },
    );
    expect(calendar.weeks[0].days[1]).toMatchObject({ count: 5, level: 4 });
  });

  it("merges guest and account entries by attempt id without double-counting", () => {
    const merged = mergeActivityEntries(
      [entry("shared", "2026-07-18"), entry("guest", "2026-07-19")],
      [entry("shared", "2026-07-18"), entry("remote", "2026-07-20")],
    );
    expect(merged.map(({ attemptId }) => attemptId)).toEqual([
      "shared",
      "guest",
      "remote",
    ]);
  });

  it("backfills legacy completed attempts and ignores unscored failures", () => {
    const attempts = [
      {
        id: "complete",
        scenarioId: "RC-001",
        status: "complete",
        result: {},
        completedAt: "2026-07-20T02:00:00.000Z",
      },
      {
        id: "failed",
        scenarioId: "RC-001",
        status: "error",
        completedAt: "2026-07-20T03:00:00.000Z",
      },
    ] as Attempt[];
    expect(activityFromAttempts(attempts).map(({ attemptId }) => attemptId)).toEqual([
      "complete",
    ]);
  });
});
