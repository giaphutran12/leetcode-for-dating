// The real model call, isolated behind a tiny seam so route.ts (and its tests)
// never import the AI SDK directly (plan: "Required LLM judge" -> provider rules,
// "Required AI SDK v6 pattern"). One atomic structured judgment per call:
// generateText + Output.object, read the parsed value from `output`. No tools, no
// browsing, no streaming, no AI Gateway, no raw OpenAI HTTP.

import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { JudgeModelDraftSchema } from "./schema";

export interface ModelEnv {
  OPENAI_API_KEY?: string;
  RIZZCODE_JUDGE_MODEL?: string;
}

const DEFAULT_JUDGE_MODEL = "gpt-5.4";

// The function the route calls for one judgment. Signature matches JudgeDeps.callModel.
export type CallJudgeModel = (
  system: string,
  prompt: string,
  abortSignal: AbortSignal,
) => Promise<unknown>;

// Build a model caller from server env. Requires the key to be present (route
// checks this first and returns judge_unconfigured otherwise). The key is passed
// explicitly to the provider and is never logged, printed, or returned.
export function createModelCaller(env: ModelEnv): { callJudgeModel: CallJudgeModel } {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    // Message only — never include the value (there is none here anyway).
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }

  const openai = createOpenAI({ apiKey });
  const modelId = env.RIZZCODE_JUDGE_MODEL || DEFAULT_JUDGE_MODEL;

  return {
    async callJudgeModel(system, prompt, abortSignal) {
      const { output } = await generateText({
        model: openai(modelId),
        system,
        prompt,
        output: Output.object({ schema: JudgeModelDraftSchema }),
        abortSignal,
      });
      return output;
    },
  };
}
