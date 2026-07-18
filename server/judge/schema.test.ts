import { describe, expect, it } from "vitest";
import { JudgeRequestSchema } from "./schema";

describe("judge request boundary", () => {
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
