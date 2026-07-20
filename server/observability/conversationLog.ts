import type { Attempt } from "../../src/domain/types";
import { persistConversationEvent } from "./conversationPersistence";

const MAX_MODEL_TEXT_LENGTH = 12_000;

type LogLevel = "info" | "error";

export type ConversationEvent = {
  event:
    | "persona.turn.completed"
    | "persona.provider.failed"
    | "judge.started"
    | "judge.completed"
    | "judge.failed";
  attemptId: string;
  scenarioId: string;
  model: string;
  turn?: number;
  operation?: number;
  usedFallback?: boolean;
  conversation: Attempt["messages"];
  personaState: Attempt["personaState"];
  details?: unknown;
  userId?: string;
};

function boundedText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, MAX_MODEL_TEXT_LENGTH);
}

export function modelErrorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: boundedText(String(error)) };
  }

  const candidate = error as Error & {
    cause?: unknown;
    text?: unknown;
    issues?: unknown;
  };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    text: boundedText(candidate.text),
    issues: Array.isArray(candidate.issues) ? candidate.issues : undefined,
    cause:
      candidate.cause === undefined
        ? undefined
        : modelErrorDetails(candidate.cause),
  };
}

export async function logConversationEvent(
  level: LogLevel,
  event: ConversationEvent,
): Promise<void> {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "rizzcode-conversation",
    ...event,
  });
  if (level === "error") {
    console.error(payload);
  } else {
    console.info(payload);
  }
  await persistConversationEvent(event);
}
