import { describe, expect, it } from "vitest";
import { matchesAnySignal, tokenize } from "./matcher";

describe("tokenize", () => {
  it("lowercases and splits on whitespace and punctuation", () => {
    expect(tokenize("Nice DAY, out!")).toEqual(["nice", "day", "out"]);
  });

  it("collapses runs of whitespace and punctuation", () => {
    expect(tokenize("what   are    you  reading???")).toEqual([
      "what",
      "are",
      "you",
      "reading",
    ]);
  });

  it("normalizes contractions regardless of apostrophe style", () => {
    expect(tokenize("that's")).toEqual(tokenize("that’s"));
    expect(tokenize("what's up")).toEqual(["whats", "up"]);
  });

  it("treats emoji as separators, not tokens", () => {
    expect(tokenize("hi 👋 there")).toEqual(["hi", "there"]);
  });
});

describe("matchesAnySignal", () => {
  it("matches a whole word", () => {
    expect(matchesAnySignal(tokenize("what a nice day out"), ["nice day"])).toBe(true);
  });

  it("does not match a fragment inside a longer word", () => {
    expect(matchesAnySignal(tokenize("spare me the niceties"), ["nice"])).toBe(false);
  });

  it("matches a multi-word phrase only when contiguous and in order", () => {
    expect(matchesAnySignal(tokenize("that's my bus, gotta run"), ["that's my bus"])).toBe(
      true,
    );
    expect(matchesAnySignal(tokenize("my bus that's late"), ["that's my bus"])).toBe(false);
  });

  it("is case and punctuation insensitive", () => {
    expect(matchesAnySignal(tokenize("GET IN MY CAR!!!"), ["get in my car"])).toBe(true);
  });

  it("returns false for empty signal lists", () => {
    expect(matchesAnySignal(tokenize("anything"), [])).toBe(false);
  });
});
