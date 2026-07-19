import { describe, expect, it } from "vitest";
import {
  finalizeJudgeResult,
  isOutcomeCode,
  isVerdict,
  type FinalizeContext,
  type JudgeDraft,
} from "./validation";

const ctx: FinalizeContext = {
  attemptId: "attempt-123",
  responses: [
    { turn: 1, body: "Is that a good book? I keep meaning to read more." },
    { turn: 2, body: "I'd love to grab coffee sometime this week if you're free." },
  ],
};

function validDraft(): JudgeDraft {
  const ids = [
    "context_naturalness",
    "reciprocity_listening",
    "playfulness_personality",
    "respect_calibration",
    "challenge_objective",
  ] as const;
  return {
    hardGate: { triggered: false, severity: "none", codes: [], evidence: [] },
    rubric: ids.map((id) => ({
      id,
      score: 2,
      evidence: { turn: 1, excerpt: "good book", reason: "specific and natural" },
      feedback: "nice",
    })),
    worked: ["Opened from something you could both see"],
    improve: ["Give her a bit more of you"],
    betterResponse: "That book any good? I keep meaning to read more and never do.",
    outcome: {
      code: "contact_exchanged",
      label: "Numbers exchanged",
      confidence: "medium",
      basis: [{ turn: 2, excerpt: "grab coffee", reason: "clear calibrated ask" }],
    },
  };
}

describe("finalizeJudgeResult — happy path", () => {
  it("accepts a well-formed draft and recomputes the arithmetic", () => {
    const outcome = finalizeJudgeResult(validDraft(), ctx);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { result } = outcome;
    expect(result.schemaVersion).toBe("1.0");
    expect(result.mode).toBe("llm");
    expect(result.attemptId).toBe("attempt-123");
    expect(result.rawScore).toBe(10);
    expect(result.hardGate.maxScore).toBe(10);
    expect(result.finalScore).toBe(10);
    expect(result.verdict).toBe("ATE");
  });
});

describe("finalizeJudgeResult — rejections", () => {
  it("rejects a missing criterion", () => {
    const draft = validDraft();
    draft.rubric = draft.rubric.slice(0, 4);
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("exactly 5"))).toBe(true);
    expect(outcome.errors.some((e) => e.includes("missing criterion"))).toBe(true);
  });

  it("rejects a duplicate criterion", () => {
    const draft = validDraft();
    draft.rubric[1] = { ...draft.rubric[1], id: "context_naturalness" };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("rejects a score of 3", () => {
    const draft = validDraft();
    draft.rubric[0] = { ...draft.rubric[0], score: 3 };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("must be 0, 1, or 2"))).toBe(true);
  });

  it("rejects an excerpt that is not a substring of the cited turn", () => {
    const draft = validDraft();
    draft.rubric[0] = {
      ...draft.rubric[0],
      evidence: { turn: 1, excerpt: "never said this", reason: "r" },
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("not an exact substring"))).toBe(true);
  });

  it("rejects evidence citing turn 3 when only two responses exist", () => {
    const draft = validDraft();
    draft.rubric[0] = {
      ...draft.rubric[0],
      evidence: { turn: 3, excerpt: "good book", reason: "r" },
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("not in the transcript"))).toBe(true);
  });

  it("rejects a bad outcome code", () => {
    const draft = validDraft();
    draft.outcome = { ...draft.outcome, code: "she_fell_in_love" };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("unknown code"))).toBe(true);
  });

  it("rejects an empty excerpt in rubric evidence", () => {
    const draft = validDraft();
    draft.rubric[0] = {
      ...draft.rubric[0],
      evidence: { turn: 1, excerpt: "", reason: "cited nothing" },
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("empty or whitespace-only"))).toBe(
      true,
    );
  });

  it("rejects a whitespace-only excerpt in hardGate evidence", () => {
    const draft = validDraft();
    draft.hardGate = {
      triggered: false,
      severity: "none",
      codes: [],
      evidence: [{ turn: 1, excerpt: "   ", reason: "just whitespace" }],
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("empty or whitespace-only"))).toBe(
      true,
    );
  });

  it("rejects a whitespace-only excerpt in outcome basis", () => {
    const draft = validDraft();
    draft.outcome = {
      ...draft.outcome,
      basis: [{ turn: 2, excerpt: "\t\n", reason: "tabs and newlines" }],
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.some((e) => e.includes("empty or whitespace-only"))).toBe(
      true,
    );
  });
});

describe("finalizeJudgeResult — recomputation overrides draft lies", () => {
  it("caps a stop-gated perfect-looking draft to 2 and FUMBLED", () => {
    // A malicious draft: all criteria maxed AND severity stop, hoping for 10/ATE.
    const draft = validDraft();
    draft.hardGate = {
      triggered: false,
      severity: "stop",
      codes: ["directed_sexual_pressure"],
      evidence: [{ turn: 2, excerpt: "grab coffee", reason: "gate evidence" }],
    };
    const outcome = finalizeJudgeResult(draft, ctx);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.rawScore).toBe(10);
    expect(outcome.result.hardGate.maxScore).toBe(2);
    expect(outcome.result.hardGate.triggered).toBe(true);
    expect(outcome.result.finalScore).toBe(2);
    expect(outcome.result.verdict).toBe("FUMBLED");
  });
});

describe("guards", () => {
  it("isVerdict", () => {
    expect(isVerdict("ATE")).toBe(true);
    expect(isVerdict("cooked")).toBe(false);
    expect(isVerdict(3)).toBe(false);
  });

  it("isOutcomeCode", () => {
    expect(isOutcomeCode("graceful_exit")).toBe(true);
    expect(isOutcomeCode("nope")).toBe(false);
    expect(isOutcomeCode(null)).toBe(false);
  });
});
