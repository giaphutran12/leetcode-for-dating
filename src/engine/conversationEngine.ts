// The ConversationEngine seam from the plan. The MVP's only implementation is
// the canonical authored deterministic engine: an async wrapper over the pure
// transition core so callers can treat persona replies uniformly (an LLM-backed
// persona is later scope, behind the same interface).

import type { Attempt, PersonaReply, PersonaState, Scenario } from "../domain/types";
import { transition } from "./deterministic/transition";

export interface ConversationEngine {
  reply(input: {
    scenario: Scenario;
    attempt: Attempt;
    personaState: PersonaState;
  }): Promise<PersonaReply>;
}

// Derive the turn just answered and the user's latest text from the attempt,
// then run the pure transition. Returns a resolved Promise — the core stays
// synchronous and pure; only this wrapper is async.
export function createDeterministicEngine(): ConversationEngine {
  return {
    reply({ scenario, attempt, personaState }) {
      const lastUserMessage = [...attempt.messages]
        .reverse()
        .find((message) => message.speaker === "you");
      const turn = (attempt.userTurn === 0 ? 1 : attempt.userTurn) as 1 | 2 | 3;
      const userText = lastUserMessage?.body ?? "";
      return Promise.resolve(
        transition({ scenario, turn, userText, personaState }),
      );
    },
  };
}

export const deterministicEngine: ConversationEngine = createDeterministicEngine();
