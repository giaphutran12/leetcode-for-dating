import type { Request, Response } from "express";
import type { JudgeApiResponse } from "../../src/domain/types";
import {
  fixtureJudgeProvider,
  type JudgeProvider,
} from "./provider";
import { JudgeRequestSchema } from "./schema";
import { judgeAttempt } from "./service";

export function selectJudgeProvider(
  provider: JudgeProvider | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): JudgeProvider | undefined {
  if (provider) return provider;
  if (
    environment.NODE_ENV !== "production" &&
    environment.RIZZCODE_MOCK_JUDGE === "1"
  ) {
    return fixtureJudgeProvider;
  }
  return undefined;
}

export function createJudgeRoute(provider?: JudgeProvider) {
  return async function judgeRoute(request: Request, response: Response) {
    const parsed = JudgeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: JudgeApiResponse = {
        ok: false,
        retryable: false,
        code: "judge_invalid_output",
        message:
          "The judge request was invalid. Only canonical scenario responses are accepted.",
      };
      response.status(400).json(body);
      return;
    }

    const selectedProvider = selectJudgeProvider(provider);
    const result = await judgeAttempt(parsed.data, selectedProvider);
    response.status(result.ok ? 200 : result.retryable ? 503 : 409).json(result);
  };
}
