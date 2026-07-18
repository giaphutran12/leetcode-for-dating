import { describe, expect, it } from "vitest";
import { difficultyBonus, levelFor, masteryXP, publicXPDelta } from "./xp";

describe("difficultyBonus", () => {
  it("scales with difficulty", () => {
    expect(difficultyBonus("easy")).toBe(0);
    expect(difficultyBonus("medium")).toBe(10);
    expect(difficultyBonus("hard")).toBe(20);
  });
});

describe("masteryXP", () => {
  it("is finalScore * 10 plus the difficulty bonus", () => {
    expect(masteryXP(8, "easy")).toBe(80);
    expect(masteryXP(8, "medium")).toBe(90);
    expect(masteryXP(8, "hard")).toBe(100);
    expect(masteryXP(0, "hard")).toBe(20);
  });
});

describe("publicXPDelta", () => {
  it("adds +10 on a first valid completion", () => {
    expect(
      publicXPDelta({
        masteryXP: 80,
        previousBestMasteryXP: 0,
        isFirstValidCompletion: true,
        stopViolation: false,
      }),
    ).toBe(90);
  });

  it("awards zero on a retry below the previous best", () => {
    expect(
      publicXPDelta({
        masteryXP: 60,
        previousBestMasteryXP: 90,
        isFirstValidCompletion: false,
        stopViolation: false,
      }),
    ).toBe(0);
  });

  it("awards only the positive difference on a retry above the previous best", () => {
    expect(
      publicXPDelta({
        masteryXP: 100,
        previousBestMasteryXP: 90,
        isFirstValidCompletion: false,
        stopViolation: false,
      }),
    ).toBe(10);
  });

  it("awards zero public XP on a stop violation regardless of score", () => {
    expect(
      publicXPDelta({
        masteryXP: 100,
        previousBestMasteryXP: 0,
        isFirstValidCompletion: true,
        stopViolation: true,
      }),
    ).toBe(0);
  });
});

describe("levelFor", () => {
  it("uses floor(total / 250) + 1", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(249)).toBe(1);
    expect(levelFor(250)).toBe(2);
    expect(levelFor(1250)).toBe(6);
  });
});
