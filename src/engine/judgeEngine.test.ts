import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgeApiResponse, JudgeRequest } from "../domain/types";
import { httpJudge } from "./judgeEngine";

const request: JudgeRequest = {
  schemaVersion: "1.0",
  attemptId: "attempt-1",
  scenarioId: "spark-bus-stop",
  responses: [{ turn: 1, body: "what are you reading?" }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("httpJudge", () => {
  it("POSTs to /api/judge and returns the parsed server response", async () => {
    const serverResponse: JudgeApiResponse = {
      ok: false,
      retryable: true,
      code: "judge_timeout",
      message: "timed out",
    };
    const fetchMock = vi.fn(async () => ({
      json: async () => serverResponse,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpJudge(request);
    expect(result).toEqual(serverResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/judge",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps a network failure to a retryable judge_unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpJudge(request);
    expect(result).toEqual({
      ok: false,
      retryable: true,
      code: "judge_unavailable",
      message: "network error",
    });
  });
});
