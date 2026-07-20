import type {
  JudgeApiResponse,
  PersonaApiResponse,
} from "../../../domain/types";
import {
  createPersonaService,
  selectJudgeProvider,
} from "../../../../server/runtime";
import { getScenario } from "../../../data/scenarios";
import type {
  Attempt,
  PersonaRequest,
} from "../../../domain/types";
import { createAttempt } from "../../../engine/conversationEngine";
import { JudgeRequestSchema } from "../../../../server/judge/schema";
import { judgeAttempt } from "../../../../server/judge/service";
import { PersonaRequestSchema } from "../../../../server/persona/schema";
import { personaConversationStore } from "../../../../server/persona/store";
import {
  signConversationSession,
  verifyConversationSession,
} from "../../../../server/session";
import {
  authenticatedUserForRequest,
  requestAuthenticatedUserId,
} from "../../../../server/auth/verifyRequest";
import { billingStorageConfigured } from "../../../../server/billing/config";
import {
  claimPracticeAccess,
  createBillingAdminClient,
} from "../../../../server/billing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const personaService = createPersonaService();
const maxRequestBytes = 24 * 1024;

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

async function parseBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
    throw new Error("request_too_large");
  }
  return JSON.parse(body);
}

function canonicalAttemptForPersona(request: PersonaRequest): Attempt {
  const scenario = getScenario(request.scenarioId);
  if (!scenario) {
    throw new Error("That scenario is not part of the canonical catalog.");
  }
  if (!request.sessionToken) {
    if (request.turn !== 1) {
      throw new Error("This conversation is missing its signed receipt.");
    }
    return createAttempt(scenario, request.attemptId, "server-persona");
  }

  const attempt = verifyConversationSession(request.sessionToken);
  if (
    attempt.id !== request.attemptId ||
    attempt.scenarioId !== request.scenarioId ||
    attempt.status !== "active" ||
    request.turn !== attempt.userTurn + 1
  ) {
    throw new Error("This turn does not match the signed conversation.");
  }
  return attempt;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = (await context.params).path ?? [];
  let body: unknown;
  try {
    body = await parseBody(request);
  } catch {
    const judging = path.length === 1 && path[0] === "judge";
    return json(
      {
        ok: false,
        retryable: false,
        code: judging ? "judge_invalid_output" : "persona_invalid_request",
        message: "The request body was invalid.",
      },
      400,
    );
  }

  if (path[0] === "persona" && path.length <= 2) {
    const parsed = PersonaRequestSchema.safeParse(body);
    if (!parsed.success) {
      const result: PersonaApiResponse = {
        ok: false,
        retryable: false,
        code: "persona_invalid_request",
        message:
          "The persona request was invalid. Your conversation did not advance.",
      };
      return json(result, 400);
    }

    const preparing = path[1] === "prepare";
    const userId = preparing
      ? undefined
      : await requestAuthenticatedUserId(request);
    if (path.length === 2 && !preparing) {
      return json({ ok: false, message: "Not found." }, 404);
    }
    if (parsed.data.turn === 1) {
      const user = await authenticatedUserForRequest(request);
      if (user && billingStorageConfigured()) {
        try {
          const access = await claimPracticeAccess(
            createBillingAdminClient(),
            user.id,
            parsed.data.attemptId,
            parsed.data.scenarioId,
          );
          if (!access.allowed) {
            const result: PersonaApiResponse = {
              ok: false,
              retryable: false,
              code: "practice_limit_reached",
              message:
                "You used all your free training. Pick a plan to keep practicing.",
            };
            return json(result, 402);
          }
        } catch {
          const result: PersonaApiResponse = {
            ok: false,
            retryable: true,
            code: "persona_unavailable",
            message:
              "Practice access could not be verified. Your line is preserved.",
          };
          return json(result, 503);
        }
      } else if (user && process.env.NODE_ENV === "production") {
        const result: PersonaApiResponse = {
          ok: false,
          retryable: true,
          code: "persona_unavailable",
          message:
            "Practice access is not configured. Your line is preserved.",
        };
        return json(result, 503);
      }
    }
    let canonicalAttempt: Attempt;
    try {
      canonicalAttempt = canonicalAttemptForPersona(parsed.data);
      personaConversationStore.hydrateAttempt(canonicalAttempt);
    } catch (error) {
      const result: PersonaApiResponse = {
        ok: false,
        retryable: false,
        code: "persona_conflict",
        message:
          error instanceof Error
            ? error.message
            : "The signed conversation could not be restored.",
      };
      return json(result, 409);
    }
    const result = preparing
      ? await personaService.prepare(parsed.data, { userId })
      : await personaService.respond(parsed.data, { userId });
    let publicResult: PersonaApiResponse | {
      ok: true;
      attemptId: string;
      scenarioId: string;
      turn: PersonaRequest["turn"];
      prepared: true;
    };
    if (!result.ok) {
      publicResult = result;
    } else if (preparing) {
      publicResult = {
        ok: true as const,
        attemptId: result.attemptId,
        scenarioId: result.scenarioId,
        turn: result.turn,
        prepared: true as const,
      };
    } else {
      const updatedAttempt = personaConversationStore.getAttempt(
        result.attemptId,
        result.scenarioId,
      );
      if (!updatedAttempt) {
        const failure: PersonaApiResponse = {
          ok: false,
          retryable: true,
          code: "persona_unavailable",
          message:
            "The reaction landed without a conversation receipt. Your line is preserved.",
        };
        return json(failure, 503);
      }
      publicResult = {
        ...result,
        sessionToken: signConversationSession(updatedAttempt),
      };
    }
    return json(publicResult, result.ok ? 200 : result.retryable ? 503 : 409);
  }

  if (path.length === 1 && path[0] === "judge") {
    const parsed = JudgeRequestSchema.safeParse(body);
    if (!parsed.success) {
      const result: JudgeApiResponse = {
        ok: false,
        retryable: false,
        code: "judge_invalid_output",
        message:
          "The judge request was invalid. Only canonical scenario responses are accepted.",
      };
      return json(result, 400);
    }
    if (!parsed.data.sessionToken) {
      const result: JudgeApiResponse = {
        ok: false,
        retryable: false,
        code: "judge_invalid_output",
        message:
          "The signed conversation receipt is required for judgment.",
      };
      return json(result, 409);
    }
    let canonicalAttempt: Attempt;
    try {
      canonicalAttempt = verifyConversationSession(parsed.data.sessionToken);
      if (
        canonicalAttempt.id !== parsed.data.attemptId ||
        canonicalAttempt.scenarioId !== parsed.data.scenarioId
      ) {
        throw new Error("Conversation receipt does not match this attempt.");
      }
    } catch {
      const result: JudgeApiResponse = {
        ok: false,
        retryable: false,
        code: "judge_invalid_output",
        message:
          "The signed conversation receipt is invalid or expired.",
      };
      return json(result, 409);
    }
    const userId = await requestAuthenticatedUserId(request);
    const result = await judgeAttempt(
      parsed.data,
      selectJudgeProvider(undefined),
      canonicalAttempt,
      { userId },
    );
    return json(
      result,
      result.ok
        ? 200
        : result.code === "judge_in_progress"
          ? 409
          : result.retryable
            ? 503
            : 409,
    );
  }

  return json({ ok: false, message: "Not found." }, 404);
}
