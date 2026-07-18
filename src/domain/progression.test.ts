import { describe, expect, it } from "vitest";
import { getScenario } from "../data/scenarios";
import { createAttempt } from "../engine/conversationEngine";
import {
  applyJudgment,
  calculateXPDelta,
  defaultProgress,
  masteryXP,
  nextPracticeScenario,
} from "./progression";
import type { JudgeResult, UserProfile } from "./types";

function result(
  finalScore: number,
  severity: "none" | "cap" | "stop" = "none",
): JudgeResult {
  return {
    schemaVersion: "1.0",
    attemptId: "attempt-progress",
    mode: "llm",
    hardGate: {
      triggered: severity !== "none",
      severity,
      codes: [],
      maxScore: severity === "stop" ? 2 : severity === "cap" ? 4 : 10,
      evidence: [],
    },
    rubric: [],
    rawScore: finalScore,
    finalScore,
    verdict: finalScore >= 8 ? "ATE" : finalScore >= 4 ? "COOKED" : "FUMBLED",
    worked: ["Good"],
    improve: ["Improve"],
    betterResponse: "Better",
    outcome: {
      code: "conversation_continues",
      label: "Comfortable continuation",
      confidence: "medium",
      basis: [{ turn: 1, excerpt: "Hi", reason: "Evidence" }],
    },
  };
}

describe("XP, anti-farming, and open practice", () => {
  it("uses locked mastery XP and level math", () => {
    expect(masteryXP(8, "easy")).toBe(80);
    expect(masteryXP(8, "medium")).toBe(90);
    expect(masteryXP(8, "hard")).toBe(100);
  });

  it("adds first-completion bonus and only positive retry improvement", () => {
    expect(
      calculateXPDelta({
        result: result(8),
        difficulty: "medium",
        previousBestMasteryXP: 0,
        firstValidCompletion: true,
      }),
    ).toBe(100);
    expect(
      calculateXPDelta({
        result: result(7),
        difficulty: "medium",
        previousBestMasteryXP: 90,
        firstValidCompletion: false,
      }),
    ).toBe(0);
    expect(
      calculateXPDelta({
        result: result(10),
        difficulty: "medium",
        previousBestMasteryXP: 90,
        firstValidCompletion: false,
      }),
    ).toBe(20);
  });

  it("awards zero XP for stop-level attempts", () => {
    expect(
      calculateXPDelta({
        result: result(2, "stop"),
        difficulty: "hard",
        previousBestMasteryXP: 0,
        firstValidCompletion: true,
      }),
    ).toBe(0);
  });

  it("does not let a stop-level attempt poison later mastery XP", () => {
    const scenario = getScenario("spark-bus-stop")!;
    const stopped = applyJudgment({
      progress: defaultProgress,
      attempt: createAttempt(scenario, "attempt-stopped"),
      scenario,
      result: result(2, "stop"),
      today: "2026-07-18",
    });
    expect(stopped.progress.publicXP).toBe(0);
    expect(stopped.progress.bestScores[scenario.id]).toBeUndefined();
    expect(stopped.progress.bestMasteryXP[scenario.id]).toBeUndefined();
    expect(stopped.progress.completedScenarioIds).not.toContain(scenario.id);

    const valid = applyJudgment({
      progress: stopped.progress,
      attempt: createAttempt(scenario, "attempt-valid"),
      scenario,
      result: result(8),
      today: "2026-07-18",
    });
    expect(valid.xpDelta).toBe(90);
  });

  it("applies one reward per attempt id", () => {
    const scenario = getScenario("spark-bus-stop")!;
    const attempt = createAttempt(scenario, "attempt-progress");
    const first = applyJudgment({
      progress: defaultProgress,
      attempt,
      scenario,
      result: result(8),
      today: "2026-07-18",
    });
    const duplicate = applyJudgment({
      progress: first.progress,
      attempt,
      scenario,
      result: result(8),
      today: "2026-07-18",
    });
    expect(first.xpDelta).toBe(90);
    expect(duplicate.xpDelta).toBe(0);
    expect(duplicate.progress.publicXP).toBe(first.progress.publicXP);
  });

  it("recommends the first incomplete scenario without gating access", () => {
    const first = getScenario("spark-bus-stop")!;
    const second = getScenario("spark-open-source")!;
    const profile = {
      onboardingPlan: {
        orderedScenarioIds: [first.id, second.id],
      },
    } as UserProfile;
    expect(nextPracticeScenario(defaultProgress, profile).id).toBe(first.id);
    expect(
      nextPracticeScenario(
        { ...defaultProgress, completedScenarioIds: [first.id] },
        profile,
      ).id,
    ).toBe(second.id);
  });
});
