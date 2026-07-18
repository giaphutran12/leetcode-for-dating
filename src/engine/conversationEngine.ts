import type {
  Attempt,
  ConversationTurn,
  Engagement,
  MessageDeliveryStatus,
  PersonaAction,
  PersonaReply,
  PersonaState,
  PracticeMessage,
  Scenario,
} from "../domain/types";
import {
  MAX_CONVERSATION_TURNS,
  MAX_RESPONSE_LENGTH,
} from "../domain/constants";

const engagementOrder: Engagement[] = ["closed", "low", "neutral", "warm"];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesSignal(input: string, signal: string): boolean {
  const normalizedInput = normalize(input);
  const normalizedSignal = normalize(signal);

  if (!normalizedSignal) {
    return false;
  }

  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(normalizedSignal)}(?:$|[^a-z0-9])`,
    "i",
  );
  return pattern.test(normalizedInput);
}

export function validateResponse(body: string):
  | { ok: true; body: string }
  | { ok: false; reason: "empty" | "too_long" } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_RESPONSE_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, body: trimmed };
}

function hasAnySignal(input: string, signals: string[]): boolean {
  return signals.some((signal) => matchesSignal(input, signal));
}

function moveEngagement(
  current: Engagement,
  direction: "down" | "same" | "up",
): Engagement {
  const index = engagementOrder.indexOf(current);
  if (direction === "up") {
    return engagementOrder[Math.min(index + 1, engagementOrder.length - 1)];
  }
  if (direction === "down") {
    return engagementOrder[Math.max(index - 1, 0)];
  }
  return current;
}

export function replyToUser(input: {
  scenario: Scenario;
  body: string;
  turn: ConversationTurn;
  personaState: PersonaState;
}): PersonaReply {
  const { scenario, body, turn, personaState } = input;
  const { fallback } = scenario;

  let interestChange: PersonaReply["interestChange"] = "same";
  let boundary: PersonaState["boundary"] = personaState.boundary;
  let terminalReason: PersonaReply["terminalReason"] = null;

  if (hasAnySignal(body, fallback.boundarySignals)) {
    interestChange = "down";
    boundary = "explicit";
    terminalReason = "boundary";
  } else if (hasAnySignal(body, fallback.exitSignals)) {
    terminalReason = "user_exit";
  } else if (hasAnySignal(body, fallback.lowInterestSignals)) {
    interestChange = "down";
    boundary = boundary === "none" ? "soft" : boundary;
  } else if (
    hasAnySignal(body, [
      ...fallback.positiveSignals,
      ...scenario.successSignals,
    ])
  ) {
    interestChange = "up";
  }

  const engagement = moveEngagement(
    personaState.engagement,
    interestChange,
  );
  const terminal =
    terminalReason !== null || turn === MAX_CONVERSATION_TURNS;
  const fallbackTurn = Math.min(turn, 3) as 1 | 2 | 3;
  const reply = fallback.repliesByTurn[fallbackTurn][engagement];

  return {
    actions: [{ kind: "text", body: reply, delayMs: 180 }],
    state: {
      engagement,
      boundary,
      terminal,
    },
    interestChange,
    terminalReason:
      terminalReason ??
      (turn === MAX_CONVERSATION_TURNS ? "completed" : null),
  };
}

export function authoredFallbackReply(input: {
  scenario: Scenario;
  turn: ConversationTurn;
  personaState: PersonaState;
}): PersonaReply {
  const { scenario, turn, personaState } = input;
  const fallbackTurn = Math.min(turn, 3) as 1 | 2 | 3;
  const reply =
    scenario.fallback.repliesByTurn[fallbackTurn][personaState.engagement];
  return {
    actions: [{ kind: "text", body: reply, delayMs: 180 }],
    state: {
      ...personaState,
      terminal: turn === MAX_CONVERSATION_TURNS,
    },
    interestChange: "same",
    terminalReason:
      turn === MAX_CONVERSATION_TURNS ? "completed" : null,
  };
}

export async function safePersonaReply(
  input: {
    scenario: Scenario;
    body: string;
    turn: ConversationTurn;
    personaState: PersonaState;
  },
  engine: typeof replyToUser = replyToUser,
): Promise<{ result: PersonaReply; usedFallback: boolean }> {
  try {
    return { result: engine(input), usedFallback: false };
  } catch {
    return {
      result: authoredFallbackReply(input),
      usedFallback: true,
    };
  }
}

function messageId(
  attemptId: string,
  speaker: "you" | "her",
  turn: number,
  sequence: number,
) {
  return `${attemptId}:${turn}:${speaker}:${sequence}`;
}

export function createAttempt(
  scenario: Scenario,
  attemptId: string = crypto.randomUUID(),
  now = new Date().toISOString(),
): Attempt {
  const messages: PracticeMessage[] =
    scenario.opening.kind === "persona_message"
      ? [
          {
            id: messageId(attemptId, "her", 0, 0),
            speaker: "her",
            body: scenario.opening.body,
            turn: 0,
            kind: "text",
            sequence: 0,
            createdAt: now,
          },
        ]
      : [];

  return {
    id: attemptId,
    scenarioId: scenario.id,
    messages,
    userTurn: 0,
    status: "active",
    personaState: { ...scenario.persona.initialState },
    startedAt: now,
  };
}

export function appendTurn(
  attempt: Attempt,
  body: string,
  personaReply: PersonaReply,
  now = new Date().toISOString(),
): Attempt {
  const pending = beginTurn(attempt, body, now);
  if (pending === attempt) return attempt;
  return applyPersonaReply(pending, personaReply, now);
}

export function beginTurn(
  attempt: Attempt,
  body: string,
  now = new Date().toISOString(),
): Attempt {
  if (
    attempt.status !== "active" &&
    attempt.status !== "idle"
  ) {
    return attempt;
  }
  if (attempt.userTurn >= MAX_CONVERSATION_TURNS) {
    return attempt;
  }

  const turn = (attempt.userTurn + 1) as ConversationTurn;
  return {
    ...attempt,
    messages: [
      ...attempt.messages,
      {
        id: messageId(attempt.id, "you", turn, 0),
        speaker: "you",
        body,
        turn,
        kind: "text",
        sequence: 0,
        deliveryStatus: "sent",
        createdAt: now,
      },
    ],
    userTurn: turn,
    status: "awaiting_reply",
    error: undefined,
  };
}

const deliveryOrder: MessageDeliveryStatus[] = [
  "sent",
  "delivered",
  "seen",
];

export function updateUserMessageDelivery(
  attempt: Attempt,
  turn: ConversationTurn,
  deliveryStatus: MessageDeliveryStatus,
): Attempt {
  let changed = false;
  const messages = attempt.messages.map((message) => {
    if (message.speaker !== "you" || message.turn !== turn) return message;
    const currentIndex = message.deliveryStatus
      ? deliveryOrder.indexOf(message.deliveryStatus)
      : -1;
    const nextIndex = deliveryOrder.indexOf(deliveryStatus);
    if (nextIndex <= currentIndex) return message;
    changed = true;
    return { ...message, deliveryStatus };
  });
  return changed ? { ...attempt, messages } : attempt;
}

export function appendPersonaAction(
  attempt: Attempt,
  action: PersonaAction,
  sequence: number,
  now = new Date().toISOString(),
): Attempt {
  if (attempt.status !== "awaiting_reply" || attempt.userTurn === 0) {
    return attempt;
  }
  if (
    attempt.messages.some(
      (message) =>
        message.speaker === "her" &&
        message.turn === attempt.userTurn &&
        message.sequence === sequence,
    )
  ) {
    return attempt;
  }
  return {
    ...attempt,
    messages: [
      ...attempt.messages,
      {
        id: messageId(attempt.id, "her", attempt.userTurn, sequence),
        speaker: "her",
        body: action.body,
        turn: attempt.userTurn,
        kind: action.kind,
        sequence,
        createdAt: now,
      },
    ],
  };
}

export function finalizePersonaTurn(
  attempt: Attempt,
  personaReply: PersonaReply,
): Attempt {
  if (attempt.status !== "awaiting_reply") return attempt;
  return {
    ...attempt,
    status:
      personaReply.state.terminal ||
      attempt.userTurn === MAX_CONVERSATION_TURNS
        ? "awaiting_judgment"
        : "active",
    personaState: personaReply.state,
    error: undefined,
  };
}

export function applyPersonaReply(
  attempt: Attempt,
  personaReply: PersonaReply,
  now = new Date().toISOString(),
): Attempt {
  let next = attempt;
  personaReply.actions.forEach((action, index) => {
    next = appendPersonaAction(next, action, index + 1, now);
  });
  return finalizePersonaTurn(next, personaReply);
}

export function replayResponses(
  scenario: Scenario,
  responses: Array<{ turn: ConversationTurn; body: string }>,
  attemptId: string,
): Attempt {
  let attempt = createAttempt(scenario, attemptId, "server-replay");

  for (const response of responses) {
    if (response.turn !== attempt.userTurn + 1 || attempt.personaState.terminal) {
      break;
    }
    const reaction = replyToUser({
      scenario,
      body: response.body,
      turn: response.turn,
      personaState: attempt.personaState,
    });
    attempt = appendTurn(attempt, response.body, reaction, "server-replay");
  }

  return attempt;
}

export function userResponses(attempt: Attempt) {
  return attempt.messages
    .filter(
      (message): message is PracticeMessage & { turn: ConversationTurn } =>
        message.speaker === "you" && message.turn > 0,
    )
    .map(({ turn, body }) => ({ turn, body }));
}
