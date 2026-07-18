import type {
  Attempt,
  ConversationTurn,
  PersonaReply,
  Scenario,
} from "../../src/domain/types";
import { MAX_DRAFT_PREPARATIONS_PER_TURN } from "../../src/domain/constants";
import {
  applyPersonaReply,
  beginTurn,
  createAttempt,
  userResponses,
} from "../../src/engine/conversationEngine";

type StoredTurn = {
  body: string;
  reply: PersonaReply;
  usedFallback: boolean;
};

export type PreparedPersonaTurn = StoredTurn & {
  turn: ConversationTurn;
};

type ConversationRecord = {
  attempt: Attempt;
  turns: Map<ConversationTurn, StoredTurn>;
  preparationCounts: Map<ConversationTurn, number>;
  prepared?: PreparedPersonaTurn;
  touchedAt: number;
};

function cloneAttempt(attempt: Attempt): Attempt {
  return structuredClone(attempt);
}

function cloneReply(reply: PersonaReply): PersonaReply {
  return structuredClone(reply);
}

export class PersonaConversationStore {
  private readonly records = new Map<string, ConversationRecord>();

  constructor(
    private readonly maxRecords = 500,
    private readonly ttlMs = 1000 * 60 * 60 * 6,
  ) {}

  private prune(now = Date.now()) {
    for (const [id, record] of this.records) {
      if (now - record.touchedAt > this.ttlMs) this.records.delete(id);
    }
    while (this.records.size > this.maxRecords) {
      const oldest = this.records.keys().next().value;
      if (!oldest) break;
      this.records.delete(oldest);
    }
  }

  private recordFor(scenario: Scenario, attemptId: string): ConversationRecord {
    this.prune();
    const existing = this.records.get(attemptId);
    if (existing) {
      if (existing.attempt.scenarioId !== scenario.id) {
        throw new Error("persona_conflict: attempt belongs to another scenario");
      }
      existing.touchedAt = Date.now();
      return existing;
    }
    const record: ConversationRecord = {
      attempt: createAttempt(scenario, attemptId, "server-persona"),
      turns: new Map(),
      preparationCounts: new Map(),
      touchedAt: Date.now(),
    };
    this.records.set(attemptId, record);
    this.prune();
    return record;
  }

  hydrateAttempt(attempt: Attempt): void {
    this.prune();
    const existing = this.records.get(attempt.id);
    if (existing) {
      if (existing.attempt.scenarioId !== attempt.scenarioId) {
        throw new Error("persona_conflict: attempt belongs to another scenario");
      }
      if (existing.attempt.userTurn >= attempt.userTurn) {
        existing.touchedAt = Date.now();
        return;
      }
    }
    this.records.set(attempt.id, {
      attempt: cloneAttempt(attempt),
      turns: new Map(),
      preparationCounts: new Map(),
      touchedAt: Date.now(),
    });
    this.prune();
  }

  inspectTurn(
    scenario: Scenario,
    attemptId: string,
    turn: ConversationTurn,
    body: string,
  ):
    | { kind: "new"; attempt: Attempt }
    | { kind: "stored"; reply: PersonaReply; usedFallback: boolean } {
    const record = this.recordFor(scenario, attemptId);
    const stored = record.turns.get(turn);
    if (stored) {
      if (stored.body !== body) {
        throw new Error("persona_conflict: turn already used with different text");
      }
      return {
        kind: "stored",
        reply: cloneReply(stored.reply),
        usedFallback: stored.usedFallback,
      };
    }
    if (record.attempt.personaState.terminal) {
      throw new Error("persona_conflict: conversation already ended");
    }
    if (turn !== record.attempt.userTurn + 1) {
      throw new Error("persona_conflict: turn is not contiguous");
    }
    return { kind: "new", attempt: cloneAttempt(record.attempt) };
  }

  commitTurn(input: {
    scenario: Scenario;
    attemptId: string;
    turn: ConversationTurn;
    body: string;
    reply: PersonaReply;
    usedFallback: boolean;
  }): Attempt {
    const record = this.recordFor(input.scenario, input.attemptId);
    const existing = record.turns.get(input.turn);
    if (existing) {
      if (existing.body !== input.body) {
        throw new Error("persona_conflict: turn already committed");
      }
      return cloneAttempt(record.attempt);
    }
    if (input.turn !== record.attempt.userTurn + 1) {
      throw new Error("persona_conflict: turn changed before commit");
    }
    const withUser = beginTurn(record.attempt, input.body, "server-persona");
    record.attempt = applyPersonaReply(
      withUser,
      input.reply,
      "server-persona",
    );
    record.turns.set(input.turn, {
      body: input.body,
      reply: cloneReply(input.reply),
      usedFallback: input.usedFallback,
    });
    if (record.prepared?.turn === input.turn) record.prepared = undefined;
    record.touchedAt = Date.now();
    return cloneAttempt(record.attempt);
  }

  getPrepared(
    scenario: Scenario,
    attemptId: string,
    turn: ConversationTurn,
    body: string,
  ): PreparedPersonaTurn | undefined {
    const record = this.recordFor(scenario, attemptId);
    const prepared = record.prepared;
    if (
      !prepared ||
      prepared.turn !== turn ||
      prepared.body !== body
    ) {
      return undefined;
    }
    return {
      ...prepared,
      reply: cloneReply(prepared.reply),
    };
  }

  savePrepared(input: {
    scenario: Scenario;
    attemptId: string;
    turn: ConversationTurn;
    body: string;
    reply: PersonaReply;
    usedFallback: boolean;
  }): boolean {
    const record = this.recordFor(input.scenario, input.attemptId);
    if (
      record.attempt.personaState.terminal ||
      record.attempt.userTurn + 1 !== input.turn ||
      record.turns.has(input.turn)
    ) {
      return false;
    }
    record.prepared = {
      turn: input.turn,
      body: input.body,
      reply: cloneReply(input.reply),
      usedFallback: input.usedFallback,
    };
    record.touchedAt = Date.now();
    return true;
  }

  reservePreparation(
    scenario: Scenario,
    attemptId: string,
    turn: ConversationTurn,
  ): boolean {
    const record = this.recordFor(scenario, attemptId);
    const count = record.preparationCounts.get(turn) ?? 0;
    if (
      count >= MAX_DRAFT_PREPARATIONS_PER_TURN ||
      record.attempt.personaState.terminal ||
      record.attempt.userTurn + 1 !== turn ||
      record.turns.has(turn)
    ) {
      return false;
    }
    record.preparationCounts.set(turn, count + 1);
    record.touchedAt = Date.now();
    return true;
  }

  getAttempt(attemptId: string, scenarioId: string): Attempt | undefined {
    this.prune();
    const record = this.records.get(attemptId);
    if (!record || record.attempt.scenarioId !== scenarioId) return undefined;
    record.touchedAt = Date.now();
    return cloneAttempt(record.attempt);
  }

  prepareForJudgment(
    attemptId: string,
    scenarioId: string,
  ): Attempt | undefined {
    this.prune();
    const record = this.records.get(attemptId);
    if (!record || record.attempt.scenarioId !== scenarioId) return undefined;
    record.attempt = {
      ...record.attempt,
      status: "awaiting_judgment",
      personaState: { ...record.attempt.personaState, terminal: true },
    };
    record.prepared = undefined;
    record.touchedAt = Date.now();
    return cloneAttempt(record.attempt);
  }

  responsesMatch(
    attemptId: string,
    scenarioId: string,
    responses: ReturnType<typeof userResponses>,
  ): boolean {
    const attempt = this.getAttempt(attemptId, scenarioId);
    if (!attempt) return false;
    const canonical = userResponses(attempt);
    return (
      canonical.length === responses.length &&
      canonical.every(
        (response, index) =>
          response.turn === responses[index]?.turn &&
          response.body === responses[index]?.body,
      )
    );
  }

  clear() {
    this.records.clear();
  }
}

export const personaConversationStore = new PersonaConversationStore();
