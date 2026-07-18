import type { Scenario } from "../domain/types";
import {
  problemCatalog,
  type ProblemDefinition,
} from "./scenarios/catalog";

function toScenario(problem: ProblemDefinition): Scenario {
  return {
    problemNumber: problem.problemNumber,
    id: problem.id,
    module: problem.module,
    mode: problem.mode,
    difficulty: problem.difficulty,
    title: problem.title,
    setting: problem.setting,
    premise: problem.premise,
    objective: problem.objective,
    visibleContext: problem.visibleContext,
    boundaries: problem.boundaries,
    skills: problem.skills,
    tips: problem.tips,
    opening: problem.opening,
    persona: {
      name: problem.persona.displayName,
      traits: problem.persona.traits,
      currentGoal: problem.persona.currentGoal,
      constraints: problem.persona.constraints,
      initialState: problem.persona.initialState,
    },
    successSignals: problem.successSignals,
    supportedOutcomeCodes: problem.supportedOutcomeCodes,
    fallback: problem.fallback,
  };
}

export const scenarios: Scenario[] = problemCatalog.map(toScenario);

export const scenarioById = new Map(
  scenarios.map((scenario) => [scenario.id, scenario]),
);

export function getScenario(scenarioId: string): Scenario | undefined {
  return scenarioById.get(scenarioId);
}

export const modules = [
  {
    id: "spark" as const,
    name: "Spark",
    eyebrow: "Create the first good moment",
    description:
      "Notice what is real, bring some personality, and test mutual energy without forcing it.",
  },
  {
    id: "connection" as const,
    name: "Connection",
    eyebrow: "Keep something real alive",
    description:
      "Listen, contribute, follow through, invite clearly, and handle mismatches like a grown man.",
  },
];
