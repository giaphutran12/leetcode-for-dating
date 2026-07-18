// @vitest-environment node
//
// Opt-in LIVE acceptance fixtures for the judge-quality items in the plan's
// acceptance matrix (8, 9, 11, 13, 14/15 band expectations). Skipped in a normal
// `npm run test`; runs ONLY when RIZZCODE_LIVE_JUDGE=1, which points the route at
// the real runtime provider via loadEnv(.env.local). Exactly four live calls total
// (one per test), each tolerant: it asserts a BAND, not an exact score, because a
// real model is not deterministic. The credential value is never printed or
// asserted on.
//
// Run: RIZZCODE_LIVE_JUDGE=1 npx vitest run src/server/judge/live.acceptance.test.ts

import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";
import type { JudgeRequest } from "../../domain/types";
import { verdictFor } from "../../domain/scoring";
import { handleJudgeRequest, type JudgeDeps } from "./route";

const LIVE = Boolean(process.env.RIZZCODE_LIVE_JUDGE);

function liveDeps(): JudgeDeps {
  const env = loadEnv("development", process.cwd(), "");
  return {
    env: {
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      RIZZCODE_JUDGE_MODEL: env.RIZZCODE_JUDGE_MODEL,
    },
    timeoutMs: 60_000,
  };
}

async function judge(request: JudgeRequest) {
  const { status, body } = await handleJudgeRequest(request, liveDeps());
  expect(status).toBe(200);
  if (!body.ok) throw new Error(`live judge failed: ${body.code}`);
  // Every validated result must have five criteria and a verdict that matches its
  // finalScore — the invariant behind acceptance item 16.
  expect(body.result.rubric).toHaveLength(5);
  expect(body.result.verdict).toBe(verdictFor(body.result.finalScore));
  return body.result;
}

describe.skipIf(!LIVE)("live judge acceptance bands", () => {
  it("fixture 8: a fitting callback with natural humor scores >= 7", async () => {
    const request: JudgeRequest = {
      schemaVersion: "1.0",
      attemptId: "live-accept-strong",
      scenarioId: "connection-playful-callback",
      responses: [
        {
          turn: 1,
          body: "the uber slander is unfair — i personally lobbied for a faster driver",
        },
        {
          turn: 2,
          body: "glad you made it though. what's the rest of your night looking like?",
        },
        {
          turn: 3,
          body: "let's grab that coffee this week — you pick the spot, i'll pick the terrible jokes",
        },
      ],
    };
    const result = await judge(request);
    expect(result.finalScore).toBeGreaterThanOrEqual(7);
  }, 70_000);

  it("fixture 9: a safe but generic one-word transcript scores <= 5", async () => {
    const request: JudgeRequest = {
      schemaVersion: "1.0",
      attemptId: "live-accept-generic",
      scenarioId: "spark-bus-stop",
      responses: [
        { turn: 1, body: "hey" },
        { turn: 2, body: "cool" },
        { turn: 3, body: "nice" },
      ],
    };
    const result = await judge(request);
    expect(result.finalScore).toBeLessThanOrEqual(5);
  }, 70_000);

  it("fixture 11: pressure after an explicit refusal stop-gates and scores <= 2", async () => {
    const request: JudgeRequest = {
      schemaVersion: "1.0",
      attemptId: "live-accept-pressure",
      scenarioId: "connection-handle-low-interest",
      responses: [
        { turn: 1, body: "come on, just give me a chance, one date won't kill you" },
        { turn: 2, body: "you owe me at least that after all this talking" },
        { turn: 3, body: "i'm not taking no for an answer, just say yes already" },
      ],
    };
    const result = await judge(request);
    expect(result.hardGate.severity).toBe("stop");
    expect(result.finalScore).toBeLessThanOrEqual(2);
  }, 70_000);

  it("fixture 13: a graceful exit after low interest scores >= 6 with an exit-ish outcome", async () => {
    const request: JudgeRequest = {
      schemaVersion: "1.0",
      attemptId: "live-accept-exit",
      scenarioId: "connection-handle-low-interest",
      responses: [
        {
          turn: 1,
          body: "totally get it — no pressure at all, life gets heavy sometimes",
        },
        {
          turn: 2,
          body: "seriously, take your time. i'm not going anywhere and there's zero rush",
        },
        {
          turn: 3,
          body: "i'll head out and let you breathe. it was genuinely nice talking, take care",
        },
      ],
    };
    const result = await judge(request);
    expect(result.finalScore).toBeGreaterThanOrEqual(6);
    expect(["graceful_exit", "low_interest", "incompatible"]).toContain(
      result.outcome.code,
    );
  }, 70_000);
});
