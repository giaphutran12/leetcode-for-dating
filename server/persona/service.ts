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
import { detectHardGates } from "../../src/domain/scoring";
import {
  authoredFallbackReply,
  beginTurn,
} from "../../src/engine/conversationEngine";
import {
  advancePersonaPolicyState,
  normalizePersonaState,
  personaTextHasQuestion,
} from "../../src/engine/personaPolicy";
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
  latestUserBody: string,
): PersonaReply {
  const policyState = normalizePersonaState(current);
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
  const text = draft.actions
    .filter((action) => action.kind === "text")
    .map((action) => action.body)
    .join("\n");
  const normalizedText = text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const normalizedContribution = draft.contribution
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const contributionAppearsInStatement = (
    text.match(/[^.!?\n]+[.!?]?/g) ?? []
  ).some((segment) => {
    if (personaTextHasQuestion(segment)) return false;
    return segment
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .includes(normalizedContribution);
  });
  if (
    !normalizedContribution ||
    !normalizedText.includes(normalizedContribution) ||
    !contributionAppearsInStatement
  ) {
    throw new Error(
      "Persona contribution must be an exact excerpt from the reply.",
    );
  }
  const questionCount = (text.match(/\?/g) ?? []).length;
  if (questionCount > 1) {
    throw new Error("Persona reply cannot contain more than one question.");
  }
  if (policyState.questionStreak === 1 && personaTextHasQuestion(text)) {
    throw new Error("Persona reply cannot ask consecutive-turn questions.");
  }
  const lastMove = policyState.recentMoves.at(-1);
  if (draft.move === lastMove && draft.move !== "close") {
    throw new Error("Persona reply must vary its conversational move.");
  }
  const callbackUsed = draft.callbackUsed?.toLocaleLowerCase();
  if (
    draft.move === "callback" &&
    !policyState.callbackSeeds.some(
      (seed) => seed.toLocaleLowerCase() === callbackUsed,
    )
  ) {
    throw new Error("Persona callback must use a stored callback seed.");
  }
  const callbackSeed =
    draft.callbackSeed &&
    latestUserBody
      .toLocaleLowerCase()
      .includes(draft.callbackSeed.toLocaleLowerCase())
      ? draft.callbackSeed
      : null;
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
  const nextPolicyState = advancePersonaPolicyState({
    current: policyState,
    move: draft.move,
    text,
    energyChange: draft.energyChange,
    callbackSeed,
  });

  return {
    actions,
    move: draft.move,
    interestChange: draft.interestChange,
    state: {
      ...policyState,
      ...nextPolicyState,
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

type PersonaRequestContext = {
  userId?: string;
  logProviderFailure?: boolean;
};

function stopLevelReply(current: PersonaReply["state"]): PersonaReply {
  const policyState = normalizePersonaState(current);
  const body = "No. That's disrespectful. Don't contact me again.";
  const nextPolicyState = advancePersonaPolicyState({
    current: policyState,
    move: "close",
    text: body,
    energyChange: "down",
  });
  return {
    actions: [
      {
        kind: "text",
        body,
        delayMs: 420,
      },
    ],
    move: "close",
    interestChange: "down",
    state: {
      ...policyState,
      ...nextPolicyState,
      engagement: "closed",
      boundary: "explicit",
      terminal: true,
    },
    terminalReason: "boundary",
  };
}

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

  async respond(
    request: PersonaRequest,
    context: PersonaRequestContext = {},
  ): Promise<PersonaServiceResponse> {
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
        context,
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

  async prepare(
    request: PersonaRequest,
    context: PersonaRequestContext = {},
  ): Promise<PersonaServiceResponse> {
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
        { ...context, logProviderFailure: false },
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
    context: PersonaRequestContext = {},
  ): Promise<PersonaServiceResponse> {
    const generated =
      prepared ?? (await this.generateReply(request, scenario, attempt, context));
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
      await logConversationEvent("info", {
        event: "persona.turn.completed",
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        turn: request.turn,
        model: process.env.RIZZCODE_PERSONA_MODEL || "gpt-5.4-nano",
        usedFallback,
        conversation: committedAttempt.messages,
        personaState: committedAttempt.personaState,
        details: { reply },
        userId: context.userId,
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
    context: PersonaRequestContext,
  ): Promise<PersonaServiceResponse> {
    const prepared = await this.generateReply(
      request,
      scenario,
      attempt,
      context,
    );
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
    context: PersonaRequestContext,
  ): Promise<PreparedPersonaTurn> {
    let reply: PersonaReply;
    let usedFallback = false;
    const incomingAttempt = beginTurn(attempt, request.body);
    if (detectHardGates(incomingAttempt).severity === "stop") {
      return {
        turn: request.turn,
        body: request.body,
        reply: stopLevelReply(attempt.personaState),
        usedFallback: false,
      };
    }
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
        request.body,
      );
    } catch (error) {
      if (context.logProviderFailure !== false) {
        await logConversationEvent("error", {
          event: "persona.provider.failed",
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          turn: request.turn,
          model: process.env.RIZZCODE_PERSONA_MODEL || "gpt-5.4-nano",
          conversation: incomingAttempt.messages,
          personaState: attempt.personaState,
          details: { error: modelErrorDetails(error) },
          userId: context.userId,
        });
      }
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
