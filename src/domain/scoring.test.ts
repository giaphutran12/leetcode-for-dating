import { describe, expect, it } from "vitest";
import { applyCap, capForSeverity, computeRawScore, verdictFor } from "./scoring";
import type { JudgeResult } from "./types";

function rubric(scores: [number, number, number, number, number]): JudgeResult["rubric"] {
  const ids: JudgeResult["rubric"][number]["id"][] = [
    "context_naturalness",
    "reciprocity_listening",
    "playfulness_personality",
    "respect_calibration",
    "challenge_objective",
  ];
  return ids.map((id, index) => ({
    id,
    score: scores[index] as 0 | 1 | 2,
    evidence: { turn: 1, excerpt: "x", reason: "r" },
    feedback: "f",
  }));
}

describe("computeRawScore", () => {
  it("sums the five criteria", () => {
    expect(computeRawScore(rubric([2, 2, 2, 2, 2]))).toBe(10);
    expect(computeRawScore(rubric([0, 0, 0, 0, 0]))).toBe(0);
    expect(computeRawScore(rubric([2, 1, 0, 2, 1]))).toBe(6);
  });
});

describe("capForSeverity", () => {
  it("maps severity to a score ceiling", () => {
    expect(capForSeverity("stop")).toBe(2);
    expect(capForSeverity("cap")).toBe(4);
    expect(capForSeverity("none")).toBe(10);
  });
});

describe("applyCap", () => {
  it("clamps a raw score down to the ceiling", () => {
    expect(applyCap(10, 2)).toBe(2);
    expect(applyCap(10, 4)).toBe(4);
    expect(applyCap(6, 10)).toBe(6);
  });

  it("leaves a score already under the cap unchanged", () => {
    expect(applyCap(1, 2)).toBe(1);
    expect(applyCap(3, 4)).toBe(3);
  });
});

describe("verdictFor", () => {
  it("maps the score bands", () => {
    expect(verdictFor(0)).toBe("FUMBLED");
    expect(verdictFor(5)).toBe("COOKED");
    expect(verdictFor(9)).toBe("ATE");
  });

  it("honors the band boundaries", () => {
    expect(verdictFor(3)).toBe("FUMBLED");
    expect(verdictFor(4)).toBe("COOKED");
    expect(verdictFor(7)).toBe("COOKED");
    expect(verdictFor(8)).toBe("ATE");
  });
});
