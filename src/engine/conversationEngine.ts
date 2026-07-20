import type {
  Attempt,
  ConversationTurn,
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
import {
  advancePersonaPolicyState,
  nextFallbackMove,
  normalizePersonaState,
  personaTextHasQuestion,
} from "./personaPolicy";

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

export function authoredFallbackReply(input: {
  scenario: Scenario;
  turn: ConversationTurn;
  personaState: PersonaState;
}): PersonaReply {
  const { scenario, turn, personaState } = input;
  const fallbackTurn = Math.min(turn, 3) as 1 | 2 | 3;
  const policyState = normalizePersonaState(personaState);
  const replies = scenario.fallback.repliesByTurn[fallbackTurn];
  const candidates = [
    replies[personaState.engagement],
    replies.neutral,
    replies.low,
    replies.closed,
  ];
  const reply =
    policyState.questionStreak === 1
      ? candidates.find((candidate) => !personaTextHasQuestion(candidate)) ??
        replies.low
      : candidates[0];
  const terminal = turn === MAX_CONVERSATION_TURNS;
  const move = nextFallbackMove(policyState, terminal);
  const nextPolicyState = advancePersonaPolicyState({
    current: policyState,
    move,
    text: reply,
    energyChange: "same",
  });
  return {
    actions: [{ kind: "text", body: reply, delayMs: 180 }],
    move,
    state: {
      ...policyState,
      ...nextPolicyState,
      terminal,
    },
    interestChange: "same",
    terminalReason: terminal ? "completed" : null,
  };
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

export function attemptFromResponses(
  scenario: Scenario,
  responses: Array<{ turn: ConversationTurn; body: string }>,
  attemptId: string,
): Attempt {
  return responses.reduce((attempt, response) => {
    if (response.turn !== attempt.userTurn + 1 || attempt.personaState.terminal) {
      return attempt;
    }
    return appendTurn(
      attempt,
      response.body,
      authoredFallbackReply({
        scenario,
        turn: response.turn,
        personaState: attempt.personaState,
      }),
      "test-fixture",
    );
  }, createAttempt(scenario, attemptId, "test-fixture"));
}

export function userResponses(attempt: Attempt) {
  return attempt.messages
    .filter(
      (message): message is PracticeMessage & { turn: ConversationTurn } =>
        message.speaker === "you" && message.turn > 0,
    )
    .map(({ turn, body }) => ({ turn, body }));
}
