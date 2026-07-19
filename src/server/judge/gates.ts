// Deterministic pre-model hard-gate detection (plan: "Hard gates", "Required LLM
// judge" server responsibility 5). This is the floor that cannot be sweet-talked:
// the LLM catches nuance, but a clear-cut threat, slur, or explicit sexual
// pressure is caught here BEFORE the model ever runs, so no amount of "give me
// 10/10" charm in the transcript can launder it away.
//
// It is intentionally conservative — only unambiguous phrases — to avoid false
// positives on benign talk about faith, values, or boundaries (a plan requirement).
// The model still reports its own gate; route.ts merges the two (strictest wins).
//
// Every detection cites the EXACT matched substring of the offending user turn so
// finalizeJudgeResult's excerpt check passes and the user sees real evidence.

import type { Evidence, GateSeverity } from "../../domain/types";
import type { ReplayResult } from "../../engine/deterministic/replay";

export interface HardGateFinding {
  severity: GateSeverity;
  codes: string[];
  evidence: Evidence[];
}

interface GatePhrase {
  code: string;
  reason: string;
  phrases: string[];
}

// STOP-level: threats/coercion, slurs, explicit sexual propositions/pressure.
// Caps at 2, forces FUMBLED, zero public XP. Only common, unambiguous wording.
const STOP_PHRASES: GatePhrase[] = [
  {
    code: "threat",
    reason: "Explicit threat or coercion toward the other person.",
    phrases: [
      "i'll hurt you",
      "i will hurt you",
      "i'll make you regret",
      "you'll regret it",
      "i know where you live",
      "i'll find you",
      "do what i say or",
      "or you'll be sorry",
    ],
  },
  {
    code: "sexual_pressure",
    reason: "Directed explicit sexual proposition or pressure.",
    phrases: [
      "send me a pic",
      "send me a photo",
      "send me nudes",
      "send nudes",
      "send me a nude",
      "sleep with me tonight",
      "have sex with me",
      "let's have sex",
    ],
  },
  {
    code: "slur",
    reason: "Slur or dehumanizing abuse.",
    // A deliberately short list of unambiguous dehumanizing slurs. Whole-word
    // matched, so it never fires on unrelated substrings.
    phrases: ["retard", "faggot", "nigger", "tranny"],
  },
];

// CAP-level: negging and demanding contact after clearly low/closed engagement.
// Caps at 4. Negging is phrase-only; the contact demand is gated on replayed
// persona state so a warm exchange asking for a number is NOT penalized.
const NEGGING: GatePhrase = {
  code: "negging",
  reason: "Insult or negging framed as a compliment.",
  phrases: ["for a girl", "you'd be prettier if", "you would be prettier if", "pretty for a"],
};

const DEMAND_CONTACT: GatePhrase = {
  code: "demanding_contact",
  reason: "Demanded contact after the persona showed low or closed interest.",
  phrases: [
    "give me your number",
    "give me your digits",
    "give me your snap",
    "give me your insta",
    "give me your instagram",
    "just give me your number",
  ],
};

const SEVERITY_RANK: Record<GateSeverity, number> = { none: 0, cap: 1, stop: 2 };

// Escape a phrase for safe use in a RegExp. Phrases are authored constants (never
// user or scenario data), but escaping keeps the matcher correct and defensive.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Find `phrase` as a whole word/phrase inside `body` and return the EXACT matched
// substring of body (preserving the user's original casing/spacing) so it can be
// cited verbatim as evidence. Unicode letter/number lookarounds enforce whole-word
// boundaries; interior whitespace is matched flexibly. Returns null if absent.
function matchPhrase(body: string, phrase: string): string | null {
  const pattern = phrase
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu");
  const match = regex.exec(body);
  return match ? match[0] : null;
}

function scanTurn(
  turn: 1 | 2 | 3,
  body: string,
  group: GatePhrase,
  severity: GateSeverity,
  out: { codes: Set<string>; evidence: Evidence[]; severity: GateSeverity },
): void {
  for (const phrase of group.phrases) {
    const excerpt = matchPhrase(body, phrase);
    if (excerpt === null) continue;
    out.codes.add(group.code);
    out.evidence.push({ turn, excerpt, reason: group.reason });
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[out.severity]) {
      out.severity = severity;
    }
    // One citation per code per turn is enough evidence.
    break;
  }
}

// Detect clear-cut hard gates across the user's responses. `responses` must be the
// normalized (trimmed) responses that will also be sent to finalizeJudgeResult, so
// cited excerpts are exact substrings of what the validator checks.
export function detectHardGates(
  responses: Array<{ turn: 1 | 2 | 3; body: string }>,
  replayResult: ReplayResult,
): HardGateFinding {
  const out = {
    codes: new Set<string>(),
    evidence: [] as Evidence[],
    severity: "none" as GateSeverity,
  };

  const engagement = replayResult.finalState.engagement;
  const lowOrClosed = engagement === "low" || engagement === "closed";

  for (const response of responses) {
    for (const group of STOP_PHRASES) {
      scanTurn(response.turn, response.body, group, "stop", out);
    }
    scanTurn(response.turn, response.body, NEGGING, "cap", out);
    // Demanding contact is only a violation once the persona has clearly cooled.
    if (lowOrClosed) {
      scanTurn(response.turn, response.body, DEMAND_CONTACT, "cap", out);
    }
  }

  return {
    severity: out.severity,
    codes: [...out.codes],
    evidence: out.evidence,
  };
}
