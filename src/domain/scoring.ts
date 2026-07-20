import { CRITERIA, OUTCOME_LABELS } from "./constants";
import type {
  Attempt,
  ConversationTurn,
  Evidence,
  HardGate,
  JudgeModelDraft,
  JudgeResult,
  Scenario,
} from "./types";

function userMessages(attempt: Attempt) {
  return attempt.messages.filter(
    (message): message is typeof message & { turn: ConversationTurn } =>
      message.speaker === "you" && message.turn > 0,
  );
}

export function verdictForScore(score: number): JudgeResult["verdict"] {
  if (score <= 3) return "FUMBLED";
  if (score <= 7) return "COOKED";
  return "ATE";
}

function evidenceExists(attempt: Attempt, evidence: Evidence): boolean {
  return userMessages(attempt).some(
    (message) =>
      message.turn === evidence.turn &&
      evidence.excerpt.length > 0 &&
      message.body === evidence.excerpt,
  );
}

export function finalizeJudgeResult(input: {
  attemptId: string;
  scenario: Scenario;
  attempt: Attempt;
  draft: JudgeModelDraft;
}): JudgeResult {
  const { attemptId, scenario, attempt } = input;
  const { safety } = input.draft;
  const effectiveSeverity =
    safety.severity === "stop" && safety.confidence !== "high"
      ? "cap"
      : safety.severity;
  const safetyTriggered = effectiveSeverity !== "none";
  if (
    (safetyTriggered &&
      (safety.codes.length === 0 ||
        safety.evidence.length === 0 ||
        safety.evidence.some((evidence) => !evidenceExists(attempt, evidence)))) ||
    (!safetyTriggered &&
      (safety.codes.length > 0 || safety.evidence.length > 0))
  ) {
    throw new Error("Judge safety assessment is invalid.");
  }
  const hardGate: HardGate = {
    triggered: safetyTriggered,
    severity: effectiveSeverity,
    codes: [...new Set(safety.codes)],
    maxScore:
      effectiveSeverity === "stop" ? 2 : effectiveSeverity === "cap" ? 4 : 10,
    evidence: safety.evidence,
  };
  const draft =
    hardGate.severity === "stop"
      ? {
          ...input.draft,
          outcome: {
            code: "boundary_crossed" as const,
            label: OUTCOME_LABELS.boundary_crossed,
            confidence: "high" as const,
            basis: hardGate.evidence,
          },
        }
      : input.draft;
  const ids = draft.rubric.map((item) => item.id);

  if (
    draft.rubric.length !== CRITERIA.length ||
    new Set(ids).size !== CRITERIA.length ||
    CRITERIA.some((id) => !ids.includes(id))
  ) {
    throw new Error("Judge output must contain five unique rubric criteria.");
  }

  for (const item of draft.rubric) {
    if (
      !Number.isInteger(item.score) ||
      item.score < 0 ||
      item.score > 2 ||
      !evidenceExists(attempt, item.evidence)
    ) {
      throw new Error("Judge rubric evidence or score is invalid.");
    }
  }

  if (
    draft.outcome.basis.length === 0 ||
    draft.outcome.basis.some((evidence) => !evidenceExists(attempt, evidence))
  ) {
    throw new Error("Judge outcome evidence is invalid.");
  }

  if (
    draft.outcome.code !== "boundary_crossed" &&
    !scenario.supportedOutcomeCodes.includes(draft.outcome.code)
  ) {
    throw new Error("Judge outcome is not available for this scenario.");
  }

  const rawScore = draft.rubric.reduce((sum, item) => sum + item.score, 0);
  const finalScore = Math.min(rawScore, hardGate.maxScore);

  return {
    schemaVersion: "1.0",
    attemptId,
    mode: "llm",
    hardGate,
    rubric: draft.rubric,
    rawScore,
    finalScore,
    verdict: verdictForScore(finalScore),
    worked: draft.worked,
    improve: draft.improve,
    betterResponse: draft.betterResponse,
    outcome: {
      ...draft.outcome,
      label: OUTCOME_LABELS[draft.outcome.code],
    },
  };
}
