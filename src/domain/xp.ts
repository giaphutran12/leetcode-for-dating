// Public practice XP (plan: "Gamification" — Leaderboard choice A). XP is only
// ever derived from a schema-validated judge result; the model never awards XP.
// Pure — no I/O, no randomness.

import type { Difficulty } from "./types";

// Difficulty bonus added to mastery XP: easy 0, medium 10, hard 20.
export function difficultyBonus(d: Difficulty): number {
  switch (d) {
    case "easy":
      return 0;
    case "medium":
      return 10;
    case "hard":
      return 20;
  }
}

// masteryXP = finalScore * 10 + difficultyBonus.
export function masteryXP(finalScore: number, difficulty: Difficulty): number {
  return finalScore * 10 + difficultyBonus(difficulty);
}

// publicXPDelta = max(0, masteryXP - previousBest) + 10 on first valid completion
// only. A stop-level violation awards zero public XP regardless of everything
// else, so replaying cannot farm XP and only improvement beyond a scenario's
// previous best adds mastery XP.
export function publicXPDelta(input: {
  masteryXP: number;
  previousBestMasteryXP: number;
  isFirstValidCompletion: boolean;
  stopViolation: boolean;
}): number {
  if (input.stopViolation) return 0;
  const improvement = Math.max(0, input.masteryXP - input.previousBestMasteryXP);
  const firstCompletionBonus = input.isFirstValidCompletion ? 10 : 0;
  return improvement + firstCompletionBonus;
}

// level = floor(totalPublicXP / 250) + 1.
export function levelFor(totalPublicXP: number): number {
  return Math.floor(totalPublicXP / 250) + 1;
}
