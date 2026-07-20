import { describe, expect, it } from "vitest";
import { getScenario } from "../../src/data/scenarios";
import type { CriterionId } from "../../src/domain/types";
import { attemptFromResponses } from "../../src/engine/conversationEngine";
import {
  JudgeEvidenceReferenceError,
  materializeJudgeEvidence,
} from "./provider";
import type { JudgeModelOutput } from "./schema";

const criterionIds: CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

function judgeOutput(turn: 1 | 2): JudgeModelOutput {
  const evidence = {
    turn,
    reason: "This user turn supports the judgment.",
  };
  return {
    safety: {
      severity: "none",
      confidence: "high",
      codes: [],
      evidence: [],
    },
    rubric: criterionIds.map((id) => ({
      id,
      score: 2,
      evidence,
      feedback: "This fits the conversation.",
    })),
    worked: ["The reply stayed connected to the conversation."],
    improve: ["Keep the next reply just as direct."],
    betterResponse: "okay wait the blueberry juice actually cooked 😭",
    outcome: {
      code: "conversation_continues",
      label: "Comfortable continuation",
      confidence: "high",
      basis: [evidence],
    },
  };
}

describe("judge evidence materialization", () => {
  it("attaches the original user message without asking the model to copy it", () => {
    const scenario = getScenario("RC-001")!;
    const original =
      "damn yeah, this blueberry juice looks hella nice fr... it’s actually good 😭";
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: original }],
      "attempt-materialize",
    );

    const output = judgeOutput(1);
    output.safety = {
      severity: "cap",
      confidence: "high",
      codes: ["insult"],
      evidence: [
        {
          turn: 1,
          reason: "This user turn supports the safety classification.",
        },
      ],
    };

    const draft = materializeJudgeEvidence(attempt, output);

    expect(draft.rubric[0]?.evidence.excerpt).toBe(original);
    expect(draft.safety.evidence[0]?.excerpt).toBe(original);
    expect(draft.outcome.basis[0]?.excerpt).toBe(original);
  });

  it("rejects a reference that is not a real user-authored turn", () => {
    const scenario = getScenario("RC-001")!;
    const attempt = attemptFromResponses(
      scenario,
      [{ turn: 1, body: "This is the only user turn." }],
      "attempt-missing-turn",
    );

    expect(() => materializeJudgeEvidence(attempt, judgeOutput(2))).toThrow(
      JudgeEvidenceReferenceError,
    );
  });
});
