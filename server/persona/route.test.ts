import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { fixturePersonaProvider } from "./provider";
import {
  createPersonaPrepareRoute,
  selectPersonaProvider,
} from "./route";
import { PersonaService } from "./service";
import { PersonaConversationStore } from "./store";

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
    const route = createPersonaPrepareRoute(
      new PersonaService(
        new PersonaConversationStore(),
        fixturePersonaProvider,
      ),
    );
    let statusCode = 0;
    let payload: unknown;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    } as unknown as Response;

    await route(
      {
        body: {
          schemaVersion: "1.0",
          attemptId: "attempt-route-prepare",
          scenarioId: "connection-keep-thread",
          turn: 1,
          body: "What happened next?",
        },
      } as Request,
      response,
    );

    expect(statusCode).toBe(200);
    expect(payload).toMatchObject({ ok: true, prepared: true });
    expect(payload).not.toHaveProperty("reply");
  });
});
