import { describe, expect, it } from "vitest";
import {
  catalogSummary,
  problemCatalog,
  problemsById,
} from "./catalog";

describe("closed 67-problem catalog", () => {
  it("preserves the required totals, order, and unique identifiers", () => {
    expect(catalogSummary).toEqual({
      total: 67,
      spark: 34,
      connection: 33,
      inPerson: 33,
      messaging: 34,
      easy: 24,
      medium: 28,
      hard: 15,
    });
    expect(problemCatalog.map((problem) => problem.problemNumber)).toEqual(
      Array.from({ length: 67 }, (_, index) => index + 1),
    );
    expect(new Set(problemCatalog.map((problem) => problem.id)).size).toBe(67);
    expect(
      new Set(problemCatalog.map((problem) => problem.sourceSeedId)).size,
    ).toBe(67);
    expect(problemsById.size).toBe(67);
  });

  it("keeps every problem complete enough for list and practice views", () => {
    expect(
      problemCatalog.every(
        (problem) =>
          problem.persona.pronouns === "she/her" &&
          problem.boundaries.length >= 2 &&
          problem.skills.length >= 2 &&
          problem.tips.length >= 3 &&
          problem.successSignals.length >= 3 &&
          problem.turnFeedbackFocus.length >= 1 &&
          problem.personaPromptOverlay.length > 0,
      ),
    ).toBe(true);
    expect(
      new Set(problemCatalog.map((problem) => problem.interactionProfileId))
        .size,
    ).toBe(7);
  });
});
