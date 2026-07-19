import { describe, expect, it } from "vitest";
import { scenarioById } from "../data/scenarios";
import { defaultProgress } from "../storage/progressStore";
import {
  applyJudgeResult,
  nextRecommendedScenarioId,
  unlockedScenarioIds,
} from "./progression";
import type {
  CriterionId,
  JudgeResult,
  OutcomeCode,
  Progress,
  Scenario,
} from "./types";

const busStop = scenarioById("spark-bus-stop") as Scenario; // spark, easy
const cafe = scenarioById("spark-cafe-focus") as Scenario; // spark, medium
const lowInterest = scenarioById("connection-handle-low-interest") as Scenario; // connection, hard

const CRITERIA: CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

interface ResultOpts {
  finalScore: number;
  severity?: "none" | "cap" | "stop";
  outcome?: OutcomeCode;
  criterionScores?: Partial<Record<CriterionId, 0 | 1 | 2>>;
}

// A minimal but well-formed JudgeResult for progression tests. Evidence content
// is irrelevant here (that is validated at the judge boundary).
function makeResult(opts: ResultOpts): JudgeResult {
  const severity = opts.severity ?? "none";
  const evidence = { turn: 1 as const, excerpt: "hi", reason: "r" };
  return {
    schemaVersion: "1.0",
    attemptId: "a1",
    mode: "llm",
    hardGate: {
      triggered: severity !== "none",
      severity,
      codes: [],
      maxScore: severity === "stop" ? 2 : severity === "cap" ? 4 : 10,
      evidence: [],
    },
    rubric: CRITERIA.map((id) => ({
      id,
      score: opts.criterionScores?.[id] ?? 1,
      evidence,
      feedback: "",
    })),
    rawScore: opts.finalScore,
    finalScore: opts.finalScore,
    verdict: opts.finalScore <= 3 ? "FUMBLED" : opts.finalScore <= 7 ? "COOKED" : "ATE",
    worked: [],
    improve: [],
    betterResponse: "",
    outcome: {
      code: opts.outcome ?? "conversation_continues",
      label: "",
      confidence: "medium",
      basis: [],
    },
  };
}

describe("applyJudgeResult — XP", () => {
  it("awards mastery XP plus a one-time +10 on first completion", () => {
    const result = makeResult({ finalScore: 8 }); // easy: masteryXP = 80
    const outcome = applyJudgeResult(defaultProgress(), busStop, result, "2026-07-18");
    expect(outcome.masteryXP).toBe(80);
    expect(outcome.publicXPDelta).toBe(90); // 80 improvement + 10 first-completion
    expect(outcome.isFirstCompletion).toBe(true);
    expect(outcome.next.publicXP).toBe(90);
    expect(outcome.next.completedScenarioIds).toContain("spark-bus-stop");
  });

  it("adds zero XP on a retry below the previous best", () => {
    const first = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 8 }), "2026-07-18");
    const retry = applyJudgeResult(first.next, busStop, makeResult({ finalScore: 5 }), "2026-07-18");
    expect(retry.publicXPDelta).toBe(0);
    expect(retry.isFirstCompletion).toBe(false);
    expect(retry.isNewBestScore).toBe(false);
    expect(retry.next.publicXP).toBe(first.next.publicXP);
    // Personal best is not lowered by a worse retry.
    expect(retry.next.bestScores["spark-bus-stop"]).toBe(8);
  });

  it("adds only the positive difference on a retry above the previous best", () => {
    const first = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    const better = applyJudgeResult(first.next, busStop, makeResult({ finalScore: 9 }), "2026-07-18");
    // mastery 60 -> 90, difference 30, no first-completion bonus this time.
    expect(better.publicXPDelta).toBe(30);
    expect(better.isNewBestScore).toBe(true);
    expect(better.next.bestScores["spark-bus-stop"]).toBe(9);
    expect(better.next.bestMasteryXP["spark-bus-stop"]).toBe(90);
  });

  it("awards zero XP and no completion on a stop-level violation", () => {
    const stop = makeResult({ finalScore: 2, severity: "stop", outcome: "boundary_crossed" });
    const outcome = applyJudgeResult(defaultProgress(), busStop, stop, "2026-07-18");
    expect(outcome.publicXPDelta).toBe(0);
    expect(outcome.isFirstCompletion).toBe(false);
    expect(outcome.next.completedScenarioIds).not.toContain("spark-bus-stop");
    expect(outcome.next.publicXP).toBe(0);
    // A stop attempt does not poison the anti-farm ledger.
    expect(outcome.next.bestMasteryXP["spark-bus-stop"]).toBeUndefined();
    expect(outcome.unlockedAchievementIds).toEqual([]);
  });

  it("flags leveledUp when a completion crosses a 250-XP boundary", () => {
    // Seed just below level 2 (needs 250 total). Hard scenario, finalScore 10:
    // masteryXP = 120; first completion + 120 -> comfortably over 250.
    const seeded: Progress = { ...defaultProgress(), publicXP: 240, level: 1 };
    const outcome = applyJudgeResult(seeded, lowInterest, makeResult({ finalScore: 10, outcome: "graceful_exit" }), "2026-07-18");
    expect(outcome.leveledUp).toBe(true);
    expect(outcome.next.level).toBeGreaterThanOrEqual(2);
  });
});

describe("applyJudgeResult — streak", () => {
  it("opens a streak at 1 on the first ever completion", () => {
    const outcome = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    expect(outcome.next.streak).toBe(1);
    expect(outcome.next.lastPracticeDay).toBe("2026-07-18");
  });

  it("keeps the streak on a same-day repeat", () => {
    const day1 = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    const same = applyJudgeResult(day1.next, cafe, makeResult({ finalScore: 6 }), "2026-07-18");
    expect(same.next.streak).toBe(1);
  });

  it("increments the streak the day after", () => {
    const day1 = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    const day2 = applyJudgeResult(day1.next, cafe, makeResult({ finalScore: 6 }), "2026-07-19");
    expect(day2.next.streak).toBe(2);
  });

  it("resets the streak to 1 after a gap of two or more days", () => {
    const day1 = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    const day2 = applyJudgeResult(day1.next, cafe, makeResult({ finalScore: 6 }), "2026-07-19");
    expect(day2.next.streak).toBe(2);
    const later = applyJudgeResult(day2.next, busStop, makeResult({ finalScore: 6 }), "2026-07-25");
    expect(later.next.streak).toBe(1);
  });

  it("does not advance the streak on a stop-level attempt", () => {
    const day1 = applyJudgeResult(defaultProgress(), busStop, makeResult({ finalScore: 6 }), "2026-07-18");
    const stop = applyJudgeResult(day1.next, cafe, makeResult({ finalScore: 2, severity: "stop", outcome: "boundary_crossed" }), "2026-07-19");
    expect(stop.next.streak).toBe(1);
    expect(stop.next.lastPracticeDay).toBe("2026-07-18");
  });
});

describe("applyJudgeResult — achievements", () => {
  it("unlocks first-contact once, then never again", () => {
    const contact = makeResult({ finalScore: 8, outcome: "contact_exchanged" });
    const first = applyJudgeResult(defaultProgress(), busStop, contact, "2026-07-18");
    expect(first.unlockedAchievementIds).toContain("first-contact");

    const again = applyJudgeResult(first.next, busStop, contact, "2026-07-18");
    expect(again.unlockedAchievementIds).not.toContain("first-contact");
    // Not duplicated in the progress list either.
    expect(again.next.achievements.filter((a) => a === "first-contact")).toHaveLength(1);
  });

  it("unlocks graceful-exit when its outcome and score bar are met", () => {
    const exit = makeResult({ finalScore: 7, outcome: "graceful_exit" });
    const outcome = applyJudgeResult(defaultProgress(), lowInterest, exit, "2026-07-18");
    expect(outcome.unlockedAchievementIds).toContain("graceful-exit");
  });

  it("does not unlock graceful-exit below its score bar", () => {
    const exit = makeResult({ finalScore: 6, outcome: "graceful_exit" });
    const outcome = applyJudgeResult(defaultProgress(), lowInterest, exit, "2026-07-18");
    expect(outcome.unlockedAchievementIds).not.toContain("graceful-exit");
  });

  it("unlocks the streak achievement when the streak reaches three", () => {
    let progress = defaultProgress();
    progress = applyJudgeResult(progress, busStop, makeResult({ finalScore: 6 }), "2026-07-18").next;
    progress = applyJudgeResult(progress, cafe, makeResult({ finalScore: 6 }), "2026-07-19").next;
    const third = applyJudgeResult(progress, lowInterest, makeResult({ finalScore: 6 }), "2026-07-20");
    expect(third.next.streak).toBe(3);
    expect(third.unlockedAchievementIds).toContain("consistent-communicator");
  });
});

describe("unlockedScenarioIds", () => {
  it("unlocks only the first scenario of each module for a fresh player", () => {
    const unlocked = unlockedScenarioIds(defaultProgress());
    expect(unlocked).toContain("spark-bus-stop");
    expect(unlocked).toContain("connection-keep-thread");
    expect(unlocked).not.toContain("spark-open-source");
  });

  it("unlocks the next scenario once its predecessor is completed", () => {
    const progress: Progress = {
      ...defaultProgress(),
      completedScenarioIds: ["spark-bus-stop"],
    };
    const unlocked = unlockedScenarioIds(progress);
    expect(unlocked).toContain("spark-open-source");
    expect(unlocked).not.toContain("spark-cafe-focus");
  });
});

describe("nextRecommendedScenarioId", () => {
  it("returns the first unlocked, uncompleted scenario in catalog order by default", () => {
    expect(nextRecommendedScenarioId(defaultProgress())).toBe("spark-bus-stop");
  });

  it("honors the plan ordering when given", () => {
    const plan = {
      startingModule: "connection" as const,
      skillPriorities: ["a", "b"] as [string, string],
      growthDirections: [] as unknown as OnboardingPlanGrowth,
      orderedScenarioIds: ["connection-keep-thread", "spark-bus-stop"],
    };
    expect(nextRecommendedScenarioId(defaultProgress(), plan)).toBe(
      "connection-keep-thread",
    );
  });

  it("skips completed scenarios", () => {
    const progress: Progress = {
      ...defaultProgress(),
      completedScenarioIds: ["spark-bus-stop"],
    };
    expect(nextRecommendedScenarioId(progress)).toBe("spark-open-source");
  });
});

// Local alias to keep the plan fixture readable without importing the full type.
type OnboardingPlanGrowth = import("./types").OnboardingPlan["growthDirections"];
