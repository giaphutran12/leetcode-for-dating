// Structural validators for every persisted record (plan: "Persistence" —
// "Validate parsed values before use", "Reset only an invalid record"). Each
// parser returns a clean, typed value or null; null tells the store to reset
// that one record. Array records validate per item so one corrupt row is
// dropped individually rather than nuking the whole list. Pure — no I/O.

import type {
  Attempt,
  Milestone,
  MilestoneCode,
  Progress,
  UserProfile,
} from "../domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => isFiniteNumber(entry))
  );
}

const MILESTONE_CODES: readonly MilestoneCode[] = [
  "good_conversation",
  "contact_exchanged",
  "received_reply",
  "date_scheduled",
  "went_on_date",
  "second_date",
  "graceful_exit",
];

function isMilestoneCode(value: unknown): value is MilestoneCode {
  return (
    typeof value === "string" &&
    (MILESTONE_CODES as readonly string[]).includes(value)
  );
}

const ATTEMPT_STATUSES: readonly Attempt["status"][] = [
  "idle",
  "active",
  "awaiting_reply",
  "awaiting_judgment",
  "complete",
  "error",
];

export function parseProfile(raw: unknown): UserProfile | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (typeof raw.displayName !== "string") return null;
  if (!isStringArray(raw.goals)) return null;
  if (typeof raw.typeDescription !== "string") return null;
  if (typeof raw.desiredRelationship !== "string") return null;
  if (!isStringArray(raw.struggles)) return null;
  if (typeof raw.onboardingComplete !== "boolean") return null;
  return {
    version: 1,
    displayName: raw.displayName,
    goals: raw.goals,
    typeDescription: raw.typeDescription,
    desiredRelationship: raw.desiredRelationship,
    struggles: raw.struggles,
    onboardingComplete: raw.onboardingComplete,
  };
}

export function parseProgress(raw: unknown): Progress | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (!isFiniteNumber(raw.publicXP)) return null;
  if (!isFiniteNumber(raw.level)) return null;
  if (!isFiniteNumber(raw.streak)) return null;
  if (!isNumberRecord(raw.bestScores)) return null;
  if (!isNumberRecord(raw.bestMasteryXP)) return null;
  if (!isStringArray(raw.completedScenarioIds)) return null;
  if (!isStringArray(raw.achievements)) return null;
  // lastPracticeDay is an extension: accept a string, or null/missing (older
  // records) which normalize to null.
  const lastPracticeDay = raw.lastPracticeDay;
  if (
    lastPracticeDay !== undefined &&
    lastPracticeDay !== null &&
    typeof lastPracticeDay !== "string"
  ) {
    return null;
  }
  return {
    version: 1,
    publicXP: raw.publicXP,
    level: raw.level,
    streak: raw.streak,
    bestScores: raw.bestScores,
    bestMasteryXP: raw.bestMasteryXP,
    completedScenarioIds: raw.completedScenarioIds,
    achievements: raw.achievements,
    lastPracticeDay: typeof lastPracticeDay === "string" ? lastPracticeDay : null,
  };
}

export function parseMilestone(raw: unknown): Milestone | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (!isMilestoneCode(raw.code)) return null;
  if (typeof raw.recordedAt !== "string") return null;
  return { id: raw.id, code: raw.code, recordedAt: raw.recordedAt };
}

// One corrupt milestone is dropped individually; a non-array resets the record.
export function parseMilestones(raw: unknown): Milestone[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Milestone[] = [];
  for (const item of raw) {
    const milestone = parseMilestone(item);
    if (milestone !== null) out.push(milestone);
  }
  return out;
}

// Structural validation of a stored attempt. Deep transcript re-validation is
// out of scope here — the key identity/status fields are enough to keep the
// list usable; a malformed row is dropped individually.
export function parseAttempt(raw: unknown): Attempt | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (typeof raw.scenarioId !== "string") return null;
  if (!Array.isArray(raw.messages)) return null;
  if (raw.userTurn !== 0 && raw.userTurn !== 1 && raw.userTurn !== 2 && raw.userTurn !== 3) {
    return null;
  }
  if (!(ATTEMPT_STATUSES as readonly unknown[]).includes(raw.status)) return null;
  if (typeof raw.startedAt !== "string") return null;
  return raw as unknown as Attempt;
}

export function parseAttempts(raw: unknown): Attempt[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Attempt[] = [];
  for (const item of raw) {
    const attempt = parseAttempt(item);
    if (attempt !== null) out.push(attempt);
  }
  return out;
}
