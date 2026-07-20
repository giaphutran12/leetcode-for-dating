import { describe, expect, it, vi } from "vitest";
import type { ConversationEvent } from "./conversationLog";
import { writeConversationEvent } from "./conversationPersistence";

function event(): ConversationEvent {
  return {
    event: "persona.turn.completed",
    attemptId: "attempt-persist",
    scenarioId: "RC-040",
    userId: "c9f8380b-b05c-4b9d-bd2a-7afc9f5c4b2c",
    model: "gpt-5.4-nano",
    turn: 1,
    usedFallback: false,
    conversation: [
      {
        id: "message-user",
        turn: 1,
        speaker: "you",
        body: "Want to grab coffee Tuesday?",
        kind: "text",
        sequence: 0,
        createdAt: "2026-07-20T00:00:00.000Z",
      },
      {
        id: "message-persona",
        turn: 1,
        speaker: "her",
        body: "Tuesday works.",
        kind: "text",
        sequence: 1,
        createdAt: "2026-07-20T00:00:01.000Z",
      },
    ],
    personaState: {
      engagement: "warm",
      boundary: "none",
      terminal: false,
    },
    details: { reply: { terminalReason: null } },
  };
}

describe("conversation persistence", () => {
  it("stores the complete transcript, persona reply details, and authenticated user", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });

    await writeConversationEvent({ from } as never, event());

    expect(from).toHaveBeenCalledWith("rizzcode_conversation_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt_id: "attempt-persist",
        scenario_id: "RC-040",
        user_id: "c9f8380b-b05c-4b9d-bd2a-7afc9f5c4b2c",
        event_type: "persona.turn.completed",
        conversation: expect.arrayContaining([
          expect.objectContaining({ body: "Tuesday works.", speaker: "her" }),
        ]),
        details: { reply: { terminalReason: null } },
      }),
    );
  });
});
