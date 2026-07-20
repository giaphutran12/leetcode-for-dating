import { describe, expect, it, vi } from "vitest";
import { scenarios } from "../../src/data/scenarios";
import type { PersonaRequest } from "../../src/domain/types";
import {
  fixturePersonaProvider,
  type PersonaProvider,
} from "./provider";
import type { PersonaModelDraft } from "./schema";
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

function modelDraft(
  overrides: Partial<PersonaModelDraft> = {},
): PersonaModelDraft {
  const actions = overrides.actions ?? [{ kind: "text", body: "okay" }];
  const text =
    actions.find((action) => action.kind === "text")?.body ?? "okay";
  return {
    actions,
    move: "reveal",
    contribution: text.split("?")[0]?.trim() || text,
    interestChange: "same",
    energyChange: "same",
    callbackSeed: null,
    callbackUsed: null,
    boundary: "none",
    terminalReason: null,
    ...overrides,
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

  it.each(["gooning to u", "i wanna eat ur puss"])(
    "ends immediately for the RC-035 production phrase %s",
    async (body) => {
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
        request(`attempt-hard-boundary-${body}`, "RC-035", 1, body),
      );

      expect(calls).toBe(0);
      expect(result).toMatchObject({
        ok: true,
        reply: {
          move: "close",
          state: {
            engagement: "closed",
            boundary: "explicit",
            terminal: true,
          },
          terminalReason: "boundary",
        },
      });
    },
  );

  it("falls back when structurally valid output has no text action", async () => {
    const reactionOnlyProvider: PersonaProvider = {
      async generate() {
        return modelDraft({
          actions: [{ kind: "reaction", body: "👀" }],
        });
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
        return modelDraft({
          actions: [{ kind: "text", body: "okay" }],
          terminalReason: "completed",
        });
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
        return modelDraft({
          actions: [{ kind: "text", body: "okay" }],
          move:
            turn === 6
              ? "close"
              : turn % 2 === 0
                ? "pivot"
                : "reveal",
          boundary: turn === 6 ? "explicit" : "none",
        });
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

  it("blocks the RC-035 validate-and-question loop on consecutive turns", async () => {
    const provider: PersonaProvider = {
      async generate({ turn }) {
        if (turn === 1) {
          return modelDraft({
            actions: [
              {
                kind: "text",
                body: "that commute was brutal. what helped you get through it?",
              },
            ],
            move: "reveal",
            contribution: "that commute was brutal.",
          });
        }
        return modelDraft({
          actions: [
            {
              kind: "text",
              body: "debugging sounds intense. what kind of bug was it?",
            },
          ],
          move: "tease",
          contribution: "debugging sounds intense.",
        });
      },
    };
    const service = new PersonaService(
      new PersonaConversationStore(),
      provider,
    );

    const first = await service.respond(
      request(
        "attempt-rc035-question-loop",
        "RC-035",
        1,
        "lowk i just keep going till it clicks",
      ),
    );
    expect(first).toMatchObject({
      ok: true,
      usedFallback: false,
      reply: {
        move: "reveal",
        state: { questionStreak: 1 },
      },
    });

    const second = await service.respond(
      request(
        "attempt-rc035-question-loop",
        "RC-035",
        2,
        "mostly work stuff, i do software engineering",
      ),
    );
    expect(second).toMatchObject({
      ok: true,
      usedFallback: true,
      reply: {
        state: { questionStreak: 0 },
      },
    });
    if (second.ok) {
      expect(
        second.reply.actions
          .filter((action) => action.kind === "text")
          .map((action) => action.body)
          .join(" "),
      ).not.toContain("?");
    }
  });

  it("rejects question-only replies that contribute no new handle", async () => {
    const service = new PersonaService(new PersonaConversationStore(), {
      async generate() {
        return modelDraft({
          actions: [{ kind: "text", body: "tell me what happened next" }],
          move: "pivot",
          contribution: "tell me what happened next",
        });
      },
    });

    const result = await service.respond(
      request("attempt-question-only", "RC-035"),
    );
    expect(result).toMatchObject({ ok: true, usedFallback: true });
  });

  it("tracks move diversity, energy, and delayed callback seeds", async () => {
    const provider: PersonaProvider = {
      async generate({ turn }) {
        if (turn === 1) {
          return modelDraft({
            actions: [
              {
                kind: "text",
                body: "naps are basically a reset button.",
              },
            ],
            move: "reveal",
            contribution: "naps are basically a reset button.",
            energyChange: "up",
            callbackSeed: "50% buff",
          });
        }
        return modelDraft({
          actions: [
            {
              kind: "text",
              body: "“50% buff” is such an engineer way to describe a nap.",
            },
          ],
          move: "callback",
          contribution:
            "“50% buff” is such an engineer way to describe a nap.",
          callbackUsed: "50% buff",
        });
      },
    };
    const store = new PersonaConversationStore();
    const service = new PersonaService(store, provider);

    const first = await service.respond(
      request(
        "attempt-rc035-callback",
        "RC-035",
        1,
        "i nap and come back with a 50% buff",
      ),
    );
    expect(first).toMatchObject({
      ok: true,
      usedFallback: false,
      reply: {
        move: "reveal",
        state: {
          energy: "high",
          recentMoves: ["reveal"],
          callbackSeeds: ["50% buff"],
        },
      },
    });

    const second = await service.respond(
      request(
        "attempt-rc035-callback",
        "RC-035",
        2,
        "exactly lol",
      ),
    );
    expect(second).toMatchObject({
      ok: true,
      usedFallback: false,
      reply: {
        move: "callback",
        state: {
          energy: "high",
          recentMoves: ["reveal", "callback"],
          callbackSeeds: ["50% buff"],
        },
      },
    });
  });

  it("rejects repeated primary moves and falls back to a different move", async () => {
    const service = new PersonaService(new PersonaConversationStore(), {
      async generate() {
        return modelDraft({
          actions: [{ kind: "text", body: "i have a story like that too." }],
          move: "reveal",
          contribution: "i have a story like that too.",
        });
      },
    });

    const first = await service.respond(
      request("attempt-move-variety", "RC-035", 1, "that was my day"),
    );
    const second = await service.respond(
      request("attempt-move-variety", "RC-035", 2, "same thing tomorrow"),
    );
    expect(first).toMatchObject({
      ok: true,
      usedFallback: false,
      reply: { move: "reveal" },
    });
    expect(second).toMatchObject({
      ok: true,
      usedFallback: true,
      reply: { move: "pivot" },
    });
  });
});
