import { describe, expect, it } from "vitest";
import { getScenario } from "../src/data/scenarios";
import { createAttempt } from "../src/engine/conversationEngine";
import {
  signConversationSession,
  verifyConversationSession,
} from "./session";

describe("signed conversation receipts", () => {
  it("round-trips a canonical attempt and rejects tampering", () => {
    const scenario = getScenario("spark-bus-stop");
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const attempt = createAttempt(
      scenario,
      "attempt-session",
      "2026-07-18T00:00:00.000Z",
    );
    const token = signConversationSession(attempt);
    expect(verifyConversationSession(token)).toEqual(attempt);

    const [payload, signature] = token.split(".");
    const tamperedPayload = `${payload.slice(0, -1)}${
      payload.endsWith("A") ? "B" : "A"
    }`;
    expect(() =>
      verifyConversationSession(`${tamperedPayload}.${signature}`),
    ).toThrow(/invalid/i);
  });
});
