// The progress record (plan: "Persistence" — key `rizzcode.v1.progress`). The
// default is a zeroed Progress at level 1 with no streak, best, or completion
// history. `lastPracticeDay` starts null so the first valid completion opens a
// streak at 1.

import type { Progress } from "../domain/types";
import { RecordStore, type StorageBackend } from "./storageArea";
import { parseProgress } from "./validate";

export const PROGRESS_KEY = "rizzcode.v1.progress";

export function defaultProgress(): Progress {
  return {
    version: 1,
    publicXP: 0,
    level: 1,
    streak: 0,
    bestScores: {},
    bestMasteryXP: {},
    completedScenarioIds: [],
    achievements: [],
    lastPracticeDay: null,
  };
}

export function createProgressStore(
  backend: StorageBackend,
): RecordStore<Progress> {
  return new RecordStore(backend, PROGRESS_KEY, parseProgress, defaultProgress);
}
