// The storage seam (plan: "Persistence" — "If local storage is unavailable,
// continue in memory and show a non-blocking warning"). Everything above this
// file talks to a tiny StorageLike interface, never to `localStorage` directly,
// so the whole persistence layer is testable against injected fakes and never
// crashes the app when the browser refuses to store.

// The three localStorage methods the stores actually use. Deliberately minimal.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// An in-memory StorageLike backed by a Map. Used as the fallback when
// localStorage is unavailable or throws (e.g. Safari private mode, quota).
export function createMemoryStorageLike(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export interface StorageProbe {
  area: StorageLike;
  persistent: boolean;
}

const PROBE_KEY = "rizzcode.v1.__probe__";

// Probe localStorage by writing and removing a throwaway key. Any failure (no
// localStorage, disabled cookies, private mode, quota) falls back to a fresh
// in-memory area flagged persistent:false so the UI can warn without blocking.
export function getStorageArea(): StorageProbe {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!ls) return { area: createMemoryStorageLike(), persistent: false };
    ls.setItem(PROBE_KEY, "1");
    ls.removeItem(PROBE_KEY);
    return { area: ls, persistent: true };
  } catch {
    return { area: createMemoryStorageLike(), persistent: false };
  }
}

// A single backend shared by all four stores of one app instance. When any
// store's write throws (quota mid-session), demote() swaps every store over to
// one shared in-memory area and flips `persistent` false — coherently, so the
// hook exposes a single warning flag rather than four diverging ones.
export class StorageBackend {
  area: StorageLike;
  persistent: boolean;
  // If we already started in memory, reuse that same area as the fallback so a
  // later demote is a no-op swap and the shared map survives.
  private fallbackMemory: StorageLike | null;
  // Every RecordStore registers its key here (see RecordStore's constructor)
  // so demote() knows what to carry over without this seam having to know
  // about any store's key constants.
  private readonly keys = new Set<string>();

  constructor(init: StorageProbe) {
    this.area = init.area;
    this.persistent = init.persistent;
    this.fallbackMemory = init.persistent ? null : init.area;
  }

  registerKey(key: string): void {
    this.keys.add(key);
  }

  demote(): void {
    const previous = this.area;
    this.fallbackMemory ??= createMemoryStorageLike();
    const next = this.fallbackMemory;
    // Carry over already-persisted sibling records so a quota failure on one
    // store doesn't make the others silently revert to their defaults on the
    // next read — the data is still sitting in the previous area, just no
    // longer reachable once `area` swaps to memory. Best-effort per key: a
    // failing read just skips that key rather than aborting the demote.
    for (const key of this.keys) {
      try {
        const value = previous.getItem(key);
        if (value !== null) next.setItem(key, value);
      } catch {
        // Skip this key; the rest still get a chance to migrate.
      }
    }
    this.area = next;
    this.persistent = false;
  }
}

// Generic versioned record store. Load parses + validates and, on corrupt or
// invalid data, removes ONLY its own key (never a sibling) and returns the
// default. Save swallows quota errors by demoting to the memory fallback and
// retrying — it never throws, so a failed write can never crash the app.
export class RecordStore<T> {
  constructor(
    private readonly backend: StorageBackend,
    readonly key: string,
    private readonly parse: (raw: unknown) => T | null,
    private readonly makeDefault: () => T,
  ) {
    this.backend.registerKey(key);
  }

  get persistent(): boolean {
    return this.backend.persistent;
  }

  load(): T {
    let raw: string | null;
    try {
      raw = this.backend.area.getItem(this.key);
    } catch {
      return this.makeDefault();
    }
    if (raw === null) return this.makeDefault();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt JSON: reset only this record.
      this.remove();
      return this.makeDefault();
    }

    const value = this.parse(parsed);
    if (value === null) {
      // Structurally invalid or wrong version: reset only this record.
      this.remove();
      return this.makeDefault();
    }
    return value;
  }

  save(value: T): void {
    const serialized = JSON.stringify(value);
    try {
      this.backend.area.setItem(this.key, serialized);
      return;
    } catch {
      // Fall through to the memory fallback.
    }
    this.backend.demote();
    try {
      this.backend.area.setItem(this.key, serialized);
    } catch {
      // Even memory refused (should never happen). Swallow — never crash.
    }
  }

  clear(): void {
    this.remove();
  }

  private remove(): void {
    try {
      this.backend.area.removeItem(this.key);
    } catch {
      // Swallow — a failed cleanup must never crash the app.
    }
  }
}
