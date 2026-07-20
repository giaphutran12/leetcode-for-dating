import { createHash } from "node:crypto";
import {
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
} from "ai";
import { ZodError } from "zod";
import { getScenario } from "../../src/data/scenarios";
import { MIN_CONVERSATION_TURNS } from "../../src/domain/constants";
import { finalizeJudgeResult } from "../../src/domain/scoring";
import { cleanJudgeCopy } from "../../src/domain/modelCopy";
import type {
  Attempt,
  JudgeApiResponse,
  JudgeErrorCode,
  JudgeModelDraft,
  JudgeRequest,
} from "../../src/domain/types";
import { validateJudgeApiResponse } from "../../src/domain/validation";
import { userResponses } from "../../src/engine/conversationEngine";
import {
  logConversationEvent,
  modelErrorDetails,
} from "../observability/conversationLog";
import {
  PersonaConversationStore,
  personaConversationStore,
} from "../persona/store";
import {
  aiSdkJudgeProvider,
  JudgeEvidenceReferenceError,
  type JudgeProvider,
} from "./provider";
import {
  judgmentStoreForRuntime,
  type JudgmentStore,
  type JudgmentStoreKey,
} from "./store";

class JudgeServiceError extends Error {
  constructor(
    public readonly code: JudgeErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if (!("statusCode" in error)) return undefined;
  const value = Number((error as { statusCode: unknown }).statusCode);
  return Number.isFinite(value) ? value : undefined;
}

function classifyProviderError(error: unknown): JudgeServiceError {
  if (error instanceof JudgeServiceError) return error;
  if (
    error instanceof JudgeEvidenceReferenceError ||
    error instanceof ZodError ||
    NoObjectGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error)
  ) {
    return new JudgeServiceError(
      "judge_invalid_output",
      "The judge returned an invalid result. No score or XP was awarded. Try judgment again.",
      true,
      { cause: error },
    );
  }
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new JudgeServiceError(
      "judge_timeout",
      "The judge took too long. Your transcript is safe. Try judgment again.",
      true,
      { cause: error },
    );
  }
  const status = statusCode(error);
  if (status === 401 || status === 403) {
    return new JudgeServiceError(
      "judge_unconfigured",
      "The judge could not authenticate with its provider. Your transcript is safe. Try again after server setup is fixed.",
      true,
      { cause: error },
    );
  }
  if (status === 429) {
    return new JudgeServiceError(
      "judge_rate_limited",
      "The judge is catching its breath. Your transcript is safe. Try again shortly.",
      true,
      { cause: error },
    );
  }
  if (status && status >= 400 && status < 500) {
    return new JudgeServiceError(
      "judge_unconfigured",
      "The judge provider rejected its server configuration. Your transcript is safe. Try again after setup is fixed.",
      true,
      { cause: error },
    );
  }
  return new JudgeServiceError(
    "judge_unavailable",
    "The judge is unavailable right now. Your transcript is safe.",
    true,
    { cause: error },
  );
}

function isTransient(code: JudgeErrorCode): boolean {
  return (
    code === "judge_timeout" ||
    code === "judge_rate_limited" ||
    code === "judge_unavailable"
  );
}

function judgmentKey(
  request: JudgeRequest,
  userId?: string,
): JudgmentStoreKey {
  const transcriptHash = createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: request.schemaVersion,
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        responses: request.responses,
      }),
    )
    .digest("hex");
  return {
    attemptId: request.attemptId,
    scenarioId: request.scenarioId,
    transcriptHash,
    userId,
  };
}

async function releaseClaim(
  store: JudgmentStore,
  key: JudgmentStoreKey,
  claimToken: string,
): Promise<void> {
  try {
    await store.release(key, claimToken);
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: "rizzcode-conversation",
        event: "judge.idempotency.release_failed",
        attemptId: key.attemptId,
        scenarioId: key.scenarioId,
        error:
          error instanceof Error ? error.message : "Unknown release failure",
      }),
    );
  }
}

export async function judgeAttempt(
  request: JudgeRequest,
  provider: JudgeProvider = aiSdkJudgeProvider,
  conversationSource: PersonaConversationStore | Attempt =
    personaConversationStore,
  context: { userId?: string; judgmentStore?: JudgmentStore } = {},
): Promise<JudgeApiResponse> {
  const scenario = getScenario(request.scenarioId);
  if (!scenario) {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message: "That scenario is not part of the canonical catalog.",
    };
  }

  const storedAttempt =
    conversationSource instanceof PersonaConversationStore
      ? conversationSource.getAttempt(request.attemptId, request.scenarioId)
      : structuredClone(conversationSource);
  const canonicalResponses = storedAttempt ? userResponses(storedAttempt) : [];
  const responsesMatch =
    canonicalResponses.length === request.responses.length &&
    canonicalResponses.every(
      (response, index) =>
        response.turn === request.responses[index]?.turn &&
        response.body === request.responses[index]?.body,
    );
  if (!responsesMatch) {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message: "The submitted turns do not match the server-owned conversation.",
    };
  }
  if (
    !storedAttempt ||
    (!storedAttempt.personaState.terminal &&
      storedAttempt.userTurn < MIN_CONVERSATION_TURNS)
  ) {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message: "The conversation is not ready for judgment.",
    };
  }

  const attempt =
    conversationSource instanceof PersonaConversationStore
      ? conversationSource.prepareForJudgment(
          request.attemptId,
          request.scenarioId,
        ) ?? storedAttempt
      : {
          ...storedAttempt,
          status: "awaiting_judgment" as const,
          personaState: { ...storedAttempt.personaState, terminal: true },
        };
  const model = process.env.RIZZCODE_JUDGE_MODEL || "gpt-5.6-luna";
  const store = context.judgmentStore ?? judgmentStoreForRuntime();
  const key = judgmentKey(request, context.userId);

  let claim;
  try {
    claim = await store.claim(key);
  } catch (error) {
    await logConversationEvent("error", {
      event: "judge.failed",
      attemptId: request.attemptId,
      scenarioId: request.scenarioId,
      model,
      conversation: attempt.messages,
      personaState: attempt.personaState,
      details: {
        classification: "judge_idempotency_unavailable",
        error: modelErrorDetails(error),
      },
      userId: context.userId,
    });
    return {
      ok: false,
      retryable: true,
      code: "judge_unavailable",
      message:
        "Judgment could not start safely. Your transcript is preserved. Try again shortly.",
    };
  }

  if (claim.kind === "conflict") {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message: "This attempt ID is already bound to another transcript.",
    };
  }
  if (claim.kind === "pending") {
    return {
      ok: false,
      retryable: true,
      code: "judge_in_progress",
      message:
        "This judgment is already running. Your transcript is safe. Try again in a moment.",
    };
  }
  if (claim.kind === "completed") {
    const cached = validateJudgeApiResponse(
      { ok: true, result: claim.result },
      request,
    );
    if (!cached?.ok) {
      try {
        await store.invalidateCompleted(key);
      } catch (error) {
        await logConversationEvent("error", {
          event: "judge.failed",
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          model,
          conversation: attempt.messages,
          personaState: attempt.personaState,
          details: {
            classification: "judge_cached_result_invalidation_failed",
            error: modelErrorDetails(error),
          },
          userId: context.userId,
        });
      }
      return {
        ok: false,
        retryable: true,
        code: "judge_invalid_output",
        message:
          "The saved judgment failed validation. No score or XP was awarded. Try again later.",
      };
    }
    await logConversationEvent("info", {
      event: "judge.reused",
      attemptId: request.attemptId,
      scenarioId: request.scenarioId,
      model,
      conversation: attempt.messages,
      personaState: attempt.personaState,
      details: { idempotency: "completed_result" },
      userId: context.userId,
    });
    return cached;
  }

  const claimToken = claim.claimToken;

  if (!process.env.OPENAI_API_KEY && provider === aiSdkJudgeProvider) {
    await releaseClaim(store, key, claimToken);
    return {
      ok: false,
      retryable: true,
      code: "judge_unconfigured",
      message:
        "The judge needs OPENAI_API_KEY on the server. Your transcript is saved and ready to retry.",
    };
  }

  await logConversationEvent("info", {
    event: "judge.started",
    attemptId: request.attemptId,
    scenarioId: request.scenarioId,
    model,
    conversation: attempt.messages,
    personaState: attempt.personaState,
    details: { idempotency: "claimed" },
    userId: context.userId,
  });

  let lastError: JudgeServiceError | undefined;
  for (let operation = 0; operation < 2; operation += 1) {
    let draft: JudgeModelDraft | undefined;
    try {
      const abortSignal = AbortSignal.timeout(18_000);
      draft = cleanJudgeCopy(
        await provider.evaluate({
          scenario,
          attempt,
          abortSignal,
        }),
      );
      let result;
      try {
        result = finalizeJudgeResult({
          attemptId: request.attemptId,
          scenario,
          attempt,
          draft,
        });
      } catch (error) {
        throw new JudgeServiceError(
          "judge_invalid_output",
          "The judge returned an invalid result. No score or XP was awarded. Try judgment again.",
          true,
          { cause: error },
        );
      }
      try {
        await store.complete(key, claimToken, result);
      } catch (error) {
        await logConversationEvent("error", {
          event: "judge.failed",
          attemptId: request.attemptId,
          scenarioId: request.scenarioId,
          model,
          operation: operation + 1,
          conversation: attempt.messages,
          personaState: attempt.personaState,
          details: {
            classification: "judge_persistence_unavailable",
            draft,
            error: modelErrorDetails(error),
          },
          userId: context.userId,
        });
        await releaseClaim(store, key, claimToken);
        return {
          ok: false,
          retryable: true,
          code: "judge_unavailable",
          message:
            "The judgment could not be recorded safely. No score or XP was awarded. Try again shortly.",
        };
      }
      await logConversationEvent("info", {
        event: "judge.completed",
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        model,
        operation: operation + 1,
        conversation: attempt.messages,
        personaState: attempt.personaState,
        details: { draft, result },
        userId: context.userId,
      });
      return { ok: true, result };
    } catch (error) {
      lastError = classifyProviderError(error);
      await logConversationEvent("error", {
        event: "judge.failed",
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        model,
        operation: operation + 1,
        conversation: attempt.messages,
        personaState: attempt.personaState,
        details: {
          classification: lastError.code,
          draft,
          error: modelErrorDetails(error),
        },
        userId: context.userId,
      });
      if (!isTransient(lastError.code) || operation === 1) break;
    }
  }

  await releaseClaim(store, key, claimToken);
  return {
    ok: false,
    retryable: lastError?.retryable ?? true,
    code: lastError?.code ?? "judge_unavailable",
    message:
      lastError?.message ??
      "The judge is unavailable right now. Your transcript is safe.",
  };
}
