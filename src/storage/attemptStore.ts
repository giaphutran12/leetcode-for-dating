// The attempts record (plan: "Persistence" — key `rizzcode.v1.attempts`,
// "Retain at most 100 attempts"). Wraps the generic RecordStore with a hard cap
// so the transcript history can never grow unbounded and blow the quota. The
// oldest attempts are evicted first.

import type { Attempt } from "../domain/types";
import { RecordStore, type StorageBackend } from "./storageArea";
import { parseAttempts } from "./validate";

export const ATTEMPTS_KEY = "rizzcode.v1.attempts";
export const MAX_ATTEMPTS = 100;

export interface AttemptStore {
  readonly persistent: boolean;
  load(): Attempt[];
  save(attempts: Attempt[]): void;
  append(attempt: Attempt): Attempt[];
  clear(): void;
}

export function createAttemptStore(backend: StorageBackend): AttemptStore {
  const base = new RecordStore<Attempt[]>(
    backend,
    ATTEMPTS_KEY,
    parseAttempts,
    () => [],
  );

  // Keep only the most recent MAX_ATTEMPTS, evicting the oldest.
  const capped = (attempts: Attempt[]): Attempt[] =>
    attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts;

  return {
    get persistent() {
      return backend.persistent;
    },
    load: () => base.load(),
    save: (attempts) => base.save(capped(attempts)),
    append: (attempt) => {
      const next = capped([...base.load(), attempt]);
      base.save(next);
      return next;
    },
    clear: () => base.clear(),
  };
}
