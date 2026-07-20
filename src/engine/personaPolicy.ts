import type {
  ConversationEnergy,
  PersonaConversationMove,
  PersonaState,
} from "../domain/types";

export const PERSONA_CONVERSATION_MOVES = [
  "reveal",
  "tease",
  "challenge",
  "callback",
  "pivot",
  "close",
] as const satisfies readonly PersonaConversationMove[];

const energyOrder: ConversationEnergy[] = ["low", "matched", "high"];

export type NormalizedPersonaState = PersonaState & {
  energy: ConversationEnergy;
  recentMoves: PersonaConversationMove[];
  questionStreak: 0 | 1;
  callbackSeeds: string[];
};

export function normalizePersonaState(
  state: PersonaState,
): NormalizedPersonaState {
  return {
    ...state,
    energy: state.energy ?? "matched",
    recentMoves: (state.recentMoves ?? []).slice(-3),
    questionStreak: state.questionStreak === 1 ? 1 : 0,
    callbackSeeds: [...new Set(state.callbackSeeds ?? [])].slice(-4),
  };
}

export function personaTextHasQuestion(text: string): boolean {
  if (text.includes("?")) return true;
  if (/^what\s+(?:a|an)\b/i.test(text.trim())) return false;
  return /(?:^|[.!]\s+)(?:(?:who|what|when|where|why|how|which|do|did|does|are|is|was|were|can|could|would|will|have|has)\b|tell me\b)/i.test(
    text.trim(),
  );
}

function nextEnergy(
  current: ConversationEnergy,
  change: "down" | "same" | "up",
): ConversationEnergy {
  const currentIndex = energyOrder.indexOf(current);
  const delta = change === "up" ? 1 : change === "down" ? -1 : 0;
  return energyOrder[
    Math.max(0, Math.min(energyOrder.length - 1, currentIndex + delta))
  ];
}

export function advancePersonaPolicyState(input: {
  current: PersonaState;
  move: PersonaConversationMove;
  text: string;
  energyChange: "down" | "same" | "up";
  callbackSeed?: string | null;
}): Pick<
  NormalizedPersonaState,
  "energy" | "recentMoves" | "questionStreak" | "callbackSeeds"
> {
  const current = normalizePersonaState(input.current);
  const callbackSeeds = input.callbackSeed
    ? [...new Set([...current.callbackSeeds, input.callbackSeed])].slice(-4)
    : current.callbackSeeds;

  return {
    energy: nextEnergy(current.energy, input.energyChange),
    recentMoves: [...current.recentMoves, input.move].slice(-3),
    questionStreak: personaTextHasQuestion(input.text) ? 1 : 0,
    callbackSeeds,
  };
}

export function nextFallbackMove(
  state: PersonaState,
  terminal: boolean,
): PersonaConversationMove {
  if (terminal) return "close";
  const lastMove = normalizePersonaState(state).recentMoves.at(-1);
  return lastMove === "reveal" ? "pivot" : "reveal";
}
