// @vitest-environment node
//
// Opt-in LIVE smoke test. Skipped in a normal `npm run test`; runs only via
// `npm run test:judge:live` (which sets RIZZCODE_LIVE_JUDGE=1). It makes at most
// two real provider calls using the runtime credential loaded from .env.local via
// Vite's loadEnv. The key value is NEVER printed, asserted on, or logged.

import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";
import type { JudgeRequest } from "../../domain/types";
import { verdictFor } from "../../domain/scoring";
import { handleJudgeRequest, type JudgeDeps } from "./route";

const LIVE = process.env.RIZZCODE_LIVE_JUDGE === "1";

function liveDeps(): JudgeDeps {
  // Execution-only: read the two server variables from .env.local at runtime.
  const env = loadEnv("development", process.cwd(), "");
  return {
    env: {
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      RIZZCODE_JUDGE_MODEL: env.RIZZCODE_JUDGE_MODEL,
    },
    timeoutMs: 60_000,
  };
}

const baseRequest: JudgeRequest = {
  schemaVersion: "1.0",
  attemptId: "live-smoke-1",
  scenarioId: "spark-bus-stop",
  responses: [
    { turn: 1, body: "that library book any good, or just for the tote aesthetic?" },
    { turn: 2, body: "ha, fair. I'm a sucker for a slow-burn mystery myself" },
    { turn: 3, body: "I'll let you catch your bus — worth saying hi though" },
  ],
};

describe.skipIf(!LIVE)("live judge smoke", () => {
  // Populated by the first test, reused as the baseline for the "materially
  // different" comparison in the second — keeps total live calls in this file
  // at exactly 2 (one per test), run in order within the same describe block.
  let firstResult: Extract<Awaited<ReturnType<typeof handleJudgeRequest>>["body"], { ok: true }>["result"] | undefined;

  it("returns a validated result whose verdict matches its finalScore", async () => {
    const { status, body } = await handleJudgeRequest(baseRequest, liveDeps());
    expect(status).toBe(200);
    if (!body.ok) throw new Error(`live judge failed: ${body.code}`);
    expect(body.result.rubric).toHaveLength(5);
    expect(body.result.verdict).toBe(verdictFor(body.result.finalScore));
    expect(body.result.attemptId).toBe("live-smoke-1");
    firstResult = body.result;
  }, 70_000);

  it("produces a materially different result for a materially different transcript", async () => {
    if (!firstResult) throw new Error("expected the first live call to have run first");

    const weak: JudgeRequest = {
      ...baseRequest,
      attemptId: "live-smoke-2",
      responses: [
        { turn: 1, body: "hey" },
        { turn: 2, body: "cool" },
        { turn: 3, body: "so anyway" },
      ],
    };
    const { body } = await handleJudgeRequest(weak, liveDeps());
    if (!body.ok) throw new Error(`live judge failed: ${body.code}`);
    // Two different transcripts should not collapse to an identical judgment.
    expect(body.result.attemptId).toBe("live-smoke-2");
    // Genuinely different judgments, not just a different attemptId echo: the
    // rubric (scores/evidence/feedback) or the finalScore must differ from the
    // strong-response baseline captured by the first test.
    expect(
      body.result.finalScore !== firstResult.finalScore ||
        JSON.stringify(body.result.rubric) !== JSON.stringify(firstResult.rubric),
    ).toBe(true);
  }, 70_000);
});
