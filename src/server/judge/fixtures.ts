// Shared test fixtures for the judge server tests. Not production code — kept out
// of the *.test.ts glob so it can be imported by several test files. A well-formed
// model draft here means: five rubric entries, every evidence excerpt a verbatim
// substring of a real user turn, valid outcome — i.e. something finalizeJudgeResult
// will accept, so tests exercise the server's arithmetic/validation, not schema noise.

import type { CriterionId } from "../../domain/types";
import type { JudgeModelDraft } from "./schema";

export const CRITERIA: CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

export interface DraftOptions {
  scores?: [number, number, number, number, number];
  severity?: "none" | "cap" | "stop";
  codes?: string[];
  gateEvidence?: Array<{ turn: 1 | 2 | 3; excerpt: string; reason: string }>;
  // Force a rubric excerpt that is NOT in the transcript (evidence-validation test).
  badExcerpt?: string;
}

// Build a well-formed model draft for the given responses. By default all-2 scores,
// no gate, and every excerpt copied verbatim from turn 1's body.
export function makeDraft(
  responses: Array<{ turn: 1 | 2 | 3; body: string }>,
  options: DraftOptions = {},
): JudgeModelDraft {
  const turn1 = responses.find((response) => response.turn === 1);
  if (!turn1) throw new Error("fixture requires a turn 1 response");
  const excerpt = options.badExcerpt ?? turn1.body;
  const scores = options.scores ?? [2, 2, 2, 2, 2];

  return {
    rubric: CRITERIA.map((id, index) => ({
      id,
      score: scores[index] as 0 | 1 | 2,
      evidence: { turn: 1, excerpt, reason: `evidence for ${id}` },
      feedback: `feedback for ${id}`,
    })),
    hardGate: {
      severity: options.severity ?? "none",
      codes: options.codes ?? [],
      evidence: options.gateEvidence ?? [],
    },
    worked: ["opened from something you could both see"],
    improve: ["leave a little more room for her to talk"],
    betterResponse: "keep it lighter and give her an easy way in",
    outcome: {
      code: "conversation_continues",
      label: "Comfortable continuation",
      confidence: "medium",
      basis: [{ turn: 1, excerpt: turn1.body, reason: "kept the exchange going" }],
    },
  };
}

export const BUS_STOP_RESPONSES: Array<{ turn: 1 | 2 | 3; body: string }> = [
  { turn: 1, body: "what are you reading? the cover looks great" },
  { turn: 2, body: "nice, I love a slow burn mystery myself" },
  { turn: 3, body: "which bus are you catching?" },
];
