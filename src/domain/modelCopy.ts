import type { Evidence, JudgeModelDraft } from "./types";

const bannedFantasyMetaphor = /\b(?:gremlins?|kremlins?|goblins?)\b/gi;

export function cleanModelCopy(value: string): string {
  return value
    .replace(/[—–]/g, " - ")
    .replace(bannedFantasyMetaphor, "mess")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanEvidenceReason(evidence: Evidence): Evidence {
  return {
    ...evidence,
    reason: cleanModelCopy(evidence.reason),
  };
}

export function cleanJudgeCopy(draft: JudgeModelDraft): JudgeModelDraft {
  return {
    ...draft,
    safety: {
      ...draft.safety,
      evidence: draft.safety.evidence.map(cleanEvidenceReason),
    },
    rubric: draft.rubric.map((item) => ({
      ...item,
      evidence: cleanEvidenceReason(item.evidence),
      feedback: cleanModelCopy(item.feedback),
    })),
    worked: draft.worked.map(cleanModelCopy),
    improve: draft.improve.map(cleanModelCopy),
    betterResponse: cleanModelCopy(draft.betterResponse),
    outcome: {
      ...draft.outcome,
      label: cleanModelCopy(draft.outcome.label),
      basis: draft.outcome.basis.map(cleanEvidenceReason),
    },
  };
}
