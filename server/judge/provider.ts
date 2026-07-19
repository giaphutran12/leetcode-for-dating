import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type {
  Attempt,
  ConversationTurn,
  HardGate,
  JudgeModelDraft,
  Scenario,
} from "../../src/domain/types";
import { matchesSignal } from "../../src/engine/conversationEngine";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./prompt";
import { JudgeModelDraftSchema } from "./schema";

export interface JudgeProvider {
  evaluate(input: {
    scenario: Scenario;
    attempt: Attempt;
    hardGate: HardGate;
    abortSignal: AbortSignal;
  }): Promise<JudgeModelDraft>;
}

export const aiSdkJudgeProvider: JudgeProvider = {
  async evaluate({ scenario, attempt, hardGate, abortSignal }) {
    const modelId = process.env.RIZZCODE_JUDGE_MODEL || "gpt-5.6-luna";
    const { output } = await generateText({
      model: openai(modelId),
      system: JUDGE_SYSTEM_PROMPT,
      prompt: buildJudgePrompt(scenario, attempt, hardGate),
      output: Output.object({
        schema: JudgeModelDraftSchema,
      }),
      abortSignal,
      maxRetries: 0,
    });

    return JudgeModelDraftSchema.parse(output);
  },
};

function fixtureScore(
  id: JudgeModelDraft["rubric"][number]["id"],
  body: string,
  scenario: Scenario,
  hardGate: HardGate,
): 0 | 1 | 2 {
  if (hardGate.severity === "stop" && id === "respect_calibration") return 0;
  if (id === "context_naturalness") {
    return scenario.successSignals.some((signal) => matchesSignal(body, signal))
      ? 2
      : body.length > 18
        ? 1
        : 0;
  }
  if (id === "reciprocity_listening") {
    return body.includes("?") && /\b(i|my|me)\b/i.test(body) ? 2 : 1;
  }
  if (id === "playfulness_personality") {
    return /\b(ha|haha|chaos|ramen|projector|fern|tribunal|council)\b/i.test(
      body,
    )
      ? 2
      : 1;
  }
  if (id === "respect_calibration") {
    return hardGate.triggered ? 0 : 2;
  }
  if (
    scenario.fallback.exitSignals.some((signal) =>
      matchesSignal(body, signal),
    )
  ) {
    return 2;
  }
  return scenario.successSignals.some((signal) => matchesSignal(body, signal))
    ? 2
    : 1;
}

export const fixtureJudgeProvider: JudgeProvider = {
  async evaluate({ scenario, attempt, hardGate }) {
    const userMessages = attempt.messages.filter(
      (message): message is typeof message & { turn: ConversationTurn } =>
        message.speaker === "you" && message.turn > 0,
    );
    const evidenceMessage = userMessages[userMessages.length - 1];
    if (!evidenceMessage) throw new Error("Fixture requires a user response.");
    const userText = userMessages.map((message) => message.body).join("\n");
    const graceful = scenario.fallback.exitSignals.some((signal) =>
      userText.toLowerCase().includes(signal.toLowerCase()),
    );
    const askedForContact = /\b(number|contact|swap)\b/i.test(userText);
    const askedForDate =
      /\b(coffee|dinner|lunch|date|join me|want to|saturday|thursday)\b/i.test(
        userText,
      );

    let outcomeCode: JudgeModelDraft["outcome"]["code"] =
      "conversation_continues";
    if (hardGate.triggered) outcomeCode = "boundary_crossed";
    else if (graceful) outcomeCode = "graceful_exit";
    else if (
      askedForContact &&
      attempt.personaState.engagement === "warm" &&
      scenario.supportedOutcomeCodes.includes("contact_exchanged")
    )
      outcomeCode = "contact_exchanged";
    else if (
      askedForDate &&
      attempt.personaState.engagement === "warm" &&
      scenario.supportedOutcomeCodes.includes("date_agreed")
    )
      outcomeCode = "date_agreed";
    else if (scenario.supportedOutcomeCodes.includes("shared_interest"))
      outcomeCode = "shared_interest";
    else if (scenario.supportedOutcomeCodes.includes("low_interest"))
      outcomeCode = "low_interest";
    else outcomeCode = scenario.supportedOutcomeCodes[0];

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

    return {
      rubric: ids.map((id) => ({
        id,
        score: fixtureScore(id, evidenceMessage.body, scenario, hardGate),
        evidence,
        feedback: `The response gives concrete evidence for ${id.replaceAll("_", " ")}.`,
      })),
      worked: ["You gave the other person something concrete to respond to."],
      improve: ["Keep the next line concise and matched to the energy you receive."],
      betterResponse:
        scenario.mode === "in_person"
          ? "That detail made me curious. What is the short version?"
          : "That detail got me. What happened next?",
      outcome: {
        code: outcomeCode,
        label: outcomeCode.replaceAll("_", " "),
        confidence: "medium",
        basis: [evidence],
      },
    };
  },
};
