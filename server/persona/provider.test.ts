import { describe, expect, it } from "vitest";
import { getScenario } from "../../src/data/scenarios";
import { createAttempt } from "../../src/engine/conversationEngine";
import {
  DEFAULT_PERSONA_MODEL,
  PERSONA_OPENAI_OPTIONS,
  fixturePersonaProvider,
} from "./provider";

describe("persona provider model options", () => {
  it("uses GPT-5.4 nano without pinning a model-specific reasoning effort", () => {
    expect(DEFAULT_PERSONA_MODEL).toBe("gpt-5.4-nano");
    expect(PERSONA_OPENAI_OPTIONS).toEqual({
      textVerbosity: "low",
    });
    expect(PERSONA_OPENAI_OPTIONS).not.toHaveProperty("reasoningEffort");
  });

  it("keeps the mock provider non-semantic instead of classifying phrases", async () => {
    const scenario = getScenario("RC-005")!;
    const attempt = createAttempt(scenario, "attempt-mock-provider");
    const input = {
      scenario,
      attempt,
      turn: 1 as const,
      abortSignal: new AbortController().signal,
    };
    const invitation = await fixturePersonaProvider.generate({
      ...input,
      body: "want to get coffee this weekend?",
    });
    const exit = await fixturePersonaProvider.generate({
      ...input,
      body: "i think i should go home",
    });

    expect(invitation).toEqual(exit);
  });
});
