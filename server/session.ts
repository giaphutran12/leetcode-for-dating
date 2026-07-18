import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Attempt } from "../src/domain/types";

const SESSION_VERSION = 1;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

type SessionPayload = {
  version: typeof SESSION_VERSION;
  expiresAt: number;
  attempt: Attempt;
};

function signingKey(): Buffer {
  const secret =
    process.env.RIZZCODE_SESSION_SECRET ?? process.env.OPENAI_API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Conversation signing is not configured.");
    }
    return createHash("sha256")
      .update("rizzcode-local-session-key")
      .digest();
  }
  return createHash("sha256")
    .update(`rizzcode-session-v1:${secret}`)
    .digest();
}

function signatureFor(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

export function signConversationSession(attempt: Attempt): string {
  const payload: SessionPayload = {
    version: SESSION_VERSION,
    expiresAt: Date.now() + SESSION_TTL_MS,
    attempt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signatureFor(encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

export function verifyConversationSession(token: string): Attempt {
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) {
    throw new Error("Conversation receipt is malformed.");
  }

  const expected = signatureFor(encoded);
  const provided = Buffer.from(providedSignature, "base64url");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new Error("Conversation receipt is invalid.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Partial<SessionPayload>;
  if (
    payload.version !== SESSION_VERSION ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now() ||
    !payload.attempt ||
    typeof payload.attempt.id !== "string" ||
    typeof payload.attempt.scenarioId !== "string" ||
    !Array.isArray(payload.attempt.messages) ||
    typeof payload.attempt.userTurn !== "number"
  ) {
    throw new Error("Conversation receipt is expired or incompatible.");
  }

  return structuredClone(payload.attempt);
}
