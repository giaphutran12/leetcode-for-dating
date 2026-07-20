import { z } from "zod";
import { defaultProfile } from "../domain/onboarding";
import { defaultMilestones, defaultProgress } from "../domain/progression";
import {
  activityFromAttempts,
  mergeActivityEntries,
} from "../domain/activity";
import type {
  Attempt,
  Milestones,
  PracticeActivityEntry,
  Progress,
  UserProfile,
} from "../domain/types";

export const STORAGE_KEYS = {
  profile: "rizzcode.v1.profile",
  progress: "rizzcode.v1.progress",
  attempts: "rizzcode.v1.attempts",
  activity: "rizzcode.v1.activity",
  milestones: "rizzcode.v1.milestones",
  owner: "rizzcode.v1.owner",
} as const;

export type LocalRecordsOwner = "guest" | string;

export function loadRecordsOwner(): LocalRecordsOwner | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.owner);
  } catch {
    return null;
  }
}

export function writeRecordsOwner(owner: LocalRecordsOwner): string | undefined {
  try {
    window.localStorage.setItem(STORAGE_KEYS.owner, owner);
    return undefined;
  } catch {
    return "Progress ownership could not be saved on this device.";
  }
}

const growthDirectionSchema = z.object({
  quality: z.string(),
  whyItMatters: z.string(),
  nextRep: z.string(),
});

export const profileSchema = z.object({
  version: z.literal(1),
  displayName: z.string(),
  goals: z.array(z.string()),
  typeDescription: z.string(),
  desiredRelationship: z.string(),
  struggles: z.array(z.string()),
  onboardingComplete: z.boolean(),
  onboardingPlan: z.object({
    startingModule: z.enum(["spark", "connection"]),
    skillPriorities: z.tuple([z.string(), z.string()]),
    growthDirections: z.tuple([
      growthDirectionSchema,
      growthDirectionSchema,
    ]),
    orderedScenarioIds: z.array(z.string()),
    sideQuestId: z.string().optional(),
  }),
});

export const progressSchema = z.object({
  version: z.literal(1),
  publicXP: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  streak: z.number().int().nonnegative(),
  bestScores: z.record(z.string(), z.number()),
  bestMasteryXP: z.record(z.string(), z.number()),
  completedScenarioIds: z.array(z.string()),
  achievements: z.array(z.string()),
  rewardedAttemptIds: z.array(z.string()),
  lastPracticeDate: z.string().optional(),
});

export const milestonesSchema = z.object({
  version: z.literal(1),
  earned: z.array(
    z.enum([
      "good_conversation",
      "contact_exchanged",
      "received_reply",
      "date_scheduled",
      "went_on_date",
      "second_date",
      "graceful_exit",
    ]),
  ),
});

const practiceMessageSchema = z.object({
  id: z.string(),
  speaker: z.enum(["you", "her"]),
  body: z.string(),
  turn: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  kind: z.enum(["text", "reaction"]).default("text"),
  sequence: z.number().int().nonnegative().default(0),
  deliveryStatus: z.enum(["sent", "delivered", "seen"]).optional(),
  createdAt: z.string(),
});

export const attemptSchema = z
  .object({
    id: z.string(),
    scenarioId: z.string(),
    messages: z.array(practiceMessageSchema),
    userTurn: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    status: z.enum([
      "idle",
      "active",
      "awaiting_reply",
      "awaiting_judgment",
      "complete",
      "error",
    ]),
    personaState: z.object({
      engagement: z.enum(["closed", "low", "neutral", "warm"]),
      boundary: z.enum(["none", "soft", "explicit"]),
      terminal: z.boolean(),
      energy: z.enum(["low", "matched", "high"]).default("matched"),
      recentMoves: z
        .array(
          z.enum([
            "reveal",
            "tease",
            "challenge",
            "callback",
            "pivot",
            "close",
          ]),
        )
        .max(3)
        .default([]),
      questionStreak: z
        .union([z.literal(0), z.literal(1)])
        .default(0),
      callbackSeeds: z.array(z.string().min(2).max(80)).max(4).default([]),
    }),
    startedAt: z.string(),
    completedAt: z.string().optional(),
    completedLocalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .passthrough();

export const activityEntrySchema = z.object({
  attemptId: z.string().min(1).max(120),
  scenarioId: z.string().min(1).max(120),
  completedAt: z.string().datetime(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type LoadResult<T> = {
  value: T;
  warning?: string;
};

export type PersistedRecords = {
  profile: UserProfile;
  progress: Progress;
  attempts: Attempt[];
  activity: PracticeActivityEntry[];
  milestones: Milestones;
};

const persistedRecordsSchema = z.object({
  profile: profileSchema,
  progress: progressSchema,
  attempts: z.array(attemptSchema),
  activity: z.array(activityEntrySchema).optional(),
  milestones: milestonesSchema,
});

export function parsePersistedRecords(
  value: unknown,
): PersistedRecords | null {
  const result = persistedRecordsSchema.safeParse(value);
  if (!result.success) return null;
  const attempts = result.data.attempts as Attempt[];
  return {
    ...result.data,
    attempts,
    activity: mergeActivityEntries(
      result.data.activity ?? [],
      activityFromAttempts(attempts),
    ),
  } as PersistedRecords;
}

function readRecord<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): LoadResult<T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { value: fallback };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(key);
      return {
        value: fallback,
        warning: "One damaged progress record was reset. Everything else is intact.",
      };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      window.localStorage.removeItem(key);
      return {
        value: fallback,
        warning: "One damaged progress record was reset. Everything else is intact.",
      };
    }
    return { value: result.data };
  } catch {
    return {
      value: fallback,
      warning:
        "Local saving is unavailable. You can keep practicing in this tab.",
    };
  }
}

export function loadAllRecords(): PersistedRecords & { warning?: string } {
  const profile = readRecord(
    STORAGE_KEYS.profile,
    profileSchema,
    defaultProfile,
  );
  const progress = readRecord(
    STORAGE_KEYS.progress,
    progressSchema,
    defaultProgress,
  );
  const attempts = readRecord(
    STORAGE_KEYS.attempts,
    z.array(attemptSchema),
    [],
  );
  const milestones = readRecord(
    STORAGE_KEYS.milestones,
    milestonesSchema,
    defaultMilestones,
  );
  const activity = readRecord(
    STORAGE_KEYS.activity,
    z.array(activityEntrySchema),
    [],
  );
  const normalizedActivity = mergeActivityEntries(
    activity.value,
    activityFromAttempts(attempts.value as Attempt[]),
  );
  return {
    profile: profile.value,
    progress: progress.value,
    attempts: attempts.value as Attempt[],
    activity: normalizedActivity,
    milestones: milestones.value,
    warning:
      profile.warning ??
      progress.warning ??
      attempts.warning ??
      activity.warning ??
      milestones.warning,
  };
}

export function writeAllRecords(records: PersistedRecords): string | undefined {
  for (const [key, value] of [
    [STORAGE_KEYS.profile, records.profile],
    [STORAGE_KEYS.progress, records.progress],
    [STORAGE_KEYS.attempts, records.attempts],
    [STORAGE_KEYS.activity, records.activity],
    [STORAGE_KEYS.milestones, records.milestones],
  ] as const) {
    const warning = writeRecord(key, value);
    if (warning) return warning;
  }
  return undefined;
}

export function writeRecord(
  key: Exclude<
    (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS],
    typeof STORAGE_KEYS.owner
  >,
  value: unknown,
): string | undefined {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return undefined;
  } catch {
    return "Progress could not be saved, but this practice session still works.";
  }
}

export function clearProgressRecords(): string | undefined {
  try {
    Object.values(STORAGE_KEYS).forEach((key) =>
      window.localStorage.removeItem(key),
    );
    return undefined;
  } catch {
    return "Local storage could not be cleared on this device.";
  }
}
