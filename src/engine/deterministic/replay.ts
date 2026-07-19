// Pure reconstruction of a full canonical transcript from user-authored
// responses. The judge server (Task 4) imports this so the server and client
// produce identical transcripts from the same responses. No Date.now, no
// randomness, deterministic attempt-agnostic message ids.

import type { PersonaReply, PersonaState, PracticeMessage, Scenario } from "../../domain/types";
import { transition } from "./transition";

// A fixed timestamp keeps replayed messages byte-for-byte deterministic. Real
// wall-clock time belongs to the live hook, not to canonical replay.
const REPLAY_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export interface ReplayResult {
  messages: PracticeMessage[];
  personaReplies: PersonaReply[];
  finalState: PersonaState;
}

export function replayTranscript(
  scenario: Scenario,
  responses: Array<{ turn: 1 | 2 | 3; body: string }>,
): ReplayResult {
  const messages: PracticeMessage[] = [];
  const personaReplies: PersonaReply[] = [];
  let state: PersonaState = scenario.persona.initialState;

  if (scenario.opening.kind === "persona_message") {
    messages.push({
      id: `${scenario.id}-t0-her`,
      speaker: "her",
      body: scenario.opening.body,
      turn: 0,
      createdAt: REPLAY_TIMESTAMP,
    });
  }

  for (const response of responses) {
    // Once the exchange is terminal, later responses are ignored — a boundary,
    // user exit, or persona exit ends the conversation for good.
    if (state.terminal) break;

    messages.push({
      id: `${scenario.id}-t${response.turn}-you`,
      speaker: "you",
      body: response.body,
      turn: response.turn,
      createdAt: REPLAY_TIMESTAMP,
    });

    const reply = transition({
      scenario,
      turn: response.turn,
      userText: response.body,
      personaState: state,
    });
    personaReplies.push(reply);

    messages.push({
      id: `${scenario.id}-t${response.turn}-her`,
      speaker: "her",
      body: reply.reply,
      turn: response.turn,
      createdAt: REPLAY_TIMESTAMP,
    });

    state = reply.state;
  }

  return { messages, personaReplies, finalState: state };
}
