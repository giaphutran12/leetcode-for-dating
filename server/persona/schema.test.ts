import { describe, expect, it } from "vitest";
import {
  PersonaModelDraftSchema,
  PersonaRequestSchema,
} from "./schema";

describe("persona schemas", () => {
  it("accepts a compact text plus reaction turn", () => {
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [
          { kind: "reaction", body: "👀" },
          {
            kind: "text",
            body: "okay wait, what did you have in mind?",
          },
        ],
        interestChange: "up",
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(true);
  });

  it("accepts structurally valid output for semantic service validation", () => {
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [{ kind: "reaction", body: "👍" }],
        interestChange: "same",
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(true);
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [
          {
            kind: "text",
            body: "where? when? why?",
          },
        ],
        interestChange: "same",
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(true);
  });

  it("rejects non-contiguous turn values and oversized dialogue", () => {
    expect(
      PersonaRequestSchema.safeParse({
        schemaVersion: "1.0",
        attemptId: "attempt-123",
        scenarioId: "RC-001",
        turn: 7,
        body: "hello",
      }).success,
    ).toBe(false);
    expect(
      PersonaRequestSchema.safeParse({
        schemaVersion: "1.0",
        attemptId: "attempt-123",
        scenarioId: "RC-001",
        turn: 1,
        body: "a".repeat(421),
      }).success,
    ).toBe(false);
  });
});
