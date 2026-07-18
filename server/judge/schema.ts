import { z } from "zod";
import { MAX_RESPONSE_LENGTH } from "../../src/domain/constants";
import { ConversationTurnSchema } from "../persona/schema";

export const EvidenceSchema = z.object({
  turn: ConversationTurnSchema,
  excerpt: z.string().min(1).max(MAX_RESPONSE_LENGTH),
  reason: z.string().min(1).max(360),
});

export const JudgeModelDraftSchema = z.object({
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
        feedback: z.string().min(1).max(420),
      }),
    )
    .length(5),
  worked: z.array(z.string().min(1).max(280)).min(1).max(3),
  improve: z.array(z.string().min(1).max(280)).min(1).max(3),
  betterResponse: z.string().min(1).max(MAX_RESPONSE_LENGTH),
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
    label: z.string().min(1).max(120),
    confidence: z.enum(["low", "medium", "high"]),
    basis: z.array(EvidenceSchema).min(1).max(3),
  }),
});

const ResponseSchema = z.object({
  turn: ConversationTurnSchema,
  body: z.string().trim().min(1).max(MAX_RESPONSE_LENGTH),
});

export const JudgeRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    attemptId: z.string().min(8).max(120),
    scenarioId: z.string().min(1).max(120),
    responses: z.array(ResponseSchema).min(1).max(6),
    sessionToken: z.string().min(80).max(16_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    value.responses.forEach((response, index) => {
      if (response.turn !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["responses", index, "turn"],
          message: "Responses must use contiguous turns starting at one.",
        });
      }
    });
  });

export type JudgeModelDraft = z.infer<typeof JudgeModelDraftSchema>;
