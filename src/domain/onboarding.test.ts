import { describe, expect, it } from "vitest";
import { buildOnboardingPlan } from "./onboarding";

describe("onboarding plan routing", () => {
  it("routes only from controlled goal choices, not guessed free-text keywords", () => {
    const plan = buildOnboardingPlan({
      goals: ["Talk naturally"],
      typeDescription:
        "developer who likes coffee, books, cooking, plants, and parties",
      desiredRelationship: "A relationship with clear plans and follow-through",
      struggles:
        "texting, asking for dates, awkward repairs, and handling rejection",
    });

    expect(plan.startingModule).toBe("spark");
    expect(plan.orderedScenarioIds[0]).toBe("RC-001");
    expect(plan.sideQuestId).toBe("speak-without-freezing");
  });

  it("uses an explicit controlled goal to select connection practice", () => {
    const plan = buildOnboardingPlan({
      goals: ["Improve texting"],
      typeDescription: "",
      desiredRelationship: "",
      struggles: "",
    });

    expect(plan.startingModule).toBe("connection");
    expect(plan.orderedScenarioIds[0]).toBe("RC-035");
  });
});
