import { getScenario } from "../../src/data/scenarios";
import {
  MAX_CONVERSATION_TURNS,
  MIN_CONVERSATION_TURNS,
} from "../../src/domain/constants";
import type {
  Attempt,
  Engagement,
  PersonaAction,
  PersonaErrorCode,
  PersonaReply,
  PersonaRequest,
} from "../../src/domain/types";
import {
  authoredFallbackReply,
  beginTurn,
} from "../../src/engine/conversationEngine";
import {
  aiSdkPersonaProvider,
  type PersonaProvider,
} from "./provider";
import type { PersonaModelDraft } from "./schema";
import {
  personaConversationStore,
  type PersonaConversationStore,
  type PreparedPersonaTurn,
} from "./store";
import {
  logConversationEvent,
  modelErrorDetails,
} from "../observability/conversationLog";

const engagementOrder: Engagement[] = ["closed", "low", "neutral", "warm"];
const boundaryOrder = ["none", "soft", "explicit"] as const;
const allowedReactions = new Set(["😂", "😭", "❤️", "👀", "👍", "✨"]);

function nextEngagement(
  current: Engagement,
  change: PersonaModelDraft["interestChange"],
): Engagement {
  const currentIndex = engagementOrder.indexOf(current);
  const delta = change === "up" ? 1 : change === "down" ? -1 : 0;
  return engagementOrder[
    Math.max(0, Math.min(engagementOrder.length - 1, currentIndex + delta))
  ];
}

function normalizeReply(
  draft: PersonaModelDraft,
  current: PersonaReply["state"],
  turn: PersonaRequest["turn"],
): PersonaReply {
  const boundary =
    boundaryOrder.indexOf(draft.boundary) <
    boundaryOrder.indexOf(current.boundary)
      ? current.boundary
      : draft.boundary;
  let terminalReason = draft.terminalReason;
  if (terminalReason === "completed" && turn < MIN_CONVERSATION_TURNS) {
    terminalReason = null;
  }
  if (boundary === "explicit") terminalReason = "boundary";
  if (turn === MAX_CONVERSATION_TURNS && terminalReason === null) {
    terminalReason = "completed";
  }
  const actions = draft.actions
    .filter(
      (action) =>
        action.kind === "text" || allowedReactions.has(action.body),
    )
    .map((action): PersonaAction => {
      const delayMs =
        action.kind === "reaction"
          ? 180
          : Math.min(800, 140 + action.body.length * 6);
      return action.kind === "text"
        ? {
            kind: "text",
            body: action.body,
            delayMs,
          }
        : {
            kind: "reaction",
            body: action.body as Extract<
              PersonaAction,
              { kind: "reaction" }
            >["body"],
            delayMs,
          };
    });
  if (!actions.some((action) => action.kind === "text")) {
    throw new Error("Persona output requires at least one text action.");
  }

  return {
    actions,
    interestChange: draft.interestChange,
    state: {
      engagement: nextEngagement(current.engagement, draft.interestChange),
      boundary,
      terminal: terminalReason !== null,
    },
    terminalReason,
  };
}

function personaError(
  code: "persona_invalid_request" | "persona_conflict" | "persona_unavailable",
  message: string,
  retryable = false,
): PersonaServiceResponse {
  return { ok: false, retryable, code, message };
}

export type PersonaServiceResponse =
  | {
      ok: true;
      attemptId: string;
      scenarioId: string;
      turn: PersonaRequest["turn"];
      reply: PersonaReply;
      usedFallback: boolean;
    }
  | {
      ok: false;
      retryable: boolean;
      code: PersonaErrorCode;
      message: string;
    };

export class PersonaService {
  private readonly inFlight = new Map<
    string,
    { body: string; promise: Promise<PersonaServiceResponse> }
  >();
  private readonly prepareInFlight = new Map<
    string,
    { body: string; promise: Promise<PersonaServiceResponse> }
  >();

  constructor(
    private readonly store: PersonaConversationStore =
      personaConversationStore,
    private readonly provider: PersonaProvider = aiSdkPersonaProvider,
  ) {}

  async respond(request: PersonaRequest): Promise<PersonaServiceResponse> {
    const scenario = getScenario(request.scenarioId);
    if (!scenario) {
      return personaError(
        "persona_invalid_request",
        "That scenario is not part of the canonical catalog.",
      );
    }

    const operationKey = `${request.scenarioId}:${request.attemptId}:${request.turn}`;
    const preparing = this.prepareInFlight.get(operationKey);
    if (preparing?.body === request.body) {
      await preparing.promise;
    }
    const pending = this.inFlight.get(operationKey);
    if (pending) {
      if (pending.body !== request.body) {
        return personaError(
          "persona_conflict",
          "That turn is already generating from different text.",
        );
      }
      return pending.promise;
    }

    try {
      const inspection = this.store.inspectTurn(
        scenario,
        request.attemptId,
        request.turn,
        request.body,
      );
      if (inspection.kind === "stored") {
        return {
          ok: true,
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          turn: request.turn,
          reply: inspection.reply,
          usedFallback: inspection.usedFallback,
        };
      }

      const promise = this.generateAndCommit(
        request,
        scenario,
        inspection.attempt,
        this.store.getPrepared(
          scenario,
          request.attemptId,
          request.turn,
          request.body,
        ),
      ).finally(() => {
        this.inFlight.delete(operationKey);
      });
      this.inFlight.set(operationKey, { body: request.body, promise });
      return promise;
    } catch (error) {
      return personaError(
        "persona_conflict",
        error instanceof Error
          ? error.message.replace(/^persona_conflict:\s*/, "")
          : "The conversation state changed before this turn landed.",
      );
    }
  }

  async prepare(request: PersonaRequest): Promise<PersonaServiceResponse> {
    const scenario = getScenario(request.scenarioId);
    if (!scenario) {
      return personaError(
        "persona_invalid_request",
        "That scenario is not part of the canonical catalog.",
      );
    }

    const operationKey = `${request.scenarioId}:${request.attemptId}:${request.turn}`;
    const pending = this.prepareInFlight.get(operationKey);
    if (pending) {
      if (pending.body !== request.body) {
        return personaError(
          "persona_conflict",
          "That draft changed while a reply was being prepared.",
        );
      }
      return pending.promise;
    }

    try {
      const inspection = this.store.inspectTurn(
        scenario,
        request.attemptId,
        request.turn,
        request.body,
      );
      if (inspection.kind === "stored") {
        return {
          ok: true,
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          turn: request.turn,
          reply: inspection.reply,
          usedFallback: inspection.usedFallback,
        };
      }
      const existing = this.store.getPrepared(
        scenario,
        request.attemptId,
        request.turn,
        request.body,
      );
      if (existing) {
        return {
          ok: true,
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          turn: request.turn,
          reply: existing.reply,
          usedFallback: existing.usedFallback,
        };
      }
      if (
        !this.store.reservePreparation(
          scenario,
          request.attemptId,
          request.turn,
        )
      ) {
        return personaError(
          "persona_conflict",
          "Draft preparation paused for this turn. Send the message to continue normally.",
        );
      }

      const promise = this.generateAndPrepare(
        request,
        scenario,
        inspection.attempt,
      ).finally(() => {
        this.prepareInFlight.delete(operationKey);
      });
      this.prepareInFlight.set(operationKey, {
        body: request.body,
        promise,
      });
      return promise;
    } catch (error) {
      return personaError(
        "persona_conflict",
        error instanceof Error
          ? error.message.replace(/^persona_conflict:\s*/, "")
          : "The conversation state changed before this draft was prepared.",
      );
    }
  }

  private async generateAndCommit(
    request: PersonaRequest,
    scenario: NonNullable<ReturnType<typeof getScenario>>,
    attempt: Attempt,
    prepared?: PreparedPersonaTurn,
  ): Promise<PersonaServiceResponse> {
    const generated =
      prepared ?? (await this.generateReply(request, scenario, attempt));
    const { reply, usedFallback } = generated;

    try {
      const committedAttempt = this.store.commitTurn({
        scenario,
        attemptId: request.attemptId,
        turn: request.turn,
        body: request.body,
        reply,
        usedFallback,
      });
      logConversationEvent("info", {
        event: "persona.turn.completed",
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        turn: request.turn,
        model: process.env.RIZZCODE_PERSONA_MODEL || "gpt-5.4-nano",
        usedFallback,
        conversation: committedAttempt.messages,
        personaState: committedAttempt.personaState,
        details: { reply },
      });
    } catch (error) {
      return personaError(
        "persona_conflict",
        error instanceof Error
          ? error.message.replace(/^persona_conflict:\s*/, "")
          : "The conversation state changed before this turn landed.",
      );
    }

    return {
      ok: true,
      attemptId: request.attemptId,
      scenarioId: request.scenarioId,
      turn: request.turn,
      reply,
      usedFallback,
    };
  }

  private async generateAndPrepare(
    request: PersonaRequest,
    scenario: NonNullable<ReturnType<typeof getScenario>>,
    attempt: Attempt,
  ): Promise<PersonaServiceResponse> {
    const prepared = await this.generateReply(request, scenario, attempt);
    if (
      !this.store.savePrepared({
        scenario,
        attemptId: request.attemptId,
        turn: request.turn,
        body: request.body,
        reply: prepared.reply,
        usedFallback: prepared.usedFallback,
      })
    ) {
      return personaError(
        "persona_conflict",
        "That draft became stale before preparation finished.",
      );
    }
    return {
      ok: true,
      attemptId: request.attemptId,
      scenarioId: request.scenarioId,
      turn: request.turn,
      reply: prepared.reply,
      usedFallback: prepared.usedFallback,
    };
  }

  private async generateReply(
    request: PersonaRequest,
    scenario: NonNullable<ReturnType<typeof getScenario>>,
    attempt: Attempt,
  ): Promise<PreparedPersonaTurn> {
    let reply: PersonaReply;
    let usedFallback = false;
    try {
      if (
        !process.env.OPENAI_API_KEY &&
        this.provider === aiSdkPersonaProvider
      ) {
        throw new Error("Persona provider is not configured.");
      }
      const draft = await this.provider.generate({
        scenario,
        attempt,
        turn: request.turn,
        body: request.body,
        abortSignal: AbortSignal.timeout(12_000),
      });
      reply = normalizeReply(
        draft,
        attempt.personaState,
        request.turn,
      );
    } catch (error) {
      logConversationEvent("error", {
        event: "persona.provider.failed",
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        turn: request.turn,
        model: process.env.RIZZCODE_PERSONA_MODEL || "gpt-5.4-nano",
        conversation: beginTurn(attempt, request.body).messages,
        personaState: attempt.personaState,
        details: { error: modelErrorDetails(error) },
      });
      usedFallback = true;
      reply = authoredFallbackReply({
        scenario,
        turn: request.turn,
        personaState: attempt.personaState,
      });
    }
    return {
      turn: request.turn,
      body: request.body,
      reply,
      usedFallback,
    };
  }
}
