import { describe, expect, it } from "vitest";
import { OUTCOME_LABELS } from "./constants";
import type { JudgeApiResponse, JudgeRequest } from "./types";
import { validateJudgeApiResponse } from "./validation";

const request: JudgeRequest = {
  schemaVersion: "1.0",
  attemptId: "attempt-1",
  scenarioId: "coffee-line",
  responses: [
    { turn: 1, body: "That pastry looks elite." },
    { turn: 2, body: "What makes it your favorite?" },
    { turn: 3, body: "Want to compare notes over coffee Thursday?" },
  ],
};

const criteria = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
] as const;

function response(): JudgeApiResponse {
  return {
    ok: true,
    result: {
      schemaVersion: "1.0",
      attemptId: "attempt-1",
      mode: "llm",
      hardGate: {
        triggered: false,
        severity: "none",
        codes: [],
        maxScore: 10,
        evidence: [],
      },
      rubric: criteria.map((id) => ({
        id,
        score: 2,
        evidence: {
          turn: 1,
          excerpt: "pastry",
          reason: "Grounded in the transcript.",
        },
        feedback: "Clear and grounded.",
      })),
      rawScore: 10,
      finalScore: 10,
      verdict: "ATE",
      worked: ["Specific opener"],
      improve: ["Keep listening"],
      betterResponse: "That pastry looks elite. What makes it your favorite?",
      outcome: {
        code: "date_invited",
        label: "Date invited",
        confidence: "medium",
        basis: [
          {
            turn: 3,
            excerpt: "coffee Thursday",
            reason: "A specific invitation was made.",
          },
        ],
      },
    },
  };
}

describe("judge response trust boundary", () => {
  it("accepts a mechanically consistent, transcript-backed response", () => {
    expect(validateJudgeApiResponse(response(), request)).not.toBeNull();
  });

  it("accepts every canonical scenario outcome code", () => {
    for (const [code, label] of Object.entries(OUTCOME_LABELS)) {
      const payload = response();
      if (payload.ok) {
        payload.result.outcome.code = code as keyof typeof OUTCOME_LABELS;
        payload.result.outcome.label = label;
      }

      expect(validateJudgeApiResponse(payload, request)).not.toBeNull();
    }
  });

  it("rejects a result for another attempt", () => {
    const payload = response();
    if (payload.ok) payload.result.attemptId = "attempt-2";

    expect(validateJudgeApiResponse(payload, request)).toBeNull();
  });

  it("rejects score arithmetic and evidence not backed by the request", () => {
    const badScore = response();
    if (badScore.ok) badScore.result.finalScore = 9;
    expect(validateJudgeApiResponse(badScore, request)).toBeNull();

    const badEvidence = response();
    if (badEvidence.ok) {
      badEvidence.result.rubric[0].evidence.excerpt = "not in transcript";
    }
    expect(validateJudgeApiResponse(badEvidence, request)).toBeNull();
  });
});
