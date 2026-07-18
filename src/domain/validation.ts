// Server-side judgment gatekeeper (plan: "Structured judgment" validation rules,
// "Required LLM judge" server responsibilities 7-11). The LLM produces a draft;
// deterministic code here refuses to trust any of its arithmetic or claims. It
// verifies structure, verifies every cited excerpt is real, recomputes the score
// / cap / verdict, and only then returns a JudgeResult. Pure — no I/O.

import { applyCap, capForSeverity, computeRawScore, verdictFor } from "./scoring";
import type {
  CriterionId,
  Evidence,
  GateSeverity,
  JudgeResult,
  OutcomeCode,
  Verdict,
} from "./types";

const CRITERION_IDS: readonly CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

const OUTCOME_CODES: readonly OutcomeCode[] = [
  "conversation_continues",
  "shared_interest",
  "contact_exchanged",
  "date_invited",
  "date_agreed",
  "graceful_exit",
  "low_interest",
  "incompatible",
  "boundary_crossed",
];

const VERDICTS: readonly Verdict[] = ["FUMBLED", "COOKED", "ATE"];

const GATE_SEVERITIES: readonly GateSeverity[] = ["none", "cap", "stop"];

const CONFIDENCES: readonly JudgeResult["outcome"]["confidence"][] = [
  "low",
  "medium",
  "high",
];

// Minimal guards reused by later storage-layer validation.
export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}

export function isOutcomeCode(value: unknown): value is OutcomeCode {
  return (
    typeof value === "string" && (OUTCOME_CODES as readonly string[]).includes(value)
  );
}

// Evidence as it arrives from the model: turn and excerpt are untrusted, so turn
// is widened to number and validated against the real transcript here.
interface DraftEvidence {
  turn: number;
  excerpt: string;
  reason: string;
}

export interface JudgeDraft {
  hardGate: {
    triggered: boolean;
    severity: GateSeverity;
    codes: string[];
    evidence: DraftEvidence[];
  };
  rubric: Array<{
    id: string;
    score: number;
    evidence: DraftEvidence;
    feedback: string;
  }>;
  worked: string[];
  improve: string[];
  betterResponse: string;
  outcome: {
    code: string;
    label: string;
    confidence: string;
    basis: DraftEvidence[];
  };
}

export interface FinalizeContext {
  attemptId: string;
  responses: Array<{ turn: 1 | 2 | 3; body: string }>;
}

export type FinalizeResult =
  | { ok: true; result: JudgeResult }
  | { ok: false; errors: string[] };

export function finalizeJudgeResult(
  draft: JudgeDraft,
  ctx: FinalizeContext,
): FinalizeResult {
  const errors: string[] = [];

  const bodyByTurn = new Map<number, string>();
  for (const response of ctx.responses) {
    bodyByTurn.set(response.turn, response.body);
  }

  // Verify one piece of evidence cites a real user turn and quotes it exactly.
  const verifyEvidence = (evidence: DraftEvidence, where: string): void => {
    const body = bodyByTurn.get(evidence.turn);
    if (body === undefined) {
      errors.push(
        `${where}: cites turn ${evidence.turn}, which is not in the transcript`,
      );
      return;
    }
    if (!body.includes(evidence.excerpt)) {
      errors.push(
        `${where}: excerpt is not an exact substring of turn ${evidence.turn}`,
      );
    }
  };

  // Rubric: exactly five entries, one per criterion, no duplicates, scores 0-2.
  if (draft.rubric.length !== 5) {
    errors.push(`rubric must have exactly 5 entries, got ${draft.rubric.length}`);
  }
  const seen = new Set<string>();
  for (const item of draft.rubric) {
    if (!(CRITERION_IDS as readonly string[]).includes(item.id)) {
      errors.push(`rubric: unknown criterion id "${item.id}"`);
    } else if (seen.has(item.id)) {
      errors.push(`rubric: duplicate criterion "${item.id}"`);
    } else {
      seen.add(item.id);
    }
    if (item.score !== 0 && item.score !== 1 && item.score !== 2) {
      errors.push(`rubric: score for "${item.id}" must be 0, 1, or 2`);
    }
    verifyEvidence(item.evidence, `rubric "${item.id}"`);
  }
  for (const id of CRITERION_IDS) {
    if (!seen.has(id)) {
      errors.push(`rubric: missing criterion "${id}"`);
    }
  }

  // Hard gate: severity must be known; all gate evidence must be real excerpts.
  if (!(GATE_SEVERITIES as readonly string[]).includes(draft.hardGate.severity)) {
    errors.push(`hardGate: unknown severity "${draft.hardGate.severity}"`);
  }
  draft.hardGate.evidence.forEach((evidence, index) => {
    verifyEvidence(evidence, `hardGate evidence[${index}]`);
  });

  // Outcome: code must be valid, confidence known, basis excerpts real.
  if (!isOutcomeCode(draft.outcome.code)) {
    errors.push(`outcome: unknown code "${draft.outcome.code}"`);
  }
  if (!(CONFIDENCES as readonly string[]).includes(draft.outcome.confidence)) {
    errors.push(`outcome: unknown confidence "${draft.outcome.confidence}"`);
  }
  draft.outcome.basis.forEach((evidence, index) => {
    verifyEvidence(evidence, `outcome basis[${index}]`);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Everything checked out. Recompute all arithmetic from validated inputs —
  // never trust the draft's rawScore, finalScore, or verdict.
  const rubric = draft.rubric.map((item) => ({
    id: item.id as CriterionId,
    score: item.score as 0 | 1 | 2,
    evidence: toEvidence(item.evidence),
    feedback: item.feedback,
  }));

  const severity = draft.hardGate.severity;
  const maxScore = capForSeverity(severity);
  const rawScore = computeRawScore(rubric);
  const finalScore = applyCap(rawScore, maxScore);
  const verdict = verdictFor(finalScore);

  const result: JudgeResult = {
    schemaVersion: "1.0",
    attemptId: ctx.attemptId,
    mode: "llm",
    hardGate: {
      triggered: severity !== "none",
      severity,
      codes: draft.hardGate.codes,
      maxScore,
      evidence: draft.hardGate.evidence.map(toEvidence),
    },
    rubric,
    rawScore,
    finalScore,
    verdict,
    worked: draft.worked,
    improve: draft.improve,
    betterResponse: draft.betterResponse,
    outcome: {
      code: draft.outcome.code as OutcomeCode,
      label: draft.outcome.label,
      confidence: draft.outcome.confidence as JudgeResult["outcome"]["confidence"],
      basis: draft.outcome.basis.map(toEvidence),
    },
  };

  return { ok: true, result };
}

// Narrow a validated draft evidence (turn already confirmed to be 1|2|3) to the
// public Evidence type.
function toEvidence(evidence: DraftEvidence): Evidence {
  return {
    turn: evidence.turn as 1 | 2 | 3,
    excerpt: evidence.excerpt,
    reason: evidence.reason,
  };
}
