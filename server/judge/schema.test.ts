import { describe, expect, it } from "vitest";
import { OUTCOME_LABELS } from "../../src/domain/constants";
import { JudgeModelDraftSchema, JudgeRequestSchema } from "./schema";

describe("judge request boundary", () => {
  it("accepts every outcome in the canonical catalog", () => {
    for (const code of Object.keys(OUTCOME_LABELS)) {
      const parsed = JudgeModelDraftSchema.safeParse({
        safety: {
          severity: "none",
          confidence: "high",
          codes: [],
          evidence: [],
        },
        rubric: [
          "context_naturalness",
          "reciprocity_listening",
          "playfulness_personality",
          "respect_calibration",
          "challenge_objective",
        ].map((id) => ({
          id,
          score: 1,
          evidence: { turn: 1, reason: "This user turn supports the score." },
          feedback: "Clear evidence.",
        })),
        worked: ["One strength"],
        improve: ["One improvement"],
        betterResponse: "Hello there.",
        outcome: {
          code,
          label: OUTCOME_LABELS[code as keyof typeof OUTCOME_LABELS],
          confidence: "medium",
          basis: [{ turn: 1, reason: "This user turn supports the outcome." }],
        },
      });
      expect(parsed.success, code).toBe(true);
    }
  });

  it("bounds structured safety metadata", () => {
    const evidence = { turn: 1, reason: "This user turn supports the result." };
    const base = {
      safety: {
        severity: "cap",
        confidence: "medium",
        codes: ["insult"],
        evidence: [evidence],
      },
      rubric: [
        "context_naturalness",
        "reciprocity_listening",
        "playfulness_personality",
        "respect_calibration",
        "challenge_objective",
      ].map((id) => ({
        id,
        score: 1,
        evidence,
        feedback: "Clear evidence.",
      })),
      worked: ["One strength"],
      improve: ["One improvement"],
      betterResponse: "Hello there.",
      outcome: {
        code: "conversation_continues",
        label: "Comfortable continuation",
        confidence: "medium",
        basis: [evidence],
      },
    };

    expect(JudgeModelDraftSchema.safeParse(base).success).toBe(true);
    expect(
      JudgeModelDraftSchema.safeParse({
        ...base,
        safety: { ...base.safety, codes: ["a", "b", "c", "d"] },
      }).success,
    ).toBe(false);
  });

  it("rejects model-copied excerpts because the server owns transcript text", () => {
    const evidence = {
      turn: 1,
      excerpt: "A nearly correct quote should not be part of this contract.",
      reason: "This user turn supports the result.",
    };
    const parsed = JudgeModelDraftSchema.safeParse({
      safety: {
        severity: "none",
        confidence: "high",
        codes: [],
        evidence: [],
      },
      rubric: [
        "context_naturalness",
        "reciprocity_listening",
        "playfulness_personality",
        "respect_calibration",
        "challenge_objective",
      ].map((id) => ({
        id,
        score: 1,
        evidence,
        feedback: "Clear evidence.",
      })),
      worked: ["One strength"],
      improve: ["One improvement"],
      betterResponse: "Hello there.",
      outcome: {
        code: "conversation_continues",
        label: "Comfortable continuation",
        confidence: "medium",
        basis: [evidence],
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-supplied score, XP, gates, and outcomes", () => {
    const parsed = JudgeRequestSchema.safeParse({
      schemaVersion: "1.0",
      attemptId: "attempt-authority",
      scenarioId: "RC-001",
      responses: [{ turn: 1, body: "Hello" }],
      score: 10,
      xp: 9999,
      hardGate: { triggered: false },
      outcome: "date_agreed",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires contiguous bounded turns", () => {
    expect(
      JudgeRequestSchema.safeParse({
        schemaVersion: "1.0",
        attemptId: "attempt-turns",
        scenarioId: "RC-001",
        responses: [{ turn: 2, body: "Skipped turn one" }],
      }).success,
    ).toBe(false);
    expect(
      JudgeRequestSchema.safeParse({
        schemaVersion: "1.0",
        attemptId: "attempt-long",
        scenarioId: "RC-001",
        responses: [{ turn: 1, body: "x".repeat(421) }],
      }).success,
    ).toBe(false);
  });
});
