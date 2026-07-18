// The progression hook (plan: "User journey" returning visit, "Gamification",
// "Persistence"). It binds the four versioned stores to the pure progression and
// onboarding logic and exposes one React-friendly surface for the UI task. All
// domain math lives in domain/; all I/O lives in storage/; this hook is only the
// glue and the React state.
//
// Key guarantees mirrored from the layers below:
//  - recordResult persists a schema-validated judge result through the pure XP
//    core and returns the full outcome (deltas, unlocks, level-up).
//  - recordAttempt appends the completed transcript to the capped attempts store
//    (additive UI helper, Task 6a): the result path already persists progress,
//    but the finished attempt itself is the raw record the results view saves so
//    history survives a reload. It shares the same backend, so a quota demote
//    keeps a single coherent `persistent` flag.
//  - recordMilestone writes a PRIVATE milestone only — it never touches
//    publicXP, level, or best scores.
//  - resetProgress clears all four rizzcode.v1.* records.
//  - A storage failure flips `persistent` false and keeps running in memory.

import { useCallback, useMemo, useRef, useState } from "react";
import { buildOnboardingPlan, defaultOnboardingPlan } from "../domain/onboarding";
import { applyJudgeResult } from "../domain/progression";
import type { ApplyJudgeResultOutcome } from "../domain/progression";
import type {
  Attempt,
  JudgeResult,
  Milestone,
  MilestoneCode,
  OnboardingPlan,
  Progress,
  Scenario,
  UserProfile,
} from "../domain/types";
import { createAttemptStore, type AttemptStore } from "../storage/attemptStore";
import { createMilestoneStore } from "../storage/milestoneStore";
import { createProfileStore, defaultProfile } from "../storage/profileStore";
import { createProgressStore } from "../storage/progressStore";
import {
  getStorageArea,
  StorageBackend,
  type RecordStore,
  type StorageProbe,
} from "../storage/storageArea";

export interface AttemptsMeta {
  count: number;
  lastAttemptAt: string | null;
}

export interface UseProgressOptions {
  // Injected storage for tests; production probes real localStorage.
  storage?: StorageProbe;
  // Injectable clock (default new Date()) so streak day math is testable.
  now?: () => Date;
}

export interface UseProgressResult {
  profile: UserProfile;
  progress: Progress;
  milestones: Milestone[];
  attemptsMeta: AttemptsMeta;
  persistent: boolean;
  plan: OnboardingPlan;
  saveProfile(profile: UserProfile): void;
  completeOnboarding(profile: UserProfile): void;
  skipOnboarding(): void;
  recordResult(scenario: Scenario, result: JudgeResult): ApplyJudgeResultOutcome;
  recordAttempt(attempt: Attempt): void;
  recordMilestone(code: MilestoneCode): void;
  resetProgress(): void;
}

interface Stores {
  backend: StorageBackend;
  profile: RecordStore<UserProfile>;
  progress: RecordStore<Progress>;
  milestones: RecordStore<Milestone[]>;
  attempts: AttemptStore;
}

function createStores(probe: StorageProbe): Stores {
  const backend = new StorageBackend(probe);
  return {
    backend,
    profile: createProfileStore(backend),
    progress: createProgressStore(backend),
    milestones: createMilestoneStore(backend),
    attempts: createAttemptStore(backend),
  };
}

// One backend shared by every production hook instance. Each mounted view runs
// its own useProgress, so without this a mid-session quota demote in one view
// would leave the other views writing to a stale (still-full or diverged) area —
// and a from-the-start memory fallback would give each view its own empty map.
// A single shared backend keeps the whole page coherent: one area, one demote,
// one `persistent` flag. Tests inject their own StorageProbe and get an isolated
// backend per hook.
let sharedStores: Stores | null = null;

function getSharedStores(): Stores {
  sharedStores ??= createStores(getStorageArea());
  return sharedStores;
}

// Test-only: drop the shared production backend so suites that swap the global
// localStorage between tests get a fresh backend instead of one pinned to the
// first test's storage.
export function resetSharedStoresForTests(): void {
  sharedStores = null;
}

interface Snapshot {
  profile: UserProfile;
  progress: Progress;
  milestones: Milestone[];
  attemptsMeta: AttemptsMeta;
  persistent: boolean;
}

// Local calendar day as YYYY-MM-DD (streaks live on the player's own calendar).
function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readSnapshot(stores: Stores): Snapshot {
  const attempts = stores.attempts.load();
  const last = attempts[attempts.length - 1];
  return {
    profile: stores.profile.load(),
    progress: stores.progress.load(),
    milestones: stores.milestones.load(),
    attemptsMeta: {
      count: attempts.length,
      lastAttemptAt: last?.completedAt ?? last?.startedAt ?? null,
    },
    persistent: stores.backend.persistent,
  };
}

export function useProgress(options: UseProgressOptions = {}): UseProgressResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Stores are created once and share a single backend so a quota demote flips
  // one coherent `persistent` flag. Injected storage gets an isolated backend
  // (tests); the production path reuses one module-scope backend across every
  // mounted view's hook so the memory fallback and any demote stay shared.
  const storesRef = useRef<Stores | null>(null);
  if (storesRef.current === null) {
    storesRef.current = options.storage
      ? createStores(options.storage)
      : getSharedStores();
  }
  const stores = storesRef.current;

  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(stores));

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot(stores));
  }, [stores]);

  const clock = useCallback(
    () => (optionsRef.current.now ?? (() => new Date()))(),
    [],
  );

  const saveProfile = useCallback(
    (profile: UserProfile) => {
      stores.profile.save(profile);
      refresh();
    },
    [stores, refresh],
  );

  const completeOnboarding = useCallback(
    (profile: UserProfile) => {
      stores.profile.save({ ...profile, onboardingComplete: true });
      refresh();
    },
    [stores, refresh],
  );

  const skipOnboarding = useCallback(() => {
    // A skip records a sensible default profile marked complete so the app
    // doesn't nag; the derived plan is the spark-first default.
    stores.profile.save({ ...defaultProfile(), onboardingComplete: true });
    refresh();
  }, [stores, refresh]);

  const recordResult = useCallback(
    (scenario: Scenario, result: JudgeResult): ApplyJudgeResultOutcome => {
      const current = stores.progress.load();
      const today = localDay(clock());
      const outcome = applyJudgeResult(current, scenario, result, today);
      stores.progress.save(outcome.next);
      refresh();
      return outcome;
    },
    [stores, refresh, clock],
  );

  const recordAttempt = useCallback(
    (attempt: Attempt) => {
      stores.attempts.append(attempt);
      refresh();
    },
    [stores, refresh],
  );

  const recordMilestone = useCallback(
    (code: MilestoneCode) => {
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        code,
        recordedAt: clock().toISOString(),
      };
      // Private only: append to the milestones store and NEVER touch progress.
      stores.milestones.save([...stores.milestones.load(), milestone]);
      refresh();
    },
    [stores, refresh, clock],
  );

  const resetProgress = useCallback(() => {
    stores.profile.clear();
    stores.progress.clear();
    stores.milestones.clear();
    stores.attempts.clear();
    refresh();
  }, [stores, refresh]);

  const plan = useMemo(
    () =>
      snapshot.profile.onboardingComplete
        ? buildOnboardingPlan(snapshot.profile)
        : defaultOnboardingPlan(),
    [snapshot.profile],
  );

  return {
    profile: snapshot.profile,
    progress: snapshot.progress,
    milestones: snapshot.milestones,
    attemptsMeta: snapshot.attemptsMeta,
    persistent: snapshot.persistent,
    plan,
    saveProfile,
    completeOnboarding,
    skipOnboarding,
    recordResult,
    recordAttempt,
    recordMilestone,
    resetProgress,
  };
}
