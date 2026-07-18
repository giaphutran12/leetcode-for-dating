import { describe, expect, it } from "vitest";
import { getScenario } from "../../src/data/scenarios";
import { detectHardGates } from "../../src/domain/scoring";
import { attemptFromResponses } from "../../src/engine/conversationEngine";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./prompt";

describe("judge prompt evidence authority", () => {
  it("requires rubric and outcome evidence to quote only user-authored turns", () => {
    const scenario = getScenario("spark-bus-stop")!;
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: "That ramen tote is elite." }],
      "attempt-prompt",
    );
    const prompt = buildJudgePrompt(
      scenario,
      attempt,
      detectHardGates(attempt),
    );

    expect(JUDGE_SYSTEM_PROMPT).toContain(
      'Every outcome.basis entry must also cite an exact',
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      'Never cite a persona "her" turn',
    );
    expect(prompt).toContain(
      'Copy every rubric and outcome-basis excerpt only from a "you" message.',
    );
  });
});
