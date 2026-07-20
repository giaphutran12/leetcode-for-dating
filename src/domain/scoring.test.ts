import { describe, expect, it } from "vitest";
import { getScenario } from "../data/scenarios";
import {
  attemptFromResponses,
} from "../engine/conversationEngine";
import { CRITERIA } from "./constants";
import {
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
    safety: {
      severity: "none",
      confidence: "high",
      codes: [],
      evidence: [],
    },
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

  it("enforces a model-classified stop without re-reading the language", () => {
    const scenario = getScenario("RC-051")!;
    const body = "Give me another chance. Go out with me.";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-stop",
    );
    const draft = perfectDraft(body, 1);
    draft.safety = {
      severity: "stop",
      confidence: "high",
      codes: ["continued_after_refusal"],
      evidence: [
        {
          turn: 1,
          excerpt: body,
          reason: "The user keeps soliciting after a refusal.",
        },
      ],
    };
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });
    expect(result.hardGate.severity).toBe("stop");
    expect(result.hardGate.maxScore).toBe(2);
    expect(result.finalScore).toBe(2);
  });

  it("forces a boundary outcome from a model-classified safety stop", () => {
    const scenario = getScenario("RC-040")!;
    const response = { turn: 1 as const, body: "u dtf" };
    const attempt = attemptFromResponses(
      scenario,
      [
        response,
        { turn: 2, body: "lowk i just tryna bang" },
        { turn: 3, body: "we can talk then bang" },
      ],
      "attempt-production-regression",
    );
    const draft = perfectDraft(response.body, 1, "date_agreed");
    draft.safety = {
      severity: "stop",
      confidence: "high",
      codes: ["directed_sexual_pressure"],
      evidence: [
        {
          turn: 1,
          excerpt: response.body,
          reason: "The line directs sexual pressure at the persona.",
        },
      ],
    };

    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });
    expect(result.outcome.code).toBe("boundary_crossed");
    expect(result.finalScore).toBe(2);
    expect(result.verdict).toBe("FUMBLED");
  });

  it("does not hard-stop a low-confidence safety classification", () => {
    const scenario = getScenario("RC-040")!;
    const body = "maybe we get into some trouble later lol";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-ambiguous-safety",
    );
    const draft = perfectDraft(body, 1, "date_invited");
    draft.safety = {
      severity: "stop",
      confidence: "medium",
      codes: ["ambiguous_pressure"],
      evidence: [
        {
          turn: 1,
          excerpt: body,
          reason: "The meaning is ambiguous and not clearly directed pressure.",
        },
      ],
    };

    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });

    expect(result.hardGate.severity).toBe("cap");
    expect(result.finalScore).toBe(4);
    expect(result.outcome.code).not.toBe("boundary_crossed");
  });

  it("caps a model-classified violation at four", () => {
    const scenario = getScenario("RC-001")!;
    const body = "You are not that pretty, but give me your number.";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-cap",
    );
    const draft = perfectDraft(body, 1);
    draft.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult_or_negging"],
      evidence: [
        { turn: 1, excerpt: body, reason: "The response uses an insult as leverage." },
      ],
    };
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });
    expect(result.hardGate.severity).toBe("cap");
    expect(result.hardGate.maxScore).toBe(4);
    expect(result.finalScore).toBe(4);
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

  it("rejects invented evidence turns and unsupported contact outcomes", () => {
    const scenario = getScenario("RC-001")!;
    const response = { turn: 1 as const, body: "Hello there." };
    const attempt = attemptFromResponses(scenario, [response], "attempt-invalid");
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: perfectDraft("server-owned transcript text", 2),
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

  it("rejects inconsistent or fabricated safety metadata", () => {
    const scenario = getScenario("RC-001")!;
    const body = "That ramen tote is elite.";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-invalid-safety",
    );

    const missingEvidence = perfectDraft(body, 1);
    missingEvidence.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult"],
      evidence: [],
    };
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: missingEvidence,
      }),
    ).toThrow(/safety/i);

    const nonexistentTurnEvidence = perfectDraft(body, 1);
    nonexistentTurnEvidence.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult"],
      evidence: [
        {
          turn: 2,
          excerpt: "server-owned transcript text",
          reason: "This user turn does not exist.",
        },
      ],
    };
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: nonexistentTurnEvidence,
      }),
    ).toThrow(/safety/i);

    const strayNoneMetadata = perfectDraft(body, 1);
    strayNoneMetadata.safety = {
      severity: "none",
      confidence: "high",
      codes: ["should_not_exist"],
      evidence: [],
    };
    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft: strayNoneMetadata,
      }),
    ).toThrow(/safety/i);
  });

  it("deduplicates model safety codes", () => {
    const scenario = getScenario("RC-001")!;
    const body = "That line was unnecessarily rude.";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-duplicate-safety-codes",
    );
    const draft = perfectDraft(body, 1);
    draft.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult", "insult"],
      evidence: [
        {
          turn: 1,
          excerpt: body,
          reason: "The model classified the line as an insult.",
        },
      ],
    };

    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });

    expect(result.hardGate.codes).toEqual(["insult"]);
  });

  it("rejects outcome evidence that references no real user turn", () => {
    const scenario = getScenario("RC-001")!;
    const body = "That ramen tote is elite.";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-persona-evidence",
    );
    const draft = perfectDraft(body, 1);
    draft.outcome.basis = [
      {
        turn: 2,
        excerpt: "Invented evidence from a turn the user never authored.",
        reason: "A nonexistent user turn cannot support the outcome.",
      },
    ];

    expect(() =>
      finalizeJudgeResult({
        attemptId: attempt.id,
        scenario,
        attempt,
        draft,
      }),
    ).toThrow(/outcome evidence/i);
  });

  it("accepts a model-owned graceful exit without magic exit phrases", () => {
    const scenario = getScenario("RC-051")!;
    const body = "yea i dont feel well tbh i think i shd go home";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body }],
      "attempt-natural-exit",
    );
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft: perfectDraft(body, 1, "graceful_exit"),
    });

    expect(result.outcome.code).toBe("graceful_exit");
  });

  it("applies a cap after model scoring rather than trusting model totals", () => {
    const scenario = getScenario("RC-001")!;
    const response = {
      turn: 1 as const,
      body: "You are not that pretty, but the ramen tote is okay.",
    };
    const attempt = attemptFromResponses(scenario, [response], "attempt-capped");
    const draft = perfectDraft(response.body, 1);
    draft.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult_or_negging"],
      evidence: [
        {
          turn: 1,
          excerpt: response.body,
          reason: "The model classified this as an insulting response.",
        },
      ],
    };
    const result = finalizeJudgeResult({
      attemptId: attempt.id,
      scenario,
      attempt,
      draft,
    });
    expect(result.rawScore).toBe(10);
    expect(result.finalScore).toBe(4);
    expect(result.verdict).toBe("COOKED");
  });
});
