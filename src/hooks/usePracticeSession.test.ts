import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { scenarioById } from "../data/scenarios";
import type {
  JudgeApiResponse,
  JudgeRequest,
  JudgeResult,
  PersonaReply,
} from "../domain/types";
import type { ConversationEngine } from "../engine/conversationEngine";
import { usePracticeSession } from "./usePracticeSession";

const busStop = scenarioById("spark-bus-stop")!;

function makeResult(attemptId: string): JudgeResult {
  return {
    schemaVersion: "1.0",
    attemptId,
    mode: "llm",
    hardGate: { triggered: false, severity: "none", codes: [], maxScore: 10, evidence: [] },
    rubric: [],
    rawScore: 8,
    finalScore: 8,
    verdict: "ATE",
    worked: [],
    improve: [],
    betterResponse: "",
    outcome: { code: "conversation_continues", label: "Keeps going", confidence: "high", basis: [] },
  };
}

const okJudge = (): ((req: JudgeRequest) => Promise<JudgeApiResponse>) => (req) =>
  Promise.resolve({ ok: true, result: makeResult(req.attemptId) });

// A persona engine whose reply resolution is controlled by the test.
function deferredEngine() {
  let resolveReply: (reply: PersonaReply) => void = () => {};
  let rejectReply: (error: unknown) => void = () => {};
  const engine: ConversationEngine = {
    reply: () =>
      new Promise<PersonaReply>((resolve, reject) => {
        resolveReply = resolve;
        rejectReply = reject;
      }),
  };
  return {
    engine,
    resolve: (reply: PersonaReply) => resolveReply(reply),
    reject: (error: unknown) => rejectReply(error),
  };
}

describe("usePracticeSession — happy path", () => {
  it("runs three turns, auto-judges, and completes", async () => {
    const { result } = renderHook(() =>
      usePracticeSession({ scenario: busStop, judge: okJudge() }),
    );

    expect(result.current.status).toBe("active");
    expect(result.current.userTurn).toBe(0);

    await act(async () => {
      result.current.submitResponse("what are you reading?");
    });
    expect(result.current.userTurn).toBe(1);
    expect(result.current.status).toBe("active");
    // one user + one persona message
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      result.current.submitResponse("your book looks good");
    });
    expect(result.current.userTurn).toBe(2);

    await act(async () => {
      result.current.submitResponse("which bus are you catching?");
    });

    await waitFor(() => expect(result.current.status).toBe("complete"));
    expect(result.current.userTurn).toBe(3);
    expect(result.current.result?.finalScore).toBe(8);
    expect(result.current.judging).toBe(false);
    expect(result.current.endedEarly).toBeNull();
  });
});

describe("usePracticeSession — input validation", () => {
  it("rejects empty and whitespace-only input without advancing", async () => {
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge: okJudge() }));
    let accepted = true;
    await act(async () => {
      accepted = result.current.submitResponse("   ");
    });
    expect(accepted).toBe(false);
    expect(result.current.userTurn).toBe(0);
    expect(result.current.status).toBe("active");
  });

  it("rejects input longer than 420 characters", async () => {
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge: okJudge() }));
    let accepted = true;
    await act(async () => {
      accepted = result.current.submitResponse("x".repeat(421));
    });
    expect(accepted).toBe(false);
    expect(result.current.userTurn).toBe(0);
  });

  it("accepts input of exactly 420 characters", async () => {
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge: okJudge() }));
    let accepted = false;
    await act(async () => {
      accepted = result.current.submitResponse("x".repeat(420));
    });
    expect(accepted).toBe(true);
    expect(result.current.userTurn).toBe(1);
  });
});

describe("usePracticeSession — state guards", () => {
  it("rejects a submission while awaiting a persona reply", async () => {
    const deferred = deferredEngine();
    const { result } = renderHook(() =>
      usePracticeSession({ scenario: busStop, engine: deferred.engine, judge: okJudge() }),
    );

    act(() => {
      expect(result.current.submitResponse("first")).toBe(true);
    });
    expect(result.current.status).toBe("awaiting_reply");
    // second submit while awaiting is rejected
    act(() => {
      expect(result.current.submitResponse("second")).toBe(false);
    });
    expect(result.current.userTurn).toBe(1);
    // only the single user message so far
    expect(result.current.messages.filter((m) => m.speaker === "you")).toHaveLength(1);
  });

  it("records exactly one response for a synchronous double-submit", async () => {
    const deferred = deferredEngine();
    const { result } = renderHook(() =>
      usePracticeSession({ scenario: busStop, engine: deferred.engine, judge: okJudge() }),
    );

    act(() => {
      const first = result.current.submitResponse("hello");
      const second = result.current.submitResponse("hello again");
      expect(first).toBe(true);
      expect(second).toBe(false);
    });
    expect(result.current.userTurn).toBe(1);
    expect(result.current.messages.filter((m) => m.speaker === "you")).toHaveLength(1);
  });

  it("cannot mutate a completed attempt with a fourth submission", async () => {
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge: okJudge() }));
    for (const body of ["what are you reading?", "your book", "which bus?"]) {
      await act(async () => {
        result.current.submitResponse(body);
      });
    }
    await waitFor(() => expect(result.current.status).toBe("complete"));

    let accepted = true;
    await act(async () => {
      accepted = result.current.submitResponse("one more");
    });
    expect(accepted).toBe(false);
    expect(result.current.userTurn).toBe(3);
  });
});

describe("usePracticeSession — reset discards stale async", () => {
  it("drops a persona reply that resolves after reset", async () => {
    const deferred = deferredEngine();
    const { result } = renderHook(() =>
      usePracticeSession({ scenario: busStop, engine: deferred.engine, judge: okJudge() }),
    );

    const originalId = result.current.attempt.id;
    act(() => {
      result.current.submitResponse("hi there");
    });
    expect(result.current.status).toBe("awaiting_reply");

    act(() => {
      result.current.reset();
    });
    const newId = result.current.attempt.id;
    expect(newId).not.toBe(originalId);
    expect(result.current.status).toBe("active");
    expect(result.current.personaThinking).toBe(false);

    // Stale reply from the old attempt resolves now — must be ignored.
    await act(async () => {
      deferred.resolve({
        reply: "stale reply",
        state: { engagement: "warm", boundary: "none", terminal: false },
        interestChange: "up",
        terminalReason: null,
      });
    });

    expect(result.current.attempt.id).toBe(newId);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.status).toBe("active");
  });
});

describe("usePracticeSession — judge errors", () => {
  it("surfaces a retryable judge error and succeeds on retry", async () => {
    let calls = 0;
    const judge = vi.fn((req: JudgeRequest): Promise<JudgeApiResponse> => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          ok: false,
          retryable: true,
          code: "judge_timeout",
          message: "timed out",
        });
      }
      return Promise.resolve({ ok: true, result: makeResult(req.attemptId) });
    });

    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge }));
    for (const body of ["what are you reading?", "your book", "which bus?"]) {
      await act(async () => {
        result.current.submitResponse(body);
      });
    }

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.judgeError?.code).toBe("judge_timeout");
    expect(result.current.judgeError?.retryable).toBe(true);
    expect(result.current.result).toBeNull();

    // Retry re-sends the same responses under the same attempt id.
    const attemptId = result.current.attempt.id;
    await act(async () => {
      result.current.retryJudgment();
    });
    await waitFor(() => expect(result.current.status).toBe("complete"));
    expect(result.current.result?.attemptId).toBe(attemptId);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge.mock.calls[1][0].attemptId).toBe(attemptId);
  });

  it("does not re-judge a completed attempt", async () => {
    const judge = vi.fn(okJudge());
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge }));
    for (const body of ["what are you reading?", "your book", "which bus?"]) {
      await act(async () => {
        result.current.submitResponse(body);
      });
    }
    await waitFor(() => expect(result.current.status).toBe("complete"));
    await act(async () => {
      result.current.retryJudgment();
    });
    expect(judge).toHaveBeenCalledTimes(1);
  });
});

describe("usePracticeSession — early exit", () => {
  it("ends on a boundary and judges with fewer than three responses", async () => {
    const judge = vi.fn(okJudge());
    const { result } = renderHook(() => usePracticeSession({ scenario: busStop, judge }));

    await act(async () => {
      result.current.submitResponse("get in my car");
    });

    await waitFor(() => expect(result.current.status).toBe("complete"));
    expect(result.current.endedEarly).toEqual({ reason: "boundary" });
    expect(result.current.userTurn).toBe(1);
    expect(judge.mock.calls[0][0].responses).toHaveLength(1);
  });

  it("falls back to the authored reply when the persona engine throws", async () => {
    const throwingEngine: ConversationEngine = { reply: () => Promise.reject(new Error("boom")) };
    const { result } = renderHook(() =>
      usePracticeSession({ scenario: busStop, engine: throwingEngine, judge: okJudge() }),
    );

    await act(async () => {
      result.current.submitResponse("what are you reading?");
    });

    // conversation stays usable: a persona message was still appended
    const herMessages = result.current.messages.filter((m) => m.speaker === "her");
    expect(herMessages).toHaveLength(1);
    expect(herMessages[0].body).toBe(busStop.fallback.repliesByTurn[1].neutral);
    expect(result.current.status).toBe("active");
  });
});
