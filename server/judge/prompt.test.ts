import { describe, expect, it } from "vitest";
import { getScenario } from "../../src/data/scenarios";
import { detectHardGates } from "../../src/domain/scoring";
import { attemptFromResponses } from "../../src/engine/conversationEngine";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./prompt";

describe("judge prompt evidence authority", () => {
  it("requires rubric and outcome evidence to quote only user-authored turns", () => {
    const scenario = getScenario("RC-001")!;
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

  it("requires a restrained Gen Z coaching voice without weakening boundaries", () => {
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "like a sharp Gen Z friend reviewing game tape",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "Slang is seasoning, not the whole meal.",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "Use simple words and one clear idea per sentence.",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      'Keep section labels plain, such as "What worked" and "What to improve".',
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "Never mock a boundary violation.",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "betterResponse must sound like a message a real person would send",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain("mogged, edged, or brutalized");
    expect(JUDGE_SYSTEM_PROMPT).toContain("Do not use em dashes.");
    expect(JUDGE_SYSTEM_PROMPT).toContain("gremlin, gremlins");
  });
});
