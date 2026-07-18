import { describe, expect, it, vi } from "vitest";
import type { JudgeRequest } from "../../domain/types";
import { handleJudgeRequest, type JudgeDeps } from "./route";
import { BUS_STOP_RESPONSES, makeDraft } from "./fixtures";

const KEY_ENV = { OPENAI_API_KEY: "test-key-not-real" };

function request(overrides: Partial<JudgeRequest> = {}): JudgeRequest {
  return {
    schemaVersion: "1.0",
    attemptId: "attempt-123",
    scenarioId: "spark-bus-stop",
    responses: BUS_STOP_RESPONSES,
    ...overrides,
  };
}

// A callModel mock that resolves to a fixed draft.
function resolvingModel(draft: unknown) {
  return vi.fn(async () => draft);
}

describe("handleJudgeRequest — happy path", () => {
  it("recomputes rawScore/finalScore/verdict from the rubric and echoes attemptId", async () => {
    // Scores sum to 7 → COOKED, no gate → no cap.
    const draft = makeDraft(BUS_STOP_RESPONSES, { scores: [2, 1, 2, 1, 1] });
    const callModel = resolvingModel(draft);
    const deps: JudgeDeps = { env: KEY_ENV, callModel };

    const { status, body } = await handleJudgeRequest(request(), deps);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error("expected ok");
    expect(body.result.rawScore).toBe(7);
    expect(body.result.finalScore).toBe(7);
    expect(body.result.verdict).toBe("COOKED");
    expect(body.result.attemptId).toBe("attempt-123");
    expect(body.result.rubric).toHaveLength(5);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("ignores any client-side arithmetic — the model draft has no score fields to trust", async () => {
    const draft = makeDraft(BUS_STOP_RESPONSES, { scores: [2, 2, 2, 2, 2] });
    const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(draft) };
    const { body } = await handleJudgeRequest(request(), deps);
    if (!body.ok) throw new Error("expected ok");
    expect(body.result.rawScore).toBe(10);
    expect(body.result.finalScore).toBe(10);
    expect(body.result.verdict).toBe("ATE");
  });
});

describe("handleJudgeRequest — strict request rejection", () => {
  const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(makeDraft(BUS_STOP_RESPONSES)) };

  it("rejects an unknown top-level field (client-supplied score/xp/persona)", async () => {
    const bad = { ...request(), score: 10, xp: 999, personaReplies: [{ reply: "hi" }] };
    const { status, body } = await handleJudgeRequest(bad, deps);
    expect(status).toBe(400);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_unavailable");
    expect(body.retryable).toBe(false);
  });

  it("rejects more than three responses", async () => {
    const bad = request({
      responses: [
        { turn: 1, body: "a" },
        { turn: 2, body: "b" },
        { turn: 3, body: "c" },
        { turn: 3, body: "d" },
      ] as JudgeRequest["responses"],
    });
    const { status } = await handleJudgeRequest(bad, deps);
    expect(status).toBe(400);
  });

  it("rejects a 421-character body", async () => {
    const bad = request({ responses: [{ turn: 1, body: "x".repeat(421) }] });
    const { status } = await handleJudgeRequest(bad, deps);
    expect(status).toBe(400);
  });

  it("rejects duplicate / non-ascending turns", async () => {
    const bad = request({
      responses: [
        { turn: 1, body: "hi" },
        { turn: 1, body: "again" },
      ],
    });
    const { status } = await handleJudgeRequest(bad, deps);
    expect(status).toBe(400);
  });

  it("rejects a whitespace-only body", async () => {
    const bad = request({ responses: [{ turn: 1, body: "   " }] });
    const { status } = await handleJudgeRequest(bad, deps);
    expect(status).toBe(400);
  });
});

describe("handleJudgeRequest — scenario and configuration", () => {
  it("returns 404 for an unknown scenario", async () => {
    const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(makeDraft(BUS_STOP_RESPONSES)) };
    const { status, body } = await handleJudgeRequest(request({ scenarioId: "nope" }), deps);
    expect(status).toBe(404);
    if (body.ok) throw new Error("expected failure");
    expect(body.message).toBe("unknown scenario");
  });

  it("returns judge_unconfigured WITHOUT calling the model when the key is missing", async () => {
    const callModel = resolvingModel(makeDraft(BUS_STOP_RESPONSES));
    const deps: JudgeDeps = { env: {}, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(503);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_unconfigured");
    expect(body.retryable).toBe(false);
    expect(callModel).not.toHaveBeenCalled();
  });
});

describe("handleJudgeRequest — hard gates cannot be laundered", () => {
  const THREAT_RESPONSES: JudgeRequest["responses"] = [
    { turn: 1, body: "do what i say or i'll hurt you" },
    { turn: 2, body: "i love a slow burn mystery myself" },
    { turn: 3, body: "which bus are you catching?" },
  ];

  it("applies a deterministic stop gate even when the model reports severity none and all 2s", async () => {
    // Model tries to launder the violation: severity none, perfect scores.
    const draft = makeDraft(THREAT_RESPONSES, { scores: [2, 2, 2, 2, 2], severity: "none" });
    const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(draft) };
    const { status, body } = await handleJudgeRequest(request({ responses: THREAT_RESPONSES }), deps);
    expect(status).toBe(200);
    if (!body.ok) throw new Error("expected ok");
    expect(body.result.hardGate.severity).toBe("stop");
    expect(body.result.finalScore).toBeLessThanOrEqual(2);
    expect(body.result.verdict).toBe("FUMBLED");
    expect(body.result.hardGate.codes).toContain("threat");
  });

  it("merges model + deterministic gates: stop wins over cap and codes are unioned", async () => {
    const draft = makeDraft(THREAT_RESPONSES, {
      scores: [2, 2, 2, 2, 2],
      severity: "cap",
      codes: ["deception"],
      gateEvidence: [{ turn: 2, excerpt: "slow burn mystery", reason: "model-reported" }],
    });
    const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(draft) };
    const { body } = await handleJudgeRequest(request({ responses: THREAT_RESPONSES }), deps);
    if (!body.ok) throw new Error("expected ok");
    expect(body.result.hardGate.severity).toBe("stop");
    expect(body.result.hardGate.codes).toEqual(expect.arrayContaining(["threat", "deception"]));
  });
});

describe("handleJudgeRequest — output validation", () => {
  it("rejects a draft citing an excerpt that is not in any user turn", async () => {
    const draft = makeDraft(BUS_STOP_RESPONSES, { badExcerpt: "i never actually said this" });
    const deps: JudgeDeps = { env: KEY_ENV, callModel: resolvingModel(draft) };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(502);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_invalid_output");
    expect(body.retryable).toBe(true);
  });
});

describe("handleJudgeRequest — transient failure and retry", () => {
  function timeoutError(): Error {
    return Object.assign(new Error("request timed out"), { name: "TimeoutError" });
  }
  function rateLimitError(): Error {
    return Object.assign(new Error("too many requests"), { statusCode: 429 });
  }

  it("retries exactly once and succeeds on the second call", async () => {
    const draft = makeDraft(BUS_STOP_RESPONSES);
    const callModel = vi
      .fn()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(draft);
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("maps a double timeout to judge_timeout and calls the model exactly twice", async () => {
    const callModel = vi.fn().mockRejectedValue(timeoutError());
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(504);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_timeout");
    expect(body.retryable).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("maps a rate-limit error to judge_rate_limited (429)", async () => {
    const callModel = vi.fn().mockRejectedValue(rateLimitError());
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(429);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_rate_limited");
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("maps an unknown provider error to judge_unavailable (502)", async () => {
    const callModel = vi.fn().mockRejectedValue(new Error("kaboom"));
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(502);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_unavailable");
  });
});

describe("handleJudgeRequest — non-transient failures skip the retry", () => {
  // The AI SDK sets `name` to this stable "AI_*" tag on the real
  // NoObjectGeneratedError; a hand-built stand-in with the same name exercises
  // the same classification path without importing the AI SDK into tests.
  function noObjectGeneratedError(): Error {
    return Object.assign(new Error("No object generated."), {
      name: "AI_NoObjectGeneratedError",
    });
  }
  function authError(status: number): Error {
    return Object.assign(new Error("Incorrect API key provided: sk-***"), { statusCode: status });
  }

  it("classifies a NoObjectGeneratedError-style throw as judge_invalid_output and calls the model exactly once", async () => {
    const callModel = vi.fn().mockRejectedValue(noObjectGeneratedError());
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(502);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_invalid_output");
    expect(body.retryable).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("classifies a 401 auth error as judge_unavailable, non-retryable, calls the model exactly once, and never echoes provider text", async () => {
    const callModel = vi.fn().mockRejectedValue(authError(401));
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(502);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_unavailable");
    expect(body.retryable).toBe(false);
    expect(body.message).not.toMatch(/sk-|api key/i);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("classifies a 403 auth error the same way", async () => {
    const callModel = vi.fn().mockRejectedValue(authError(403));
    const deps: JudgeDeps = { env: KEY_ENV, callModel };
    const { status, body } = await handleJudgeRequest(request(), deps);
    expect(status).toBe(502);
    if (body.ok) throw new Error("expected failure");
    expect(body.code).toBe("judge_unavailable");
    expect(body.retryable).toBe(false);
    expect(callModel).toHaveBeenCalledTimes(1);
  });
});
