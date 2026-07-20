import type { JudgeResult } from "../../domain/types";

export type ResultVoice = {
  kicker: string;
  summary: string;
  rubricTitle: string;
  workedTitle: string;
  improveTitle: string;
  betterTitle: string;
  outcomeEyebrow: string;
  retryLabel: string;
  nextLabel: string;
  masteryHint: string;
};

export function resultVoice(result: JudgeResult): ResultVoice {
  const summary =
    result.hardGate.severity === "stop"
      ? "Yeah, that crossed the line. Learn from it and try again."
      : result.hardGate.severity === "cap"
        ? "One move hurt the score. Fix it and try again."
        : result.verdict === "ATE"
          ? "That worked. You read the room and kept it fun."
          : result.verdict === "COOKED"
            ? "Pretty solid. Fix one or two things and it will hit better."
            : "Sometimes you cook. Sometimes you get cooked. Try again with a simpler line.";

  return {
    kicker: "Official RizzCode verdict",
    summary,
    rubricTitle: "Five-part rubric",
    workedTitle: "What worked",
    improveTitle: "What to improve",
    betterTitle: "A better response",
    outcomeEyebrow: "Likely outcome",
    retryLabel: "Try again",
    nextLabel: "Next challenge",
    masteryHint: "Beat your best to earn more XP.",
  };
}
