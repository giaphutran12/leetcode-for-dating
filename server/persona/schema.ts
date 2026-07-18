import { z } from "zod";
import {
  MAX_CONVERSATION_TURNS,
  MAX_RESPONSE_LENGTH,
} from "../../src/domain/constants";

export const ConversationTurnSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const PersonaActionSchema = z.object({
  kind: z.enum(["text", "reaction"]),
  body: z.string().trim().min(1).max(220),
});

export const PersonaModelDraftSchema = z
  .object({
    actions: z.array(PersonaActionSchema).min(1).max(3),
    interestChange: z.enum(["down", "same", "up"]),
    boundary: z.enum(["none", "soft", "explicit"]),
    terminalReason: z
      .enum(["completed", "persona_exit", "user_exit", "boundary"])
      .nullable(),
  })
  .strict();

export const PersonaRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    attemptId: z.string().min(8).max(120),
    scenarioId: z.string().min(1).max(120),
    turn: ConversationTurnSchema,
    body: z.string().trim().min(1).max(MAX_RESPONSE_LENGTH),
    sessionToken: z.string().min(80).max(16_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.turn > MAX_CONVERSATION_TURNS) {
      context.addIssue({
        code: "custom",
        path: ["turn"],
        message: "Turn exceeds the bounded conversation window.",
      });
    }
  });

export type PersonaModelDraft = z.infer<typeof PersonaModelDraftSchema>;
