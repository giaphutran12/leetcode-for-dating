// Server-owned Zod schemas for the LLM judge (plan: "Required LLM judge" server
// responsibilities 2, 3, 7; "Structured judgment"). Two schemas, two jobs:
//
//  - JudgeRequestSchema is STRICT everywhere. It is the wall that stops a client
//    from smuggling in its own scores, XP, gates, persona state, or outcomes: any
//    unknown field anywhere rejects the whole request.
//  - JudgeModelDraftSchema is the shape the MODEL must return. It deliberately has
//    NO rawScore / finalScore / verdict / XP fields — deterministic code
//    (finalizeJudgeResult) owns every number, cap, and verdict.

import { z } from "zod";
import type { CriterionId, OutcomeCode } from "../../domain/types";

// Longest single user response the practice UI accepts (plan: input bounding).
const MAX_BODY_LENGTH = 420;
// Generous upper bounds that still stop absurd payloads from reaching the model.
const MAX_ID_LENGTH = 200;

const CRITERION_IDS = [
  "context_naturalness",
  "reciprocity_listening",
  "playfulness_personality",
  "respect_calibration",
  "challenge_objective",
] as const satisfies readonly CriterionId[];

const OUTCOME_CODES = [
  "conversation_continues",
  "shared_interest",
  "contact_exchanged",
  "date_invited",
  "date_agreed",
  "graceful_exit",
  "low_interest",
  "incompatible",
  "boundary_crossed",
] as const satisfies readonly OutcomeCode[];

const turnSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const scoreSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// A single user response. Strict: no extra keys, body non-empty and bounded.
const ResponseSchema = z.strictObject({
  turn: turnSchema,
  body: z.string().min(1).max(MAX_BODY_LENGTH),
});

export const JudgeRequestSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    attemptId: z.string().min(1).max(MAX_ID_LENGTH),
    scenarioId: z.string().min(1).max(MAX_ID_LENGTH),
    responses: z.array(ResponseSchema).min(1).max(3),
  })
  // Turns must be unique, ascending, and start at 1 (i.e. [1], [1,2], [1,2,3]).
  // This mirrors the three-turn state machine and blocks gap/duplicate/reorder
  // attacks on the transcript.
  .refine(
    (value) => value.responses.every((response, index) => response.turn === index + 1),
    { message: "responses must be turns 1..n with no gaps, duplicates, or reordering" },
  );

export type JudgeRequestInput = z.infer<typeof JudgeRequestSchema>;

// Evidence exactly as the model reports it. turn is constrained to a valid turn
// here; finalizeJudgeResult still confirms the excerpt is a real substring of
// that turn against the reconstructed transcript.
const EvidenceDraftSchema = z.strictObject({
  turn: turnSchema,
  excerpt: z.string(),
  reason: z.string(),
});

// What the MODEL returns. No rawScore / finalScore / verdict / XP — those are
// computed by deterministic code from these validated fields, never trusted from
// the model. `triggered` is likewise omitted: the server derives it from the
// merged gate severity.
export const JudgeModelDraftSchema = z.strictObject({
  rubric: z
    .array(
      z.strictObject({
        id: z.enum(CRITERION_IDS),
        score: scoreSchema,
        evidence: EvidenceDraftSchema,
        feedback: z.string(),
      }),
    )
    .length(5),
  hardGate: z.strictObject({
    severity: z.enum(["none", "cap", "stop"]),
    codes: z.array(z.string()),
    evidence: z.array(EvidenceDraftSchema),
  }),
  worked: z.array(z.string()),
  improve: z.array(z.string()),
  betterResponse: z.string(),
  outcome: z.strictObject({
    code: z.enum(OUTCOME_CODES),
    label: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.array(EvidenceDraftSchema),
  }),
});

export type JudgeModelDraft = z.infer<typeof JudgeModelDraftSchema>;
