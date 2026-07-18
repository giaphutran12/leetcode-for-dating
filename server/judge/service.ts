import { getScenario } from "../../src/data/scenarios";
import { detectHardGates, finalizeJudgeResult } from "../../src/domain/scoring";
import type {
  JudgeApiResponse,
  JudgeErrorCode,
  JudgeRequest,
} from "../../src/domain/types";
import {
  MIN_CONVERSATION_TURNS,
} from "../../src/domain/constants";
import {
  personaConversationStore,
  type PersonaConversationStore,
} from "../persona/store";
import {
  aiSdkJudgeProvider,
  type JudgeProvider,
} from "./provider";

class JudgeServiceError extends Error {
  constructor(
    public readonly code: JudgeErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

function classifyProviderError(error: unknown): JudgeServiceError {
  if (error instanceof JudgeServiceError) return error;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new JudgeServiceError(
      "judge_timeout",
      "The judge took too long. Your transcript is safe. Try judgment again.",
      true,
    );
  }
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : undefined;
  if (status === 429) {
    return new JudgeServiceError(
      "judge_rate_limited",
      "The judge is catching its breath. Your transcript is safe. Try again shortly.",
      true,
    );
  }
  return new JudgeServiceError(
    "judge_unavailable",
    "The judge is unavailable right now. Your transcript is safe.",
    true,
  );
}

function isTransient(code: JudgeErrorCode): boolean {
  return (
    code === "judge_timeout" ||
    code === "judge_rate_limited" ||
    code === "judge_unavailable"
  );
}

export async function judgeAttempt(
  request: JudgeRequest,
  provider: JudgeProvider = aiSdkJudgeProvider,
  conversationStore: PersonaConversationStore = personaConversationStore,
): Promise<JudgeApiResponse> {
  if (!process.env.OPENAI_API_KEY && provider === aiSdkJudgeProvider) {
    return {
      ok: false,
      retryable: true,
      code: "judge_unconfigured",
      message:
        "The judge needs OPENAI_API_KEY on the server. Your transcript is saved and ready to retry.",
    };
  }

  const scenario = getScenario(request.scenarioId);
  if (!scenario) {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message: "That scenario is not part of the canonical catalog.",
    };
  }

  if (
    !conversationStore.responsesMatch(
      request.attemptId,
      request.scenarioId,
      request.responses,
    )
  ) {
    return {
      ok: false,
      retryable: false,
      code: "judge_invalid_output",
      message:
        "The submitted turns do not match the server-owned conversation.",
    };
  }
  const storedAttempt = conversationStore.getAttempt(
    request.attemptId,
    request.scenarioId,
  );
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
    conversationStore.prepareForJudgment(
      request.attemptId,
      request.scenarioId,
    ) ?? storedAttempt;
  const hardGate = detectHardGates(attempt);

  let lastError: JudgeServiceError | undefined;
  for (let operation = 0; operation < 2; operation += 1) {
    try {
      const abortSignal = AbortSignal.timeout(18_000);
      const draft = await provider.evaluate({
        scenario,
        attempt,
        hardGate,
        abortSignal,
      });
      const result = finalizeJudgeResult({
        attemptId: request.attemptId,
        scenario,
        attempt,
        draft,
      });
      return { ok: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown judge failure";
      if (
        /rubric|evidence|outcome|structured|schema|parse|invalid/i.test(message)
      ) {
        return {
          ok: false,
          retryable: true,
          code: "judge_invalid_output",
          message:
            "The judge returned an invalid result. No score or XP was awarded. Try judgment again.",
        };
      }
      lastError = classifyProviderError(error);
      if (!isTransient(lastError.code) || operation === 1) break;
    }
  }

  return {
    ok: false,
    retryable: lastError?.retryable ?? true,
    code: lastError?.code ?? "judge_unavailable",
    message:
      lastError?.message ??
      "The judge is unavailable right now. Your transcript is safe.",
  };
}
