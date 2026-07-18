import dotenv from "dotenv";
import { aiSdkPersonaProvider } from "../persona/provider";
import { PersonaService } from "../persona/service";
import { PersonaConversationStore } from "../persona/store";
import { aiSdkJudgeProvider } from "./provider";
import { judgeAttempt } from "./service";

dotenv.config({
  path: process.env.RIZZCODE_ENV_FILE || ".env.local",
  quiet: true,
});

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Live judge smoke skipped: OPENAI_API_KEY is not configured server-side.",
  );
  process.exit(1);
}

const request = {
  schemaVersion: "1.0" as const,
  attemptId: `live-smoke-${Date.now()}`,
  scenarioId: "RC-001",
  responses: [
    {
      turn: 1 as const,
      body: "That ramen tote is elite. Is it a recommendation or a warning?",
    },
    {
      turn: 2 as const,
      body: "Spicy miso is my answer, but I respect a strong competing case. What is yours?",
    },
    {
      turn: 3 as const,
      body: "This was fun. The ramen tribunal should continue.",
    },
  ],
};
const store = new PersonaConversationStore();
const persona = new PersonaService(store, aiSdkPersonaProvider);

for (const response of request.responses) {
  const personaResult = await persona.respond({
    schemaVersion: "1.0",
    attemptId: request.attemptId,
    scenarioId: request.scenarioId,
    turn: response.turn,
    body: response.body,
  });
  if (!personaResult.ok || personaResult.usedFallback) {
    console.error("Live persona smoke failed.");
    process.exit(1);
  }
}

const result = await judgeAttempt(request, aiSdkJudgeProvider, store);

if (!result.ok) {
  console.error(`Live judge smoke failed: ${result.code}`);
  process.exit(1);
}

console.log(
  `Live persona and judge smoke passed with five rubric criteria and verdict ${result.result.verdict}.`,
);
