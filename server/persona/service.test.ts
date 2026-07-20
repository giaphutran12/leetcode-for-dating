import { describe, expect, it, vi } from "vitest";
import { scenarios } from "../../src/data/scenarios";
import type { PersonaRequest } from "../../src/domain/types";
import {
  fixturePersonaProvider,
  type PersonaProvider,
} from "./provider";
import { PersonaService } from "./service";
import { PersonaConversationStore } from "./store";

function request(
  attemptId: string,
  scenarioId: string,
  turn: PersonaRequest["turn"] = 1,
  body = "That detail is funny. What happened next?",
): PersonaRequest {
  return {
    schemaVersion: "1.0",
    attemptId,
    scenarioId,
    turn,
    body,
  };
}

describe("adaptive persona service", () => {
  it("generates a causally different playable first turn for all 67 scenarios", async () => {
    for (const scenario of scenarios) {
      const service = new PersonaService(
        new PersonaConversationStore(),
        fixturePersonaProvider,
      );
      const result = await service.respond(
        request(`attempt-${scenario.id}`, scenario.id),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.reply.actions.some((action) => action.kind === "text")).toBe(
        true,
      );
      expect(result.turn).toBe(1);
    }
  });

  it("deduplicates the same turn and rejects changed or skipped text", async () => {
    const service = new PersonaService(
      new PersonaConversationStore(),
      fixturePersonaProvider,
    );
    const firstRequest = request(
      "attempt-idempotent",
      "RC-001",
    );
    const [first, duplicate] = await Promise.all([
      service.respond(firstRequest),
      service.respond(firstRequest),
    ]);
    expect(first).toEqual(duplicate);

    const changed = await service.respond({
      ...firstRequest,
      body: "different text",
    });
    expect(changed).toMatchObject({
      ok: false,
      code: "persona_conflict",
    });
    const skipped = await service.respond({
      ...firstRequest,
      attemptId: "attempt-skipped",
      turn: 2,
    });
    expect(skipped).toMatchObject({
      ok: false,
      code: "persona_conflict",
    });
  });

  it("does not share an in-flight turn across scenarios", async () => {
    const service = new PersonaService(
      new PersonaConversationStore(),
      fixturePersonaProvider,
    );
    const first = service.respond(
      request("attempt-cross-scenario", "RC-001"),
    );
    const conflicting = await service.respond(
      request("attempt-cross-scenario", "RC-035"),
    );
    expect((await first).ok).toBe(true);
    expect(conflicting).toMatchObject({
      ok: false,
      code: "persona_conflict",
    });
  });

  it("uses an authored fallback without pretending it came from the model", async () => {
    const failingProvider: PersonaProvider = {
      async generate() {
        throw new Error("provider offline");
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      failingProvider,
    );
    const result = await service.respond(
      request("attempt-fallback", "RC-001"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedFallback).toBe(true);
      expect(result.reply.actions).toHaveLength(1);
    }
  });

  it("ends immediately on directed sexual pressure without calling the model", async () => {
    let calls = 0;
    const provider: PersonaProvider = {
      async generate(input) {
        calls += 1;
        return fixturePersonaProvider.generate(input);
      },
    };
    const store = new PersonaConversationStore();
    const service = new PersonaService(store, provider);
    const result = await service.respond(
      request("attempt-hard-boundary", "RC-040", 1, "u dtf"),
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      usedFallback: false,
      reply: {
        interestChange: "down",
        state: {
          engagement: "closed",
          boundary: "explicit",
          terminal: true,
        },
        terminalReason: "boundary",
      },
    });
    expect(
      store.getAttempt("attempt-hard-boundary", "RC-040")?.userTurn,
    ).toBe(1);
  });

  it("falls back when structurally valid output has no text action", async () => {
    const reactionOnlyProvider: PersonaProvider = {
      async generate() {
        return {
          actions: [{ kind: "reaction", body: "👀" }],
          interestChange: "same",
          boundary: "none",
          terminalReason: null,
        };
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      reactionOnlyProvider,
    );
    const result = await service.respond(
      request("attempt-reaction-only", "RC-001"),
    );
    expect(result).toMatchObject({ ok: true, usedFallback: true });
  });

  it("prepares an idle draft without committing and reuses it on send", async () => {
    let calls = 0;
    const provider: PersonaProvider = {
      async generate(input) {
        calls += 1;
        return fixturePersonaProvider.generate(input);
      },
    };
    const store = new PersonaConversationStore();
    const service = new PersonaService(store, provider);
    const draft = request("attempt-prepared", "RC-035");

    const prepared = await service.prepare(draft);
    expect(prepared.ok).toBe(true);
    expect(
      store.getAttempt(draft.attemptId, draft.scenarioId)?.userTurn,
    ).toBe(0);

    const sent = await service.respond(draft);
    expect(sent.ok).toBe(true);
    expect(calls).toBe(1);
    expect(
      store.getAttempt(draft.attemptId, draft.scenarioId)?.userTurn,
    ).toBe(1);
  });

  it("does not log an unsent draft when background preparation fails", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = new PersonaService(new PersonaConversationStore(), {
      async generate() {
        throw new Error("provider offline");
      },
    });

    const result = await service.prepare(
      request("attempt-unsent-draft", "RC-035", 1, "unfinished draft"),
    );

    expect(result.ok).toBe(true);
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("never commits a stale prepared reply after the draft changes", async () => {
    let calls = 0;
    const provider: PersonaProvider = {
      async generate(input) {
        calls += 1;
        return fixturePersonaProvider.generate(input);
      },
    };
    const store = new PersonaConversationStore();
    const service = new PersonaService(store, provider);
    const original = request(
      "attempt-edited-draft",
      "RC-035",
      1,
      "first draft",
    );
    await service.prepare(original);
    const sent = await service.respond({
      ...original,
      body: "edited final draft",
    });

    expect(sent.ok).toBe(true);
    expect(calls).toBe(2);
    expect(
      store
        .getAttempt(original.attemptId, original.scenarioId)
        ?.messages.find((message) => message.speaker === "you")?.body,
    ).toBe("edited final draft");
  });

  it("caps idle draft generations while keeping the real send available", async () => {
    let calls = 0;
    const provider: PersonaProvider = {
      async generate(input) {
        calls += 1;
        return fixturePersonaProvider.generate(input);
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      provider,
    );
    const base = request(
      "attempt-preparation-cap",
      "RC-035",
    );
    for (const body of ["draft one", "draft two", "draft three"]) {
      expect((await service.prepare({ ...base, body })).ok).toBe(true);
    }
    expect(
      await service.prepare({ ...base, body: "draft four" }),
    ).toMatchObject({
      ok: false,
      code: "persona_conflict",
    });
    expect((await service.respond({ ...base, body: "final send" })).ok).toBe(
      true,
    );
    expect(calls).toBe(4);
  });

  it("does not let completed end the exchange before turn three", async () => {
    const eagerProvider: PersonaProvider = {
      async generate() {
        return {
          actions: [{ kind: "text", body: "okay" }],
          interestChange: "same",
          boundary: "none",
          terminalReason: "completed",
        };
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      eagerProvider,
    );
    const result = await service.respond(
      request("attempt-eager", "RC-001"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reply.terminalReason).toBeNull();
      expect(result.reply.state.terminal).toBe(false);
    }
  });

  it("preserves an existing boundary and always terminates at turn six", async () => {
    const store = new PersonaConversationStore();
    const service = new PersonaService(store, fixturePersonaProvider);
    for (const turn of [1, 2, 3, 4, 5, 6] as const) {
      const result = await service.respond(
        request(
          "attempt-six-turns",
          "RC-001",
          turn,
          turn === 1 ? "shut up" : `turn ${turn}`,
        ),
      );
      expect(result.ok).toBe(true);
      if (result.ok && turn === 6) {
        expect(result.reply.state.terminal).toBe(true);
        expect(result.reply.terminalReason).toBe("completed");
      }
    }
    expect(
      store.getAttempt("attempt-six-turns", "RC-001")?.userTurn,
    ).toBe(6);
  });

  it("does not overwrite a turn-six boundary with completed", async () => {
    const provider: PersonaProvider = {
      async generate({ turn }) {
        return {
          actions: [{ kind: "text", body: "okay" }],
          interestChange: "same",
          boundary: turn === 6 ? "explicit" : "none",
          terminalReason: null,
        };
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      provider,
    );
    for (const turn of [1, 2, 3, 4, 5, 6] as const) {
      const result = await service.respond(
        request("attempt-final-boundary", "RC-001", turn),
      );
      expect(result.ok).toBe(true);
      if (result.ok && turn === 6) {
        expect(result.reply.terminalReason).toBe("boundary");
      }
    }
  });
});
