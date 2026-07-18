import { z } from "zod";
import { CRITERIA, OUTCOME_LABELS } from "./constants";
import { verdictForScore } from "./scoring";
import type {
  Evidence,
  JudgeApiResponse,
  JudgeRequest,
} from "./types";

const EvidenceSchema = z.object({
  turn: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  excerpt: z.string().min(1).max(420),
  reason: z.string().min(1).max(360),
});

const JudgeResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  attemptId: z.string(),
  mode: z.literal("llm"),
  hardGate: z.object({
    triggered: z.boolean(),
    severity: z.enum(["none", "cap", "stop"]),
    codes: z.array(z.string()),
    maxScore: z.union([z.literal(2), z.literal(4), z.literal(10)]),
    evidence: z.array(EvidenceSchema),
  }),
  rubric: z
    .array(
      z.object({
        id: z.enum([
          "context_naturalness",
          "reciprocity_listening",
          "playfulness_personality",
          "respect_calibration",
          "challenge_objective",
        ]),
        score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        evidence: EvidenceSchema,
        feedback: z.string(),
      }),
    )
    .length(5),
  rawScore: z.number().int().min(0).max(10),
  finalScore: z.number().int().min(0).max(10),
  verdict: z.enum(["FUMBLED", "COOKED", "ATE"]),
  worked: z.array(z.string()),
  improve: z.array(z.string()),
  betterResponse: z.string(),
  outcome: z.object({
    code: z.enum([
      "conversation_continues",
      "shared_interest",
      "contact_exchanged",
      "date_invited",
      "date_agreed",
      "graceful_exit",
      "low_interest",
      "incompatible",
      "boundary_crossed",
    ]),
    label: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.array(EvidenceSchema).min(1),
  }),
});

export const JudgeApiResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: JudgeResultSchema }),
  z.object({
    ok: z.literal(false),
    retryable: z.boolean(),
    code: z.enum([
      "judge_unconfigured",
      "judge_timeout",
      "judge_rate_limited",
      "judge_invalid_output",
      "judge_unavailable",
    ]),
    message: z.string(),
  }),
]);

function evidenceMatchesRequest(
  evidence: Evidence,
  request: JudgeRequest,
): boolean {
  return request.responses.some(
    (response) =>
      response.turn === evidence.turn &&
      evidence.excerpt.length > 0 &&
      response.body.includes(evidence.excerpt),
  );
}

export function validateJudgeApiResponse(
  value: unknown,
  request: JudgeRequest,
): JudgeApiResponse | null {
  const parsed = JudgeApiResponseSchema.safeParse(value);
  if (!parsed.success || !parsed.data.ok) {
    return parsed.success ? parsed.data : null;
  }

  const { result } = parsed.data;
  const criterionIds = result.rubric.map((criterion) => criterion.id);
  const rawScore = result.rubric.reduce(
    (total, criterion) => total + criterion.score,
    0,
  );
  const expectedMaxScore =
    result.hardGate.severity === "stop"
      ? 2
      : result.hardGate.severity === "cap"
        ? 4
        : 10;
  const evidence = [
    ...result.rubric.map((criterion) => criterion.evidence),
    ...result.hardGate.evidence,
    ...result.outcome.basis,
  ];

  const isSemanticallyValid =
    result.attemptId === request.attemptId &&
    result.rubric.length === CRITERIA.length &&
    new Set(criterionIds).size === CRITERIA.length &&
    CRITERIA.every((id) => criterionIds.includes(id)) &&
    rawScore === result.rawScore &&
    result.finalScore === Math.min(rawScore, result.hardGate.maxScore) &&
    result.verdict === verdictForScore(result.finalScore) &&
    result.outcome.label === OUTCOME_LABELS[result.outcome.code] &&
    result.hardGate.maxScore === expectedMaxScore &&
    result.hardGate.triggered ===
      (result.hardGate.severity !== "none") &&
    (result.hardGate.triggered
      ? result.hardGate.codes.length > 0 &&
        result.hardGate.evidence.length > 0
      : result.hardGate.codes.length === 0 &&
        result.hardGate.evidence.length === 0) &&
    evidence.every((item) => evidenceMatchesRequest(item, request));

  return isSemanticallyValid ? parsed.data : null;
}
