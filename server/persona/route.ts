import type { Request, Response } from "express";
import type { PersonaApiResponse } from "../../src/domain/types";
import {
  fixturePersonaProvider,
  type PersonaProvider,
} from "./provider";
import { PersonaRequestSchema } from "./schema";
import { PersonaService } from "./service";
import { personaConversationStore } from "./store";

export function selectPersonaProvider(
  provider: PersonaProvider | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): PersonaProvider | undefined {
  if (provider) return provider;
  if (
    environment.NODE_ENV !== "production" &&
    environment.RIZZCODE_MOCK_PERSONA === "1"
  ) {
    return fixturePersonaProvider;
  }
  return undefined;
}

export function createPersonaService(provider?: PersonaProvider) {
  const selectedProvider = selectPersonaProvider(provider);
  return new PersonaService(
    personaConversationStore,
    selectedProvider,
  );
}

function createRoute(
  service: PersonaService,
  action: "prepare" | "respond",
) {
  return async function personaRoute(request: Request, response: Response) {
    const parsed = PersonaRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const body: PersonaApiResponse = {
        ok: false,
        retryable: false,
        code: "persona_invalid_request",
        message:
          "The persona request was invalid. Your conversation did not advance.",
      };
      response.status(400).json(body);
      return;
    }
    const result =
      action === "prepare"
        ? await service.prepare(parsed.data)
        : await service.respond(parsed.data);
    const publicResult =
      action === "prepare" && result.ok
        ? {
            ok: true as const,
            attemptId: result.attemptId,
            scenarioId: result.scenarioId,
            turn: result.turn,
            prepared: true as const,
          }
        : result;
    response
      .status(result.ok ? 200 : result.retryable ? 503 : 409)
      .json(publicResult);
  };
}

export function createPersonaRoute(
  service: PersonaService = createPersonaService(),
) {
  return createRoute(service, "respond");
}

export function createPersonaPrepareRoute(
  service: PersonaService = createPersonaService(),
) {
  return createRoute(service, "prepare");
}
