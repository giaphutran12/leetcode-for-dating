import { describe, expect, it } from "vitest";
import type { PersonaState } from "../domain/types";
import {
  advancePersonaPolicyState,
  nextFallbackMove,
  normalizePersonaState,
  personaTextHasQuestion,
} from "./personaPolicy";

const legacyState: PersonaState = {
  engagement: "neutral",
  boundary: "none",
  terminal: false,
};

describe("persona conversation policy", () => {
  it("normalizes legacy attempts without losing canonical state", () => {
    expect(normalizePersonaState(legacyState)).toEqual({
      engagement: "neutral",
      boundary: "none",
      terminal: false,
      energy: "matched",
      recentMoves: [],
      questionStreak: 0,
      callbackSeeds: [],
    });
  });

  it("tracks energy, recent moves, questions, and bounded callback seeds", () => {
    const first = advancePersonaPolicyState({
      current: legacyState,
      move: "reveal",
      text: "naps are basically a reset button. what works for you?",
      energyChange: "up",
      callbackSeed: "50% buff",
    });
    expect(first).toEqual({
      energy: "high",
      recentMoves: ["reveal"],
      questionStreak: 1,
      callbackSeeds: ["50% buff"],
    });

    const second = advancePersonaPolicyState({
      current: { ...legacyState, ...first },
      move: "callback",
      text: "that 50% buff line is still funny.",
      energyChange: "same",
      callbackSeed: "50% buff",
    });
    expect(second).toEqual({
      energy: "high",
      recentMoves: ["reveal", "callback"],
      questionStreak: 0,
      callbackSeeds: ["50% buff"],
    });
  });

  it("recognizes question turns and varies authored fallback moves", () => {
    expect(personaTextHasQuestion("what happened?")).toBe(true);
    expect(personaTextHasQuestion("tell me what happened next")).toBe(true);
    expect(personaTextHasQuestion("how did that happen")).toBe(true);
    expect(personaTextHasQuestion("what a mess.")).toBe(false);
    expect(personaTextHasQuestion("that tracks.")).toBe(false);
    expect(
      nextFallbackMove(
        { ...legacyState, recentMoves: ["reveal"] },
        false,
      ),
    ).toBe("pivot");
    expect(nextFallbackMove(legacyState, true)).toBe("close");
  });
});
