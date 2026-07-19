// Browser-side judge client (plan: "Required LLM judge" browser contract). Posts a
// JudgeRequest to the server handler and returns the JudgeApiResponse. It performs
// NO scoring itself — the official score must come from the server's LLM path. A
// network failure or non-JSON body maps to a retryable judge_unavailable so the
// practice session can offer "Retry judgment" (plan: "Error and failure behavior").

import type { JudgeApiResponse, JudgeRequest } from "../domain/types";

export async function httpJudge(request: JudgeRequest): Promise<JudgeApiResponse> {
  try {
    const response = await fetch("/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    return (await response.json()) as JudgeApiResponse;
  } catch {
    return {
      ok: false,
      retryable: true,
      code: "judge_unavailable",
      message: "network error",
    };
  }
}
