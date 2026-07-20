import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ConversationEvent } from "./conversationLog";

type ConversationEventInsert = {
  attempt_id: string;
  scenario_id: string;
  user_id: string | null;
  event_type: ConversationEvent["event"];
  model: string;
  turn: number | null;
  operation: number | null;
  used_fallback: boolean | null;
  conversation: ConversationEvent["conversation"];
  persona_state: ConversationEvent["personaState"];
  details: unknown;
};

let cachedClient: SupabaseClient | undefined;

function getPersistenceClient(): SupabaseClient | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) return undefined;
  cachedClient ??= createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function writeConversationEvent(
  client: Pick<SupabaseClient, "from">,
  event: ConversationEvent,
): Promise<void> {
  const row: ConversationEventInsert = {
    attempt_id: event.attemptId,
    scenario_id: event.scenarioId,
    user_id: event.userId ?? null,
    event_type: event.event,
    model: event.model,
    turn: event.turn ?? null,
    operation: event.operation ?? null,
    used_fallback: event.usedFallback ?? null,
    conversation: event.conversation,
    persona_state: event.personaState,
    details: event.details ?? null,
  };
  const { error } = await client
    .from("rizzcode_conversation_events")
    .insert(row);
  if (error) throw new Error(error.message);
}

export async function persistConversationEvent(
  event: ConversationEvent,
): Promise<void> {
  const client = getPersistenceClient();
  if (!client) return;
  try {
    await writeConversationEvent(client, event);
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: "rizzcode-conversation",
        event: "conversation.persistence.failed",
        attemptId: event.attemptId,
        scenarioId: event.scenarioId,
        sourceEvent: event.event,
        error:
          error instanceof Error
            ? error.message
            : "Unknown persistence failure",
      }),
    );
  }
}
