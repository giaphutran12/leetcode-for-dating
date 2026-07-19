// Verdict helpers (plan: "Verdicts" — 0-3 FUMBLED, 4-7 COOKED, 8-10 ATE, and
// "The exact result copy should remain funny and encouraging. Do not humiliate
// the user"). The band copy is chosen deterministically by scenario id so a
// given attempt always reads the same line — no randomness in the UI layer.

import type { Verdict } from "../../domain/types";

// The band thresholds are owned by the domain scoring module — re-export the one
// implementation so the UI can't drift from it. (Only the band *copy* below is
// UI-local.)
export { verdictFor } from "../../domain/scoring";

const BAND_COPY: Record<Verdict, string[]> = {
  ATE: [
    "That was clean. She was into it and you never forced a thing. Ate.",
    "Warm, specific, and low-pressure the whole way through. Absolutely ate.",
    "You listened, you were funny, you made the ask easy to answer. Ate, no notes.",
  ],
  COOKED: [
    "Solid rep. The bones were there — tighten one thing and this is a clean one.",
    "You cooked. Real moments landed; a couple turns played it a little safe.",
    "Good instincts, decent execution. Sharpen the follow-through and it sings.",
  ],
  FUMBLED: [
    "Rough one, but that’s what practice is for. Read the note and run it back.",
    "You lost the thread here. No shame — this is exactly the rep worth repeating.",
    "Fumbled it, and now you know where. Reset and go again; it gets easier.",
  ],
};

// Deterministic pick: hash the scenario id to an index so the same scenario
// always shows the same encouraging line for a given verdict band.
export function verdictCopy(verdict: Verdict, scenarioId: string): string {
  const variants = BAND_COPY[verdict];
  let hash = 0;
  for (let i = 0; i < scenarioId.length; i += 1) {
    hash = (hash * 31 + scenarioId.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length];
}
