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
        move: "reveal",
        contribution: "okay wait",
        interestChange: "up",
        energyChange: "up",
        callbackSeed: null,
        callbackUsed: null,
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(true);
  });

  it("accepts structurally valid output for semantic service validation", () => {
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [{ kind: "reaction", body: "👍" }],
        move: "reveal",
        contribution: "okay",
        interestChange: "same",
        energyChange: "same",
        callbackSeed: null,
        callbackUsed: null,
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
        move: "pivot",
        contribution: "where",
        interestChange: "same",
        energyChange: "same",
        callbackSeed: null,
        callbackUsed: null,
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(true);
  });

  it("requires a non-question contribution and a real callback seed", () => {
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [{ kind: "text", body: "what happened next?" }],
        move: "pivot",
        contribution: "what happened next?",
        interestChange: "same",
        energyChange: "same",
        callbackSeed: null,
        callbackUsed: null,
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(false);
    expect(
      PersonaModelDraftSchema.safeParse({
        actions: [{ kind: "text", body: "that 50% buff line was funny." }],
        move: "callback",
        contribution: "that 50% buff line was funny.",
        interestChange: "same",
        energyChange: "same",
        callbackSeed: null,
        callbackUsed: null,
        boundary: "none",
        terminalReason: null,
      }).success,
    ).toBe(false);
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
