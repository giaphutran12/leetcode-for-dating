import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logConversationEvent,
  modelErrorDetails,
} from "./conversationLog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("conversation logging", () => {
  it("emits one-line structured JSON with the full canonical conversation", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logConversationEvent("info", {
      event: "judge.started",
      attemptId: "attempt-log",
      scenarioId: "RC-001",
      model: "gpt-5.6-luna",
      conversation: [
        {
          id: "m1",
          turn: 1,
          speaker: "you",
          body: "yo",
          kind: "text",
          sequence: 0,
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          id: "m2",
          turn: 1,
          speaker: "her",
          body: "yo what's up",
          kind: "text",
          sequence: 1,
          createdAt: "2026-07-19T00:00:01.000Z",
        },
      ],
      personaState: {
        engagement: "neutral",
        boundary: "none",
        terminal: false,
      },
    });

    expect(info).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(info.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      service: "rizzcode-conversation",
      event: "judge.started",
      attemptId: "attempt-log",
      scenarioId: "RC-001",
      model: "gpt-5.6-luna",
    });
    expect(payload.conversation).toHaveLength(2);
    expect(payload).not.toHaveProperty("sessionToken");
  });

  it("captures bounded model text and nested validation causes", () => {
    const cause = Object.assign(new Error("schema parse failed"), {
      issues: [{ path: ["rubric"], message: "Expected 5 items" }],
    });
    const error = Object.assign(new Error("No object generated"), {
      text: "x".repeat(13_000),
      cause,
    });

    const details = modelErrorDetails(error);
    expect(String(details.text)).toHaveLength(12_000);
    expect(details.cause).toMatchObject({
      message: "schema parse failed",
      issues: [{ message: "Expected 5 items" }],
    });
  });
});
