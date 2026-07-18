import { describe, expect, it } from "vitest";
import { fixturePersonaProvider } from "./provider";
import { selectPersonaProvider } from "../runtime";
import { POST } from "../../src/app/api/[...path]/route";
import { personaConversationStore } from "./store";

describe("persona provider selection", () => {
  it("allows the fixture provider only outside production", () => {
    expect(
      selectPersonaProvider(undefined, {
        NODE_ENV: "test",
        RIZZCODE_MOCK_PERSONA: "1",
      }),
    ).toBe(fixturePersonaProvider);
    expect(
      selectPersonaProvider(undefined, {
        NODE_ENV: "production",
        RIZZCODE_MOCK_PERSONA: "1",
      }),
    ).toBeUndefined();
  });

  it("uses an explicitly injected provider in every environment", () => {
    expect(
      selectPersonaProvider(fixturePersonaProvider, {
        NODE_ENV: "production",
      }),
    ).toBe(fixturePersonaProvider);
  });

  it("keeps prepared persona text out of the browser response", async () => {
    const response = await POST(
      new Request("http://127.0.0.1/api/persona/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: "1.0",
          attemptId: "attempt-route-prepare",
          scenarioId: "RC-035",
          turn: 1,
          body: "What happened next?",
        }),
      }),
      { params: Promise.resolve({ path: ["persona", "prepare"] }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, prepared: true });
    expect(payload).not.toHaveProperty("reply");
  });

  it("restores every turn and judgment from a signed receipt", async () => {
    const attemptId = "attempt-signed-route";
    const responses = [
      "That ramen tote is elite. Is it a recommendation or a warning?",
      "Spicy miso wins for me. What is your serious ruling?",
      "This was fun. Want to swap numbers and continue the ramen tribunal?",
    ];
    let sessionToken: string | undefined;

    for (const [index, body] of responses.entries()) {
      personaConversationStore.clear();
      const response = await POST(
        new Request("http://127.0.0.1/api/persona", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schemaVersion: "1.0",
            attemptId,
            scenarioId: "RC-001",
            turn: index + 1,
            body,
            sessionToken,
          }),
        }),
        { params: Promise.resolve({ path: ["persona"] }) },
      );
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        ok: true,
        attemptId,
        turn: index + 1,
      });
      expect(payload.sessionToken).toEqual(expect.any(String));
      sessionToken = payload.sessionToken;
    }

    personaConversationStore.clear();
    const previousMock = process.env.RIZZCODE_MOCK_JUDGE;
    process.env.RIZZCODE_MOCK_JUDGE = "1";
    try {
      const response = await POST(
        new Request("http://127.0.0.1/api/judge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schemaVersion: "1.0",
            attemptId,
            scenarioId: "RC-001",
            responses: responses.map((body, index) => ({
              turn: index + 1,
              body,
            })),
            sessionToken,
          }),
        }),
        { params: Promise.resolve({ path: ["judge"] }) },
      );
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.result.rubric).toHaveLength(5);
    } finally {
      if (previousMock === undefined) {
        delete process.env.RIZZCODE_MOCK_JUDGE;
      } else {
        process.env.RIZZCODE_MOCK_JUDGE = previousMock;
      }
    }
  });
});
