import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type {
  Attempt,
  ConversationTurn,
  Scenario,
} from "../../src/domain/types";
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

const fixtureReplies = [
  "okay, i hear you. there is definitely more to that story",
  "that tracks. i have a related story but it is kind of a mess",
  "fair. i need a second to think about that one",
  "honestly, that changed how i was reading the conversation",
  "i can see where you are coming from",
  "okay, i think that is a good place to leave it",
] as const;

export const fixturePersonaProvider: PersonaProvider = {
  async generate({ turn }) {
    const actions: PersonaModelDraft["actions"] = [
      {
        kind: "text" as const,
        body: fixtureReplies[turn - 1],
      },
    ];
    const text = actions.find((action) => action.kind === "text")?.body ?? "";
    const contribution =
      (text.match(/[^.!?\n]+[.!?]?/g) ?? [])
        .find((segment) => !segment.includes("?"))
        ?.trim() || text;
    const moves: PersonaModelDraft["move"][] = [
      "reveal",
      "tease",
      "pivot",
      "challenge",
      "reveal",
      "close",
    ];
    return {
      actions,
      move: moves[turn - 1],
      contribution,
      interestChange: "same",
      energyChange: "same",
      callbackSeed: null,
      callbackUsed: null,
      boundary: "none",
      terminalReason: turn === 6 ? "completed" : null,
    };
  },
};
