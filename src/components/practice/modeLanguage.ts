// Mode-correct interface language (plan: "Text-first simulation" — BINDING copy).
// Text is the rendering layer; the fictional medium is the scenario's mode. These
// strings are fixed by the plan and shared by the intro, practice, and result
// views so the badge, prompt, and speaker labels can never drift between screens.

import type { Difficulty, ScenarioMode } from "../../domain/types";

export interface ModeLanguage {
  badge: string;
  prompt: string;
  youLabel: string;
  herLabel: string;
  thinking: string;
}

const IN_PERSON: ModeLanguage = {
  badge: "IN PERSON",
  prompt: "What would you say?",
  youLabel: "You say",
  herLabel: "She says",
  thinking: "She pauses…",
};

const MESSAGING: ModeLanguage = {
  badge: "MESSAGING",
  prompt: "What would you text?",
  // Messaging is a chat surface, so the bubbles read like a chat log: You / Her.
  // In-person keeps the binding "You say" / "She says" spoken framing.
  youLabel: "You",
  herLabel: "Her",
  thinking: "She’s typing…",
};

export function modeLanguage(mode: ScenarioMode): ModeLanguage {
  return mode === "in_person" ? IN_PERSON : MESSAGING;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABEL[difficulty];
}
