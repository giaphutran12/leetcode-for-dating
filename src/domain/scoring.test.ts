import { describe, expect, it } from "vitest";
import { getScenario } from "../data/scenarios";
import {
  appendTurn,
  attemptFromResponses,
  createAttempt,
} from "../engine/conversationEngine";
import { CRITERIA } from "./constants";
import {
  detectHardGates,
  finalizeJudgeResult,
  verdictForScore,
} from "./scoring";
import type { JudgeModelDraft } from "./types";

function perfectDraft(
  excerpt: string,
  turn: 1 | 2 | 3 = 3,
  outcome: JudgeModelDraft["outcome"]["code"] = "conversation_continues",
): JudgeModelDraft {
  const evidence = { turn, excerpt, reason: "Exact observable evidence." };
  return {
    rubric: CRITERIA.map((id) => ({
      id,
      score: 2 as const,
      evidence,
      feedback: "Specific and supported.",
    })),
    worked: ["Specific and responsive."],
    improve: ["Keep it concise."],
    betterResponse: "A cleaner alternative.",
    outcome: {
      code: outcome,
      label: "Model label is replaced by the server",
      confidence: "high",
      basis: [evidence],
    },
  };
}

describe("hard gates and server-owned arithmetic", () => {
  it("maps final scores to the locked verdict thresholds", () => {
    expect(verdictForScore(3)).toBe("FUMBLED");
    expect(verdictForScore(4)).toBe("COOKED");
    expect(verdictForScore(7)).toBe("COOKED");
    expect(verdictForScore(8)).toBe("ATE");
  });

  it("stops continued solicitation after an explicit refusal", () => {
    const scenario = getScenario("RC-051")!;
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: "Give me another chance. Go out with me." }],
      "attempt-stop",
    );
    const gate = detectHardGates(attempt);
    expect(gate.severity).toBe("stop");
    expect(gate.maxScore).toBe(2);
    expect(gate.codes).toContain("continued_after_refusal");
  });

  it("recognizes the production sexual-pressure slang and forces a boundary outcome", () => {
    const scenario = getScenario("RC-040")!;
    const response = { turn: 1 as const, body: "u dtf" };
    for (const body of [
      "u dtf",
      "lowk i just tryna bang",
      "tue 9 pm we bang ok",
      "we can talk then bang",
    ]) {
      const phraseAttempt = attemptFromResponses(
        scenario,
        [{ turn: 1, body }],
        `attempt-${body}`,
      );
      expect(detectHardGates(phraseAttempt).codes).toContain(
        "explicit_sexual_pressure",
      );
    }
    const attempt = attemptFromResponses(
      scenario,
      [
        response,
        { turn: 2, body: "lowk i just tryna bang" },
        { turn: 3, body: "we can talk then bang" },
      ],
      "attempt-production-regression",
    );
    const gate = detectHardGates(attempt);
    expect(gate).toMatchObject({
      triggered: true,
      severity: "stop",
      maxScore: 2,
    });
    expect(gate.codes).toContain("explicit_sexual_pressure");

    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft: perfectDraft(response.body, 1, "date_agreed"),
    });
    expect(result.outcome.code).toBe("boundary_crossed");
    expect(result.finalScore).toBe(2);
    expect(result.verdict).toBe("FUMBLED");
  });

  it("caps negging at four", () => {
    const scenario = getScenario("RC-001")!;
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: "You are not that pretty, but give me your number." }],
      "attempt-cap",
    );
    const gate = detectHardGates(attempt);
    expect(gate.severity).toBe("cap");
    expect(gate.maxScore).toBe(4);
    expect(gate.evidence[0].excerpt).toContain("not that pretty");
  });

  it("recalculates score, cap, verdict, labels, and exact evidence", () => {
    const scenario = getScenario("RC-001")!;
    const responses = [
      { turn: 1 as const, body: "That ramen tote is elite." },
      { turn: 2 as const, body: "Spicy miso wins. What is your answer?" },
      {
        turn: 3 as const,
        body: "This was fun. The ramen tribunal should continue.",
      },
    ];
    const attempt = attemptFromResponses(scenario, responses, "attempt-perfect");
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft: perfectDraft(responses[2].body),
    });
    expect(result.rawScore).toBe(10);
    expect(result.finalScore).toBe(10);
    expect(result.verdict).toBe("ATE");
    expect(result.outcome.label).toBe("Comfortable continuation");
    expect(result.rubric).toHaveLength(5);
  });

  it("rejects invented evidence and unsupported contact outcomes", () => {
    const scenario = getScenario("RC-001")!;
    const response = { turn: 1 as const, body: "Hello there." };
    const attempt = attemptFromResponses(scenario, [response], "attempt-invalid");
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: perfectDraft("words never sent", 1),
      }),
    ).toThrow(/evidence/i);

    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: perfectDraft(response.body, 1, "contact_exchanged"),
      }),
    ).toThrow(/outcome/i);
  });

  it("does not claim contact exchange after the persona declines", () => {
    const scenario = getScenario("RC-001")!;
    const body = "Want to swap numbers and continue this sometime?";
    const attempt = appendTurn(createAttempt(scenario, "attempt-declined"), body, {
      actions: [
        {
          kind: "text",
          body: "no thanks, I would rather leave it here",
          delayMs: 80,
        },
      ],
      interestChange: "up",
      state: { engagement: "warm", boundary: "none", terminal: false },
      terminalReason: null,
    });
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: perfectDraft(body, 1, "contact_exchanged"),
      }),
    ).toThrow(/outcome/i);
  });

  it("applies a cap after model scoring rather than trusting model totals", () => {
    const scenario = getScenario("RC-001")!;
    const response = {
      turn: 1 as const,
      body: "You are not that pretty, but the ramen tote is okay.",
    };
    const attempt = attemptFromResponses(scenario, [response], "attempt-capped");
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft: perfectDraft(response.body, 1),
    });
    expect(result.rawScore).toBe(10);
    expect(result.finalScore).toBe(4);
    expect(result.verdict).toBe("COOKED");
  });
});
