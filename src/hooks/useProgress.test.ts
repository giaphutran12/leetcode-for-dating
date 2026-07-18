import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { scenarioById } from "../data/scenarios";
import type { JudgeResult, Scenario, UserProfile } from "../domain/types";
import type { StorageLike, StorageProbe } from "../storage/storageArea";
import { useProgress, type UseProgressOptions } from "./useProgress";

const busStop = scenarioById("spark-bus-stop") as Scenario;

function fakeStorage(): StorageLike {
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

function options(overrides?: Partial<UseProgressOptions>): UseProgressOptions {
  const probe: StorageProbe = { area: fakeStorage(), persistent: true };
  return { storage: probe, now: () => new Date("2026-07-18T12:00:00.000Z"), ...overrides };
}

function makeResult(finalScore: number): JudgeResult {
  return {
    schemaVersion: "1.0",
    attemptId: "a1",
    mode: "llm",
    hardGate: { triggered: false, severity: "none", codes: [], maxScore: 10, evidence: [] },
    rubric: [],
    rawScore: finalScore,
    finalScore,
    verdict: finalScore >= 8 ? "ATE" : "COOKED",
    worked: [],
    improve: [],
    betterResponse: "",
    outcome: { code: "conversation_continues", label: "", confidence: "high", basis: [] },
  };
}

describe("useProgress — recordResult", () => {
  it("persists the outcome and returns the deltas", () => {
    const { result } = renderHook(() => useProgress(options()));

    let returned: ReturnType<typeof result.current.recordResult> | null = null;
    act(() => {
      returned = result.current.recordResult(busStop, makeResult(8));
    });

    expect(returned).not.toBeNull();
    expect(returned!.publicXPDelta).toBe(90); // easy masteryXP 80 + first-completion 10
    expect(result.current.progress.publicXP).toBe(90);
    expect(result.current.progress.completedScenarioIds).toContain("spark-bus-stop");
    expect(result.current.progress.streak).toBe(1);
  });

  it("survives a fresh hook mount against the same storage (returning-user refresh)", () => {
    const probe: StorageProbe = { area: fakeStorage(), persistent: true };
    const first = renderHook(() => useProgress({ storage: probe, now: () => new Date("2026-07-18T12:00:00Z") }));
    act(() => {
      first.result.current.recordResult(busStop, makeResult(8));
    });
    first.unmount();

    // A brand-new hook reading the same storage sees the persisted progress.
    const second = renderHook(() => useProgress({ storage: probe }));
    expect(second.result.current.progress.publicXP).toBe(90);
  });
});

describe("useProgress — milestones stay private", () => {
  it("recordMilestone adds a private badge and never touches public XP", () => {
    const { result } = renderHook(() => useProgress(options()));
    act(() => {
      result.current.recordResult(busStop, makeResult(8));
    });
    const xpBefore = result.current.progress.publicXP;
    const levelBefore = result.current.progress.level;
    const bestBefore = { ...result.current.progress.bestScores };

    act(() => {
      result.current.recordMilestone("contact_exchanged");
    });

    expect(result.current.milestones).toHaveLength(1);
    expect(result.current.milestones[0].code).toBe("contact_exchanged");
    // Public progress is completely untouched.
    expect(result.current.progress.publicXP).toBe(xpBefore);
    expect(result.current.progress.level).toBe(levelBefore);
    expect(result.current.progress.bestScores).toEqual(bestBefore);
  });
});

describe("useProgress — onboarding", () => {
  it("completeOnboarding marks the profile complete and derives a plan", () => {
    const { result } = renderHook(() => useProgress(options()));
    const answers: UserProfile = {
      version: 1,
      displayName: "Ed",
      goals: ["Improve texting", "Get more dates"],
      typeDescription: "warm and funny",
      desiredRelationship: "something real",
      struggles: ["I go dry over text"],
      onboardingComplete: false,
    };
    act(() => {
      result.current.completeOnboarding(answers);
    });
    expect(result.current.profile.onboardingComplete).toBe(true);
    expect(result.current.plan.startingModule).toBe("connection");
  });

  it("skipOnboarding yields the default spark-first plan", () => {
    const { result } = renderHook(() => useProgress(options()));
    act(() => {
      result.current.skipOnboarding();
    });
    expect(result.current.profile.onboardingComplete).toBe(true);
    expect(result.current.plan.startingModule).toBe("spark");
    expect(result.current.plan.sideQuestId).toBeUndefined();
  });
});

describe("useProgress — resetProgress", () => {
  it("clears all four records back to defaults", () => {
    const { result } = renderHook(() => useProgress(options()));
    act(() => {
      result.current.completeOnboarding({
        version: 1,
        displayName: "Ed",
        goals: [],
        typeDescription: "",
        desiredRelationship: "",
        struggles: [],
        onboardingComplete: false,
      });
      result.current.recordResult(busStop, makeResult(8));
      result.current.recordMilestone("received_reply");
    });
    expect(result.current.progress.publicXP).toBeGreaterThan(0);

    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.progress.publicXP).toBe(0);
    expect(result.current.progress.completedScenarioIds).toHaveLength(0);
    expect(result.current.milestones).toHaveLength(0);
    expect(result.current.profile.onboardingComplete).toBe(false);
  });
});

describe("useProgress — storage warning flag", () => {
  it("exposes persistent:false when storage is not durable", () => {
    const { result } = renderHook(() =>
      useProgress({ storage: { area: fakeStorage(), persistent: false } }),
    );
    expect(result.current.persistent).toBe(false);
  });
});
