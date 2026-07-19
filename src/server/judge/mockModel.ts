// TEST/DEV-ONLY mock of the judge model call (plan: "Tests" — browser-level tests
// must mock the provider at the SERVER boundary so the real route, gates, replay,
// and validation all run while the network is never touched). This file lives
// under src/server/ and is imported ONLY by the judge vite plugin (env-gated on
// RIZZCODE_JUDGE_MOCK=1) and by the vitest integration suite. Nothing in the
// client bundle (src/components, src/hooks, src/main) imports it, so it can never
// ship to a browser. The assertServerOnly() guard below is a belt-and-suspenders
// check: if this module ever ended up in a production client bundle it would throw
// at import time rather than silently mocking real users.
//
// The mock parses the delimited "you" turns back out of the built judge prompt and
// constructs a VALID, input-sensitive JudgeModelDraft: five rubric entries whose
// evidence excerpts are exact substrings of real user turns, scores derived
// deterministically from trivial observable features (length, "?", "!", word
// count), severity "none" (deterministic hard gates still run server-side and win
// on merge), and a plausible outcome. Different transcripts therefore produce
// different judgments — never a reused hardcoded result.

import type { CallJudgeModel } from "./provider";
import type { JudgeModelDraft } from "./schema";
import type { CriterionId } from "../../domain/types";

const CRITERIA: CriterionId[] = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
];

// Throw if this dev/test-only module is ever evaluated inside a production client
// bundle. In vitest, the vite dev plugin (Node), and dev builds, PROD is false or
// there is no browser window, so this never fires in any legitimate context.
function assertServerOnly(): void {
  const meta = import.meta as unknown as { env?: { PROD?: boolean } };
  const isProdClient =
    typeof window !== "undefined" && meta.env?.PROD === true;
  if (isProdClient) {
    throw new Error(
      "mockModel is a server/test-only module and must never run in a client bundle",
    );
  }
}

assertServerOnly();

// Reverse the prompt's XML-ish escaping (see prompt.ts `esc`) so an extracted
// excerpt is a byte-exact substring of the user's real (trimmed) turn body, which
// is what finalizeJudgeResult validates against. Order matters: unescape the
// entity ampersands last.
function unescape(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

interface ParsedTurn {
  turn: 1 | 2 | 3;
  body: string;
}

// Pull every `<message speaker="you" turn="N">BODY</message>` out of the prompt.
function parseUserTurns(prompt: string): ParsedTurn[] {
  const regex = /<message speaker="you" turn="([123])">([\s\S]*?)<\/message>/g;
  const turns: ParsedTurn[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    turns.push({
      turn: Number(match[1]) as 1 | 2 | 3,
      body: unescape(match[2]),
    });
  }
  return turns;
}

// The first up-to-N whitespace-separated words of `body`, returned as an EXACT
// prefix substring (original interior spacing preserved). Body is non-empty and
// pre-trimmed, so this is always a real, non-empty substring.
function firstWords(body: string, n: number): string {
  const match = body.match(new RegExp(`^\\S+(?:\\s+\\S+){0,${n - 1}}`));
  return match ? match[0] : body;
}

interface Features {
  words: number;
  chars: number;
  hasQuestion: boolean;
  hasExcite: boolean;
}

function features(body: string): Features {
  return {
    words: body.split(/\s+/).filter(Boolean).length,
    chars: body.length,
    hasQuestion: body.includes("?"),
    hasExcite: body.includes("!"),
  };
}

// Deterministic 0/1/2 per criterion from trivial observable features. Each
// criterion keys off a different feature so five identical-length turns don't
// collapse to five identical scores, and a one-word reply scores low while a
// natural, curious sentence scores high.
function scoreFor(index: number, f: Features): 0 | 1 | 2 {
  switch (index) {
    case 0: // context_naturalness — very short or rambling loses a point.
      if (f.chars <= 3) return 0;
      if (f.chars >= 240) return 1;
      return 2;
    case 1: // reciprocity_listening — a real question reads as listening.
      if (f.hasQuestion) return 2;
      return f.words >= 6 ? 1 : 0;
    case 2: // playfulness_personality — energy/voice.
      if (f.hasExcite) return 2;
      return f.words >= 8 ? 1 : 0;
    case 3: // respect_calibration — default respectful; a bare word is thin.
      return f.words <= 1 ? 1 : 2;
    default: // challenge_objective — length as a rough proxy for follow-through.
      if (f.words >= 10) return 2;
      return f.words >= 4 ? 1 : 0;
  }
}

// Build a schema-valid draft from the parsed turns. Assign each criterion to a
// turn round-robin so evidence spans the transcript and only ever cites turns
// that actually exist.
function buildDraft(turns: ParsedTurn[]): JudgeModelDraft {
  const source = turns.length > 0 ? turns : [{ turn: 1 as const, body: "hey" }];

  const rubric = CRITERIA.map((id, index) => {
    const pick = source[index % source.length];
    const f = features(pick.body);
    return {
      id,
      score: scoreFor(index, f),
      evidence: {
        turn: pick.turn,
        excerpt: firstWords(pick.body, 6),
        reason: `Mock scoring keyed off observable features of turn ${pick.turn}.`,
      },
      feedback: `Deterministic mock feedback for ${id}.`,
    };
  });

  const first = source[0];
  return {
    rubric,
    // Severity none: the deterministic pre-model gate in gates.ts is the real
    // floor and wins on merge, so the mock never needs to detect violations.
    hardGate: { severity: "none", codes: [], evidence: [] },
    worked: ["Engaged with the moment instead of a canned line."],
    improve: ["Leave a little more room for her to steer."],
    betterResponse: "Keep it specific and low-pressure, and give her an easy in.",
    outcome: {
      code: "conversation_continues",
      label: "Comfortable continuation",
      confidence: "medium",
      basis: [
        {
          turn: first.turn,
          excerpt: firstWords(first.body, 4),
          reason: "Kept the exchange going without forcing it.",
        },
      ],
    },
  };
}

// Matches CallJudgeModel. `system` is ignored (the mock trusts the prompt it is
// given); the abort signal is honored by rejecting if already aborted.
export const mockCallModel: CallJudgeModel = (_system, prompt, abortSignal) => {
  if (abortSignal?.aborted) {
    return Promise.reject(new Error("aborted"));
  }
  return Promise.resolve(buildDraft(parseUserTurns(prompt)));
};
