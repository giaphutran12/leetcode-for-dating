import { z } from "zod";
import type {
  PersonaApiResponse,
  PersonaPrepareApiResponse,
  PersonaRequest,
} from "../domain/types";

const replySchema = z.object({
  actions: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("text"),
          body: z.string().min(1).max(220),
          delayMs: z.number().int().min(80).max(1_400),
        }),
        z.object({
          kind: z.literal("reaction"),
          body: z.enum(["😂", "😭", "❤️", "👀", "👍", "✨"]),
          delayMs: z.number().int().min(80).max(1_400),
        }),
      ]),
    )
    .min(1)
    .max(3),
  state: z.object({
    engagement: z.enum(["closed", "low", "neutral", "warm"]),
    boundary: z.enum(["none", "soft", "explicit"]),
    terminal: z.boolean(),
  }),
  interestChange: z.enum(["down", "same", "up"]),
  terminalReason: z
    .enum(["completed", "persona_exit", "user_exit", "boundary"])
    .nullable(),
});

const responseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    attemptId: z.string(),
    scenarioId: z.string(),
    turn: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    reply: replySchema,
    usedFallback: z.boolean(),
    sessionToken: z.string().min(80).max(16_000),
  }),
  z.object({
    ok: z.literal(false),
    retryable: z.boolean(),
    code: z.enum([
      "persona_invalid_request",
      "persona_conflict",
      "persona_unavailable",
    ]),
    message: z.string(),
  }),
]);

const prepareResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    attemptId: z.string(),
    scenarioId: z.string(),
    turn: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    prepared: z.literal(true),
  }),
  responseSchema.options[1],
]);

async function callPersona(
  request: PersonaRequest,
  signal?: AbortSignal,
): Promise<PersonaApiResponse> {
  try {
    const response = await fetch("/api/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        retryable: true,
        code: "persona_unavailable",
        message:
          "The reaction failed validation. Your line is preserved and ready to retry.",
      };
    }
    if (
      parsed.data.ok &&
      (parsed.data.attemptId !== request.attemptId ||
        parsed.data.scenarioId !== request.scenarioId ||
        parsed.data.turn !== request.turn)
    ) {
      return {
        ok: false,
        retryable: true,
        code: "persona_unavailable",
        message:
          "The reaction did not match this conversation. Your line is preserved.",
      };
    }
    return parsed.data;
  } catch {
    return {
      ok: false,
      retryable: true,
      code: "persona_unavailable",
      message:
        "The persona could not be reached. Your line is preserved and ready to retry.",
    };
  }
}

export function requestPersonaReply(
  request: PersonaRequest,
  signal?: AbortSignal,
) {
  return callPersona(request, signal);
}

export async function preparePersonaReply(
  request: PersonaRequest,
  signal?: AbortSignal,
): Promise<PersonaPrepareApiResponse> {
  try {
    const response = await fetch("/api/persona/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    const parsed = prepareResponseSchema.safeParse(await response.json());
    if (
      !parsed.success ||
      (parsed.data.ok &&
        (parsed.data.attemptId !== request.attemptId ||
          parsed.data.scenarioId !== request.scenarioId ||
          parsed.data.turn !== request.turn))
    ) {
      return {
        ok: false,
        retryable: true,
        code: "persona_unavailable",
        message: "Draft preparation did not match this conversation.",
      };
    }
    return parsed.data;
  } catch {
    return {
      ok: false,
      retryable: true,
      code: "persona_unavailable",
      message: "Draft preparation was interrupted.",
    };
  }
}
