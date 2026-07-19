// The canonical, pure persona transition function. This is the shared
// conversation core: the client hook wraps it, and the judge server imports it
// (via replayTranscript) to reconstruct transcripts server-side. It must stay
// pure, synchronous, and free of Date.now / randomness so client and server
// always agree.

import type { Engagement, PersonaReply, PersonaState, Scenario } from "../../domain/types";
import { matchesAnySignal, tokenize } from "./matcher";

export interface TransitionInput {
  scenario: Scenario;
  // The user turn just answered (three-turn state machine).
  turn: 1 | 2 | 3;
  userText: string;
  // Persona state BEFORE this turn.
  personaState: PersonaState;
}

// Engagement ladder, low to high. Movement clamps at both ends.
const LADDER: readonly Engagement[] = ["closed", "low", "neutral", "warm"];

function stepUp(engagement: Engagement): Engagement {
  const index = LADDER.indexOf(engagement);
  return LADDER[Math.min(index + 1, LADDER.length - 1)];
}

function stepDown(engagement: Engagement): Engagement {
  const index = LADDER.indexOf(engagement);
  return LADDER[Math.max(index - 1, 0)];
}

function replyFor(scenario: Scenario, turn: 1 | 2 | 3, engagement: Engagement): string {
  return scenario.fallback.repliesByTurn[turn][engagement];
}

// Apply the deterministic branch order and return the resulting PersonaReply.
// Branch priority (highest first): boundary, user exit, low-interest, positive,
// then fall through to the current engagement.
export function transition({
  scenario,
  turn,
  userText,
  personaState,
}: TransitionInput): PersonaReply {
  const { fallback } = scenario;
  const tokens = tokenize(userText);
  const boundary = personaState.boundary;

  // 1. Boundary — a crossed line. Terminal, firm dedicated close.
  if (matchesAnySignal(tokens, fallback.boundarySignals)) {
    return {
      reply: fallback.boundaryReply,
      state: { engagement: "closed", boundary: "explicit", terminal: true },
      interestChange: "down",
      terminalReason: "boundary",
    };
  }

  // 2. User exit — the user politely bows out. One warm closing reply, terminal,
  // engagement unchanged.
  if (matchesAnySignal(tokens, fallback.exitSignals)) {
    return {
      reply: fallback.exitReply,
      state: { engagement: personaState.engagement, boundary, terminal: true },
      interestChange: "same",
      terminalReason: "user_exit",
    };
  }

  // 3. Low-interest — engagement slips down one level. If already closed, the
  // persona itself exits.
  if (matchesAnySignal(tokens, fallback.lowInterestSignals)) {
    if (personaState.engagement === "closed") {
      return {
        reply: replyFor(scenario, turn, "closed"),
        state: { engagement: "closed", boundary, terminal: true },
        interestChange: "down",
        terminalReason: "persona_exit",
      };
    }
    const engagement = stepDown(personaState.engagement);
    return {
      reply: replyFor(scenario, turn, engagement),
      state: { engagement, boundary, terminal: turn === 3 },
      interestChange: "down",
      terminalReason: turn === 3 ? "completed" : null,
    };
  }

  // 4. Positive — engagement rises one level (clamped at warm).
  if (matchesAnySignal(tokens, fallback.positiveSignals)) {
    const engagement = stepUp(personaState.engagement);
    return {
      reply: replyFor(scenario, turn, engagement),
      state: { engagement, boundary, terminal: turn === 3 },
      interestChange: "up",
      terminalReason: turn === 3 ? "completed" : null,
    };
  }

  // 5. Fall through — engagement unchanged. Prompt-injection text lands here: it
  // matches no signal list and never changes persona policy or hidden state.
  const engagement = personaState.engagement;
  return {
    reply: replyFor(scenario, turn, engagement),
    state: { engagement, boundary, terminal: turn === 3 },
    interestChange: "same",
    terminalReason: turn === 3 ? "completed" : null,
  };
}
