import { describe, expect, it } from "vitest";
import type { JudgeResult } from "../../domain/types";
import { resultVoice } from "./resultVoice";

function result(
  verdict: JudgeResult["verdict"],
  severity: JudgeResult["hardGate"]["severity"] = "none",
): JudgeResult {
  return {
    schemaVersion: "1.0",
    attemptId: "attempt-result-voice",
    mode: "llm",
    hardGate: {
      triggered: severity !== "none",
      severity,
      codes: [],
      maxScore: severity === "stop" ? 2 : severity === "cap" ? 4 : 10,
      evidence: [],
    },
    rubric: [],
    rawScore: 0,
    finalScore: 0,
    verdict,
    worked: ["Something landed."],
    improve: ["Try a cleaner beat."],
    betterResponse: "That commute was brutal.",
    outcome: {
      code: "conversation_continues",
      label: "Conversation continues",
      confidence: "medium",
      basis: [],
    },
  };
}

describe("result voice", () => {
  it("keeps the coaching labels plain and easy to scan", () => {
    const voice = resultVoice(result("COOKED"));

    expect(voice.kicker).toBe("Official RizzCode verdict");
    expect(voice.rubricTitle).toBe("Five-part rubric");
    expect(voice.workedTitle).toBe("What worked");
    expect(voice.improveTitle).toBe("What to improve");
    expect(voice.betterTitle).toBe("A better response");
    expect(voice.summary).toContain("Pretty solid");
  });

  it("keeps stop-level coaching firm instead of turning it into a joke", () => {
    const voice = resultVoice(result("FUMBLED", "stop"));

    expect(voice.summary).toContain("crossed the line");
    expect(voice.summary).not.toContain("lol");
    expect(voice.summary).not.toContain("aura");
  });

  it("uses the exact fumbled flavor line", () => {
    expect(resultVoice(result("FUMBLED")).summary).toContain(
      "Sometimes you cook. Sometimes you get cooked.",
    );
  });
});
