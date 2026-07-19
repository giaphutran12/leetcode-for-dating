import { afterEach, describe, expect, it, vi } from "vitest";
import type { Attempt, Milestone, Progress, UserProfile } from "../domain/types";
import { createAttemptStore, MAX_ATTEMPTS } from "./attemptStore";
import { createMilestoneStore } from "./milestoneStore";
import { createProfileStore, defaultProfile, PROFILE_KEY } from "./profileStore";
import {
  createProgressStore,
  defaultProgress,
  PROGRESS_KEY,
} from "./progressStore";
import {
  createMemoryStorageLike,
  getStorageArea,
  resetStorageAreaForTests,
  StorageBackend,
  type StorageLike,
} from "./storageArea";

// A Map-backed StorageLike whose raw contents the test can inspect and poke.
function fakeStorage(seed?: Record<string, string>): StorageLike & {
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    raw,
    getItem: (key) => (raw.has(key) ? (raw.get(key) as string) : null),
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

// A StorageLike whose writes always throw, simulating a full quota.
function quotaStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
    removeItem: () => {},
  };
}

// Like fakeStorage, but writes can be switched to throw mid-session — for
// simulating a quota that fills up only after some records already persisted.
function fakeStorageWithToggleableQuota(): StorageLike & {
  raw: Map<string, string>;
  startThrowing(): void;
} {
  const raw = new Map<string, string>();
  let throwing = false;
  return {
    raw,
    startThrowing: () => {
      throwing = true;
    },
    getItem: (key) => (raw.has(key) ? (raw.get(key) as string) : null),
    setItem: (key, value) => {
      if (throwing) throw new DOMException("quota", "QuotaExceededError");
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

function backendFrom(area: StorageLike): StorageBackend {
  return new StorageBackend({ area, persistent: true });
}

const sampleProfile: UserProfile = {
  version: 1,
  displayName: "Ed",
  goals: ["Improve texting"],
  typeDescription: "funny and warm",
  desiredRelationship: "something real",
  struggles: ["freezing"],
  onboardingComplete: true,
};

describe("profile + progress stores — round-trip", () => {
  it("saves and loads a profile", () => {
    const area = fakeStorage();
    const store = createProfileStore(backendFrom(area));
    store.save(sampleProfile);
    expect(store.load()).toEqual(sampleProfile);
  });

  it("returns the default when nothing is stored", () => {
    const store = createProfileStore(backendFrom(fakeStorage()));
    expect(store.load()).toEqual(defaultProfile());
    const progress = createProgressStore(backendFrom(fakeStorage()));
    expect(progress.load()).toEqual(defaultProgress());
  });
});

describe("corrupt + invalid record recovery", () => {
  it("corrupt JSON in progress resets ONLY progress and leaves profile intact", () => {
    const area = fakeStorage({
      [PROFILE_KEY]: JSON.stringify(sampleProfile),
      [PROGRESS_KEY]: "{ this is not valid json",
    });
    const backend = backendFrom(area);
    const profileStore = createProfileStore(backend);
    const progressStore = createProgressStore(backend);

    // Reading corrupt progress resets that record to the default...
    expect(progressStore.load()).toEqual(defaultProgress());
    // ...removes only the progress key...
    expect(area.raw.has(PROGRESS_KEY)).toBe(false);
    // ...and never touches the sibling profile key.
    expect(area.raw.has(PROFILE_KEY)).toBe(true);
    expect(profileStore.load()).toEqual(sampleProfile);
  });

  it("resets a record whose version is not 1", () => {
    const stale = { ...defaultProgress(), version: 2 } as unknown as Progress;
    const area = fakeStorage({ [PROGRESS_KEY]: JSON.stringify(stale) });
    const store = createProgressStore(backendFrom(area));
    expect(store.load()).toEqual(defaultProgress());
    expect(area.raw.has(PROGRESS_KEY)).toBe(false);
  });

  it("resets progress with a structurally invalid field", () => {
    const broken = { ...defaultProgress(), publicXP: "lots" };
    const area = fakeStorage({ [PROGRESS_KEY]: JSON.stringify(broken) });
    const store = createProgressStore(backendFrom(area));
    expect(store.load()).toEqual(defaultProgress());
  });

  it("normalizes a legacy progress record with no lastPracticeDay", () => {
    const legacy = { ...defaultProgress() } as Partial<Progress>;
    delete legacy.lastPracticeDay;
    const area = fakeStorage({ [PROGRESS_KEY]: JSON.stringify(legacy) });
    const store = createProgressStore(backendFrom(area));
    expect(store.load().lastPracticeDay).toBeNull();
  });
});

describe("attempt store — cap at 100", () => {
  const makeAttempt = (n: number): Attempt => ({
    id: `attempt-${n}`,
    scenarioId: "spark-bus-stop",
    messages: [],
    userTurn: 3,
    status: "complete",
    startedAt: `2026-07-18T00:00:${String(n % 60).padStart(2, "0")}.000Z`,
  });

  it("retains at most 100 attempts, evicting the oldest", () => {
    const store = createAttemptStore(backendFrom(fakeStorage()));
    let list: Attempt[] = [];
    for (let n = 0; n < 130; n += 1) {
      list = store.append(makeAttempt(n));
    }
    expect(store.load()).toHaveLength(MAX_ATTEMPTS);
    // Oldest (attempt-0 .. attempt-29) evicted; newest kept.
    const ids = store.load().map((a) => a.id);
    expect(ids[0]).toBe("attempt-30");
    expect(ids[ids.length - 1]).toBe("attempt-129");
  });

  it("caps on a bulk save too", () => {
    const store = createAttemptStore(backendFrom(fakeStorage()));
    const many = Array.from({ length: 150 }, (_, n) => makeAttempt(n));
    store.save(many);
    expect(store.load()).toHaveLength(MAX_ATTEMPTS);
  });

  it("drops a single corrupt attempt row but keeps the valid ones", () => {
    const good = makeAttempt(1);
    const area = fakeStorage({
      "rizzcode.v1.attempts": JSON.stringify([good, { id: 123 }, null]),
    });
    const store = createAttemptStore(backendFrom(area));
    const loaded = store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("attempt-1");
  });
});

describe("milestone store — corrupt row isolation", () => {
  it("keeps valid milestones and drops invalid ones", () => {
    const good: Milestone = {
      id: "m1",
      code: "contact_exchanged",
      recordedAt: "2026-07-18T00:00:00.000Z",
    };
    const area = fakeStorage({
      "rizzcode.v1.milestones": JSON.stringify([
        good,
        { id: "m2", code: "not_a_real_code", recordedAt: "x" },
      ]),
    });
    const store = createMilestoneStore(backendFrom(area));
    expect(store.load()).toEqual([good]);
  });
});

describe("quota failure → memory fallback", () => {
  it("switches to memory, flips persistent false, and does not throw", () => {
    const backend = new StorageBackend({ area: quotaStorage(), persistent: true });
    const store = createProgressStore(backend);
    const value: Progress = { ...defaultProgress(), publicXP: 120 };

    expect(() => store.save(value)).not.toThrow();
    expect(backend.persistent).toBe(false);
    // The value survives in the shared memory fallback.
    expect(store.load()).toEqual(value);
  });
});

describe("demote — migrates sibling records into the memory fallback", () => {
  it("keeps an untouched sibling record readable after a later quota failure", () => {
    const area = fakeStorageWithToggleableQuota();
    const backend = backendFrom(area);
    const profileStore = createProfileStore(backend);
    const progressStore = createProgressStore(backend);

    // Both records persist fine while the area still has room.
    profileStore.save(sampleProfile);
    progressStore.save({ ...defaultProgress(), publicXP: 40 });

    // Quota fills up mid-session; the next progress save fails and demotes.
    area.startThrowing();
    const laterProgress: Progress = { ...defaultProgress(), publicXP: 120 };
    expect(() => progressStore.save(laterProgress)).not.toThrow();

    expect(backend.persistent).toBe(false);
    // The profile was never re-saved after demote, but its value from the
    // previous (now unreachable) area was migrated into memory, so it must
    // not silently revert to the default.
    expect(profileStore.load()).toEqual(sampleProfile);
  });
});

describe("getStorageArea — shared memory fallback across backends", () => {
  afterEach(() => {
    resetStorageAreaForTests();
    vi.unstubAllGlobals();
  });

  it("two independently-created backends share one fallback when storage is unavailable", () => {
    // No localStorage: both probes resolve to the SAME module-scope memory area,
    // mirroring two mounted views each building their own StorageBackend. XP one
    // view persists must be readable by the other, not trapped in a private map.
    vi.stubGlobal("localStorage", undefined);
    resetStorageAreaForTests();

    const backendA = new StorageBackend(getStorageArea());
    const backendB = new StorageBackend(getStorageArea());
    expect(backendA.persistent).toBe(false);
    expect(backendB.persistent).toBe(false);

    const storeA = createProgressStore(backendA);
    const storeB = createProgressStore(backendB);

    const value: Progress = { ...defaultProgress(), publicXP: 77 };
    storeA.save(value);
    // Backend B, created independently (as a second hook instance would), reads
    // the XP A persisted — the fallback is shared, not per-instance.
    expect(storeB.load()).toEqual(value);
  });
});

describe("getStorageArea — availability fallback", () => {
  afterEach(() => {
    resetStorageAreaForTests();
    vi.unstubAllGlobals();
  });

  it("uses localStorage and reports persistent when the probe write succeeds", () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    });
    const probe = getStorageArea();
    expect(probe.persistent).toBe(true);
    expect(probe.area.setItem).toBeDefined();
  });

  it("falls back to memory with persistent:false when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    });
    const probe = getStorageArea();
    expect(probe.persistent).toBe(false);
    // The returned memory area is usable.
    probe.area.setItem("k", "v");
    expect(probe.area.getItem("k")).toBe("v");
  });
});

describe("createMemoryStorageLike", () => {
  it("behaves like a minimal Storage", () => {
    const mem = createMemoryStorageLike();
    expect(mem.getItem("x")).toBeNull();
    mem.setItem("x", "1");
    expect(mem.getItem("x")).toBe("1");
    mem.removeItem("x");
    expect(mem.getItem("x")).toBeNull();
  });
});
