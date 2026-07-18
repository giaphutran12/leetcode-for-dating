// Test helpers: a scripted conversation engine and judge for driving the
// scenario flow deterministically, plus a JudgeResult builder for result-view
// tests. Not a *.test file, so it is not collected as a suite.

import type { ConversationEngine } from "../engine/conversationEngine";
import type {
  CriterionId,
  JudgeApiResponse,
  JudgeResult,
  PersonaReply,
  PersonaState,
} from "../domain/types";
import type { JudgeFn } from "../hooks/usePracticeSession";

const CRITERIA: CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

// An engine that always answers, staying non-terminal until turn 3 completes.
export function scriptedEngine(): ConversationEngine {
  return {
    reply({ attempt, personaState }) {
      const turn = (attempt.userTurn === 0 ? 1 : attempt.userTurn) as 1 | 2 | 3;
      const state: PersonaState = { ...personaState, terminal: turn === 3 };
      const reply: PersonaReply = {
        reply: `her reply on turn ${turn}`,
        state,
        interestChange: "same",
        terminalReason: turn === 3 ? "completed" : null,
      };
      return Promise.resolve(reply);
    },
  };
}

export interface JudgeResultOptions {
  scores?: [number, number, number, number, number];
  severity?: "none" | "cap" | "stop";
  finalScore?: number;
  attemptId?: string;
}

export function makeJudgeResult(options: JudgeResultOptions = {}): JudgeResult {
  const scores = options.scores ?? [2, 2, 2, 2, 2];
  const raw = scores.reduce((a, b) => a + b, 0);
  const severity = options.severity ?? "none";
  const maxScore = severity === "stop" ? 2 : severity === "cap" ? 4 : 10;
  const finalScore = options.finalScore ?? Math.min(raw, maxScore);
  const verdict =
    finalScore >= 8 ? "ATE" : finalScore >= 4 ? "COOKED" : "FUMBLED";

  return {
    schemaVersion: "1.0",
    attemptId: options.attemptId ?? "attempt-1",
    mode: "llm",
    hardGate: {
      triggered: severity !== "none",
      severity,
      codes: severity === "stop" ? ["coercion"] : [],
      maxScore,
      evidence:
        severity === "stop"
          ? [{ turn: 1, excerpt: "give me your number now", reason: "coercive demand" }]
          : [],
    },
    rubric: CRITERIA.map((id, index) => ({
      id,
      score: scores[index] as 0 | 1 | 2,
      evidence: {
        turn: 1,
        excerpt: `evidence excerpt for ${id}`,
        reason: `reason for ${id}`,
      },
      feedback: `feedback for ${id}`,
    })),
    rawScore: raw,
    finalScore,
    verdict,
    worked: ["opened from something real"],
    improve: ["leave more room for her to talk"],
    betterResponse: "keep it lighter and give her an easy way in",
    outcome: {
      code: "conversation_continues",
      label: "Comfortable continuation",
      confidence: "medium",
      basis: [{ turn: 1, excerpt: "opener", reason: "kept it going" }],
    },
  };
}

// A judge that resolves ok with the given result.
export function okJudge(result: JudgeResult): JudgeFn {
  return () => Promise.resolve<JudgeApiResponse>({ ok: true, result });
}

// A judge that fails `failures` times (retryable) then succeeds with `result`.
export function flakyJudge(result: JudgeResult, failures: number): JudgeFn {
  let calls = 0;
  return () => {
    calls += 1;
    if (calls <= failures) {
      return Promise.resolve<JudgeApiResponse>({
        ok: false,
        retryable: true,
        code: "judge_timeout",
        message: "timed out",
      });
    }
    return Promise.resolve<JudgeApiResponse>({ ok: true, result });
  };
}

// A judge whose first `failures` responses are NON-retryable (e.g. an
// unconfigured judge or an auth failure) then succeeds — config can change
// between attempts, so the UI must still offer Retry judgment. Defaults to the
// judge_unconfigured code.
type JudgeErrorCode = Extract<JudgeApiResponse, { ok: false }>["code"];

export function unretryableThenOkJudge(
  result: JudgeResult,
  failures = 1,
  code: JudgeErrorCode = "judge_unconfigured",
): JudgeFn {
  let calls = 0;
  return () => {
    calls += 1;
    if (calls <= failures) {
      return Promise.resolve<JudgeApiResponse>({
        ok: false,
        retryable: false,
        code,
        message: "judge unavailable",
      });
    }
    return Promise.resolve<JudgeApiResponse>({ ok: true, result });
  };
}
