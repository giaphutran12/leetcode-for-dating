import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import { sideQuests } from "../data/sideQuests";
import { buildOnboardingPlan, defaultOnboardingPlan } from "./onboarding";
import type { UserProfile } from "./types";

function profile(overrides: Partial<UserProfile>): UserProfile {
  return {
    version: 1,
    displayName: "",
    goals: [],
    typeDescription: "",
    desiredRelationship: "",
    struggles: [],
    onboardingComplete: true,
    ...overrides,
  };
}

const sideQuestIds = new Set(sideQuests.map((quest) => quest.id));
const scenarioIds = scenarios.map((scenario) => scenario.id);

function assertValidPlan(plan: ReturnType<typeof buildOnboardingPlan>): void {
  expect(["spark", "connection"]).toContain(plan.startingModule);
  expect(plan.skillPriorities).toHaveLength(2);
  expect(plan.skillPriorities[0]).not.toBe(plan.skillPriorities[1]);
  expect(plan.growthDirections).toHaveLength(2);
  for (const direction of plan.growthDirections) {
    expect(direction.quality.length).toBeGreaterThan(0);
    expect(direction.whyItMatters.length).toBeGreaterThan(0);
    expect(direction.nextRep.length).toBeGreaterThan(0);
  }
  // Ordering is a permutation of all ten scenario ids.
  expect([...plan.orderedScenarioIds].sort()).toEqual([...scenarioIds].sort());
  if (plan.sideQuestId !== undefined) {
    expect(sideQuestIds.has(plan.sideQuestId)).toBe(true);
  }
}

describe("buildOnboardingPlan — starting module", () => {
  it("routes opener/freezing struggles to spark", () => {
    const plan = buildOnboardingPlan(
      profile({ goals: ["Talk naturally"], struggles: ["I freeze and don't know what to say"] }),
    );
    expect(plan.startingModule).toBe("spark");
    expect(plan.orderedScenarioIds[0]).toBe("spark-bus-stop");
    assertValidPlan(plan);
  });

  it("routes texting/dates/sustaining goals to connection", () => {
    const plan = buildOnboardingPlan(
      profile({
        goals: ["Improve texting", "Get more dates"],
        struggles: ["I go dry over text and never ask her out"],
      }),
    );
    expect(plan.startingModule).toBe("connection");
    expect(plan.orderedScenarioIds[0]).toBe("connection-keep-thread");
    assertValidPlan(plan);
  });

  it("defaults to spark with no clear signal", () => {
    const plan = buildOnboardingPlan(profile({}));
    expect(plan.startingModule).toBe("spark");
    assertValidPlan(plan);
  });
});

describe("buildOnboardingPlan — side quests", () => {
  it("suggests learn-guitar only on a genuine music interest", () => {
    const plan = buildOnboardingPlan(
      profile({ typeDescription: "someone who loves live music and plays guitar" }),
    );
    expect(plan.sideQuestId).toBe("learn-guitar");
  });

  it("suggests no side quest when nothing genuinely matches", () => {
    const plan = buildOnboardingPlan(
      profile({ goals: ["Improve texting"], desiredRelationship: "a serious partner" }),
    );
    expect(plan.sideQuestId).toBeUndefined();
  });

  it("routes a freezing struggle to speak-without-freezing", () => {
    const plan = buildOnboardingPlan(
      profile({ struggles: ["my words don't come out, I just freeze"] }),
    );
    expect(plan.sideQuestId).toBe("speak-without-freezing");
  });
});

describe("defaultOnboardingPlan", () => {
  it("is a valid spark-first default with no side quest", () => {
    const plan = defaultOnboardingPlan();
    expect(plan.startingModule).toBe("spark");
    expect(plan.sideQuestId).toBeUndefined();
    assertValidPlan(plan);
  });

  it("matches an empty completed profile so skip and empty never drift", () => {
    const emptyPlan = buildOnboardingPlan(profile({ onboardingComplete: false }));
    expect(defaultOnboardingPlan()).toEqual(emptyPlan);
  });
});
