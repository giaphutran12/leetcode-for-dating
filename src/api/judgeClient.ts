import type {
  JudgeApiResponse,
  JudgeRequest,
} from "../domain/types";
import { validateJudgeApiResponse } from "../domain/validation";
import { authenticatedFetch } from "./authFetch";

export async function requestJudgment(
  request: JudgeRequest,
): Promise<JudgeApiResponse> {
  try {
    const response = await authenticatedFetch("/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const parsed = validateJudgeApiResponse(await response.json(), request);
    if (!parsed) {
      return {
        ok: false,
        retryable: true,
        code: "judge_invalid_output",
        message:
          "The judge response failed validation. Your transcript is safe and no XP was awarded.",
      };
    }
    return parsed;
  } catch {
    return {
      ok: false,
      retryable: true,
      code: "judge_unavailable",
      message:
        "The judge could not be reached. Your transcript is safe and ready to retry.",
    };
  }
}
