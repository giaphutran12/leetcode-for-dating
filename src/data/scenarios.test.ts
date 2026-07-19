import { describe, expect, it } from "vitest";
import { scenarioById, scenarios } from "./scenarios";
import type { Difficulty, Engagement, ModuleId, ScenarioMode } from "../domain/types";

// The plan's catalog table, verbatim, in order. Data must match this exactly.
const EXPECTED: Array<{
  id: string;
  module: ModuleId;
  mode: ScenarioMode;
  difficulty: Difficulty;
}> = [
  { id: "spark-bus-stop", module: "spark", mode: "in_person", difficulty: "easy" },
  { id: "spark-open-source", module: "spark", mode: "in_person", difficulty: "easy" },
  { id: "spark-cafe-focus", module: "spark", mode: "in_person", difficulty: "medium" },
  { id: "spark-friend-group", module: "spark", mode: "in_person", difficulty: "medium" },
  { id: "spark-text-after-meeting", module: "spark", mode: "messaging", difficulty: "medium" },
  { id: "connection-keep-thread", module: "connection", mode: "messaging", difficulty: "easy" },
  { id: "connection-playful-callback", module: "connection", mode: "messaging", difficulty: "medium" },
  { id: "connection-suggest-date", module: "connection", mode: "messaging", difficulty: "medium" },
  { id: "connection-recover-awkward", module: "connection", mode: "messaging", difficulty: "hard" },
  { id: "connection-handle-low-interest", module: "connection", mode: "messaging", difficulty: "hard" },
];

const ENGAGEMENTS: Engagement[] = ["closed", "low", "neutral", "warm"];

describe("scenario catalog", () => {
  it("has exactly ten scenarios", () => {
    expect(scenarios).toHaveLength(10);
  });

  it("has unique, stable ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches the plan table order, module, mode, and difficulty", () => {
    scenarios.forEach((scenario, index) => {
      const expected = EXPECTED[index];
      expect(scenario.id).toBe(expected.id);
      expect(scenario.module).toBe(expected.module);
      expect(scenario.mode).toBe(expected.mode);
      expect(scenario.difficulty).toBe(expected.difficulty);
    });
  });

  it("places scenarios 1-4 in person and 5-10 as messaging", () => {
    scenarios.slice(0, 4).forEach((s) => expect(s.mode).toBe("in_person"));
    scenarios.slice(4).forEach((s) => expect(s.mode).toBe("messaging"));
  });

  it("resolves scenarios by id and returns undefined for unknown ids", () => {
    expect(scenarioById("spark-bus-stop")?.title).toBe("The bus-stop opener");
    expect(scenarioById("does-not-exist")).toBeUndefined();
  });
});

describe("every scenario is fully authored", () => {
  it.each(scenarios)("$id has all required non-empty fields", (scenario) => {
    expect(scenario.title.trim()).not.toBe("");
    expect(scenario.setting.trim()).not.toBe("");
    expect(scenario.premise.trim()).not.toBe("");
    expect(scenario.objective.trim()).not.toBe("");
    expect(scenario.visibleContext.length).toBeGreaterThan(0);
    expect(scenario.boundaries.length).toBeGreaterThan(0);
    expect(scenario.skills.length).toBeGreaterThan(0);
    expect(scenario.successSignals.length).toBeGreaterThan(0);
    expect(scenario.supportedOutcomeCodes.length).toBeGreaterThan(0);
    for (const line of [
      ...scenario.visibleContext,
      ...scenario.boundaries,
      ...scenario.skills,
      ...scenario.successSignals,
    ]) {
      expect(line.trim()).not.toBe("");
    }
  });

  it.each(scenarios)("$id has a valid persona with a boundary-free start", (scenario) => {
    const { persona } = scenario;
    expect(persona.name.trim()).not.toBe("");
    expect(persona.traits.length).toBeGreaterThanOrEqual(2);
    expect(persona.traits.length).toBeLessThanOrEqual(4);
    expect(persona.currentGoal.trim()).not.toBe("");
    expect(persona.constraints.length).toBeGreaterThan(0);
    expect(persona.initialState.boundary).toBe("none");
    expect(persona.initialState.terminal).toBe(false);
    expect(["neutral", "warm"]).toContain(persona.initialState.engagement);
  });
});

describe("fallback graphs are complete", () => {
  it.each(scenarios)("$id has all four signal lists", (scenario) => {
    const { fallback } = scenario;
    for (const list of [
      fallback.positiveSignals,
      fallback.lowInterestSignals,
      fallback.boundarySignals,
      fallback.exitSignals,
    ]) {
      expect(list.length).toBeGreaterThan(0);
      for (const signal of list) {
        expect(signal.trim()).not.toBe("");
        expect(signal).toBe(signal.toLowerCase());
      }
    }
  });

  it.each(scenarios)("$id has a full 3x4 reply table with non-empty strings", (scenario) => {
    for (const turn of [1, 2, 3] as const) {
      for (const engagement of ENGAGEMENTS) {
        const reply = scenario.fallback.repliesByTurn[turn][engagement];
        expect(typeof reply).toBe("string");
        expect(reply.trim()).not.toBe("");
      }
    }
  });

  it.each(scenarios)("$id has non-empty dedicated boundary and exit replies", (scenario) => {
    expect(typeof scenario.fallback.boundaryReply).toBe("string");
    expect(scenario.fallback.boundaryReply.trim()).not.toBe("");
    expect(typeof scenario.fallback.exitReply).toBe("string");
    expect(scenario.fallback.exitReply.trim()).not.toBe("");
  });
});

describe("opening kinds match the mode", () => {
  it.each(scenarios)("$id: scene_only openings carry no message body", (scenario) => {
    if (scenario.opening.kind === "scene_only") {
      expect(scenario.opening).not.toHaveProperty("body");
    } else {
      expect(scenario.mode).toBe("messaging");
      expect(scenario.opening.body.trim()).not.toBe("");
    }
  });
});
