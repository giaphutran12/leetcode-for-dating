import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type {
  Attempt,
  ConversationTurn,
  JudgeModelDraft,
  Scenario,
} from "../../src/domain/types";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./prompt";
import { JudgeModelDraftSchema } from "./schema";

export interface JudgeProvider {
  evaluate(input: {
    scenario: Scenario;
    attempt: Attempt;
    abortSignal: AbortSignal;
  }): Promise<JudgeModelDraft>;
}

export const aiSdkJudgeProvider: JudgeProvider = {
  async evaluate({ scenario, attempt, abortSignal }) {
    const modelId = process.env.RIZZCODE_JUDGE_MODEL || "gpt-5.6-luna";
    const { output } = await generateText({
      model: openai(modelId),
      system: JUDGE_SYSTEM_PROMPT,
      prompt: buildJudgePrompt(scenario, attempt),
      output: Output.object({
        schema: JudgeModelDraftSchema,
      }),
      abortSignal,
      maxRetries: 0,
    });

    return JudgeModelDraftSchema.parse(output);
  },
};

export const fixtureJudgeProvider: JudgeProvider = {
  async evaluate({ scenario, attempt }) {
    const userMessages = attempt.messages.filter(
      (message): message is typeof message & { turn: ConversationTurn } =>
        message.speaker === "you" && message.turn > 0,
    );
    const evidenceMessage = userMessages[userMessages.length - 1];
    if (!evidenceMessage) throw new Error("Fixture requires a user response.");
    const outcomeCode: JudgeModelDraft["outcome"]["code"] =
      scenario.supportedOutcomeCodes.includes("conversation_continues")
        ? "conversation_continues"
        : scenario.supportedOutcomeCodes[0];

    const evidence = {
      turn: evidenceMessage.turn,
      excerpt: evidenceMessage.body,
      reason: "This exact line shows the observable behavior used for the fixture judgment.",
    };
    const ids: JudgeModelDraft["rubric"][number]["id"][] = [
      "context_naturalness",
      "reciprocity_listening",
      "playfulness_personality",
      "respect_calibration",
      "challenge_objective",
    ];
    const feedback: Record<
      JudgeModelDraft["rubric"][number]["id"],
      string
    > = {
      context_naturalness:
        "This stays on the same topic instead of forcing a new one.",
      reciprocity_listening:
        "You shared something too, so it felt like a real back-and-forth.",
      playfulness_personality:
        "The line feels human instead of copied.",
      respect_calibration:
        "You matched the energy without forcing the interaction.",
      challenge_objective:
        "You did what the challenge asked and kept the chat going.",
    };

    return {
      safety: {
        severity: "none",
        confidence: "high",
        codes: [],
        evidence: [],
      },
      rubric: ids.map((id) => ({
        id,
        score: 2,
        evidence,
        feedback: feedback[id],
      })),
      worked: ["You gave them an easy thing to reply to. That worked."],
      improve: ["Make the next line shorter and match their energy."],
      betterResponse:
        scenario.mode === "in_person"
          ? "Okay, that detail got me. What is the short version?"
          : "okay that detail got me 😭 what happened next?",
      outcome: {
        code: outcomeCode,
        label: outcomeCode.replaceAll("_", " "),
        confidence: "medium",
        basis: [evidence],
      },
    };
  },
};
