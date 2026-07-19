import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type {
  Attempt,
  ConversationTurn,
  Scenario,
} from "../../src/domain/types";
import { matchesSignal } from "../../src/engine/conversationEngine";
import { buildPersonaPrompt, PERSONA_SYSTEM_PROMPT } from "./prompt";
import {
  PersonaModelDraftSchema,
  type PersonaModelDraft,
} from "./schema";

export interface PersonaProvider {
  generate(input: {
    scenario: Scenario;
    attempt: Attempt;
    turn: ConversationTurn;
    body: string;
    abortSignal: AbortSignal;
  }): Promise<PersonaModelDraft>;
}

export const DEFAULT_PERSONA_MODEL = "gpt-5.4-nano";

export const PERSONA_OPENAI_OPTIONS = {
  textVerbosity: "low" as const,
};

export const aiSdkPersonaProvider: PersonaProvider = {
  async generate({ scenario, attempt, turn, body, abortSignal }) {
    const modelId = process.env.RIZZCODE_PERSONA_MODEL || DEFAULT_PERSONA_MODEL;
    const { output } = await generateText({
      model: openai(modelId),
      system: PERSONA_SYSTEM_PROMPT,
      prompt: buildPersonaPrompt(scenario, attempt, turn, body),
      output: Output.object({
        name: "PersonaTurn",
        description:
          "One natural fictional-person reaction and its bounded state change.",
        schema: PersonaModelDraftSchema,
      }),
      abortSignal,
      maxRetries: 0,
      providerOptions: {
        openai: PERSONA_OPENAI_OPTIONS,
      },
    });

    return PersonaModelDraftSchema.parse(output);
  },
};

function fixtureReply(body: string, scenario: Scenario): string {
  const normalized = body.toLowerCase();
  if (/\b(number|contact|swap)\b/.test(normalized)) {
    return "yeah okay, send me yours. the ramen tribunal can continue";
  }
  if (/\b(rest|tired|exhausted|gassed)\b/.test(normalized)) {
    return "honestly rest is winning rn 😭 rain check?";
  }
  if (/\b(hang out|coffee|dinner|tonight|this weekend)\b/.test(normalized)) {
    return "wait that could be cute actually. i'm down. what did you have in mind?";
  }
  if (body.includes("?")) {
    const topic =
      scenario.mode === "messaging" ? "that question" : "you asking that";
    return `${topic} caught me off guard lol. probably the messiest part`;
  }
  if (
    scenario.successSignals.some((signal) => matchesSignal(body, signal))
  ) {
    return "okay wait, you actually remembered that. points for continuity";
  }
  return "lol fair. go on, there is definitely more to that story";
}

export const fixturePersonaProvider: PersonaProvider = {
  async generate({ scenario, turn, body }) {
    const userExit = scenario.fallback.exitSignals.some((signal) =>
      matchesSignal(body, signal),
    );
    const boundaryHit = scenario.fallback.boundarySignals.some((signal) =>
      matchesSignal(body, signal),
    );
    const positive = scenario.successSignals.some((signal) =>
      matchesSignal(body, signal),
    );
    const actions: PersonaModelDraft["actions"] = [
      ...(positive
        ? [{ kind: "reaction" as const, body: "👀" as const }]
        : []),
      {
        kind: "text" as const,
        body: fixtureReply(body, scenario),
      },
    ];
    return {
      actions,
      interestChange: boundaryHit || /\b(hate you|shut up|boring)\b/i.test(body)
        ? "down"
        : "up",
      boundary: boundaryHit
        ? "explicit"
        : /\b(hate you|shut up)\b/i.test(body)
          ? "soft"
          : "none",
      terminalReason: boundaryHit
        ? "boundary"
        : userExit
        ? "user_exit"
        : turn === 6
          ? "completed"
          : null,
    };
  },
};
