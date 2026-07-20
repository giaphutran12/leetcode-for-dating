import { describe, expect, it } from "vitest";
import { getScenario } from "../../src/data/scenarios";
import { attemptFromResponses } from "../../src/engine/conversationEngine";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./prompt";

describe("judge prompt evidence authority", () => {
  it("requires user-turn references while the server owns transcript excerpts", () => {
    const scenario = getScenario("RC-001")!;
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: "That ramen tote is elite." }],
      "attempt-prompt",
    );
    const prompt = buildJudgePrompt(scenario, attempt);

    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "Every outcome.basis entry must also reference a real",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      'Never reference a persona "her" turn',
    );
    expect(prompt).toContain(
      'Reference real "you" turn numbers for rubric, safety, and outcome evidence.',
    );
    expect(prompt).toContain(
      "Do not copy transcript excerpts into the output.",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "You own the semantic judgment.",
    );
    expect(prompt).toContain(
      "Infer safety and outcome from the full transcript, not canned keywords.",
    );
    expect(prompt).not.toContain("deterministicHardGateContext");
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "Sexual language or a sexual suggestion is not automatically pressure.",
    );
    expect(JUDGE_SYSTEM_PROMPT).toContain(
      "ambiguous language the benefit of the doubt.",
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
