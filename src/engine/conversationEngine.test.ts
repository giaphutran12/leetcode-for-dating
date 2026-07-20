import { describe, expect, it } from "vitest";
import { getScenario, scenarios } from "../data/scenarios";
import {
  attemptFromResponses,
  beginTurn,
  createAttempt,
  updateUserMessageDelivery,
  validateResponse,
} from "./conversationEngine";

describe("canonical scenario catalog", () => {
  it("contains exactly 67 fully playable scenarios across both modes", () => {
    expect(scenarios).toHaveLength(67);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(67);
    expect(scenarios.some((scenario) => scenario.mode === "in_person")).toBe(
      true,
    );
    expect(scenarios.some((scenario) => scenario.mode === "messaging")).toBe(
      true,
    );
    for (const scenario of scenarios) {
      expect(scenario.fallback.repliesByTurn[1].neutral).toBeTruthy();
      expect(scenario.fallback.repliesByTurn[2].neutral).toBeTruthy();
      expect(scenario.fallback.repliesByTurn[3].neutral).toBeTruthy();
    }
  });
});

describe("conversation state engine", () => {
  const scenario = getScenario("RC-001")!;

  it("starts a scene-only scenario at zero with no invented persona message", () => {
    const attempt = createAttempt(scenario, "attempt-scene");
    expect(attempt.userTurn).toBe(0);
    expect(attempt.messages).toEqual([]);
    expect(attempt.status).toBe("active");
  });

  it("accepts up to six authored turns and rejects a seventh mutation", () => {
    const attempt = attemptFromResponses(
      scenario,
      [1, 2, 3, 4, 5, 6].map((turn) => ({
        turn: turn as 1 | 2 | 3 | 4 | 5 | 6,
        body: turn === 1 ? "That ramen tote is elite." : "Spicy miso wins.",
      })),
      "attempt-six",
    );
    expect(attempt.userTurn).toBe(6);
    expect(attempt.messages.filter((message) => message.speaker === "you")).toHaveLength(
      6,
    );
    expect(attempt.messages.filter((message) => message.speaker === "her")).toHaveLength(
      6,
    );
    expect(attempt.status).toBe("awaiting_judgment");

    const seventh = beginTurn(attempt, "This must not appear");
    expect(seventh).toBe(attempt);
  });

  it("does not advance empty, whitespace, or 421-character input", () => {
    expect(validateResponse("")).toEqual({ ok: false, reason: "empty" });
    expect(validateResponse("   \n")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateResponse("a".repeat(421))).toEqual({
      ok: false,
      reason: "too_long",
    });
    expect(validateResponse(" hello ")).toEqual({
      ok: true,
      body: "hello",
    });
  });

  it("moves a sent message forward through delivered and seen without regression", () => {
    const sent = beginTurn(
      createAttempt(scenario, "attempt-delivery"),
      "hello",
    );
    expect(
      sent.messages.find((message) => message.speaker === "you")
        ?.deliveryStatus,
    ).toBe("sent");
    const delivered = updateUserMessageDelivery(sent, 1, "delivered");
    const seen = updateUserMessageDelivery(delivered, 1, "seen");
    expect(
      seen.messages.find((message) => message.speaker === "you")
        ?.deliveryStatus,
    ).toBe("seen");
    expect(updateUserMessageDelivery(seen, 1, "sent")).toBe(seen);
  });
});
