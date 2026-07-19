// Deterministic scoring arithmetic (plan: "Judge rubric", "Verdicts", "Hard
// gates", "Structured judgment"). The LLM owns the five 0-2 criterion scores and
// the gate severity; deterministic code owns the sum, the cap, and the verdict.
// Pure — no I/O, no randomness.

import type { GateSeverity, JudgeResult, Verdict } from "./types";

// Sum of the five criteria (each 0-2) for a raw score out of 10.
export function computeRawScore(rubric: JudgeResult["rubric"]): number {
  return rubric.reduce((total, item) => total + item.score, 0);
}

// The score ceiling implied by a hard-gate severity.
// stop-level violation caps at 2, cap-level at 4, no gate leaves the full 10.
export function capForSeverity(severity: GateSeverity): 2 | 4 | 10 {
  switch (severity) {
    case "stop":
      return 2;
    case "cap":
      return 4;
    case "none":
      return 10;
  }
}

// Clamp a raw score down to the gate ceiling. A raw score already under the cap
// is unaffected.
export function applyCap(rawScore: number, maxScore: number): number {
  return Math.min(rawScore, maxScore);
}

// Verdict thresholds on the final capped score: 0-3 FUMBLED, 4-7 COOKED, 8-10 ATE.
export function verdictFor(finalScore: number): Verdict {
  if (finalScore <= 3) return "FUMBLED";
  if (finalScore <= 7) return "COOKED";
  return "ATE";
}
