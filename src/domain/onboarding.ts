import { scenarios } from "../data/scenarios";
import type { OnboardingPlan, UserProfile } from "./types";

export interface OnboardingAnswers {
  goals: string[];
  typeDescription: string;
  desiredRelationship: string;
  struggles: string;
}

const sparkIds = scenarios
  .filter((scenario) => scenario.module === "spark")
  .map((scenario) => scenario.id);
const connectionIds = scenarios
  .filter((scenario) => scenario.module === "connection")
  .map((scenario) => scenario.id);

const connectionGoals = new Set([
  "Improve texting",
  "Ask someone out",
  "Get more dates",
  "Become more relationship-ready",
]);

const sparkScenarioByGoal: Record<string, string> = {
  "Talk naturally": "RC-001",
  "Become funnier": "RC-004",
};

const connectionScenarioByGoal: Record<string, string> = {
  "Improve texting": "RC-035",
  "Ask someone out": "RC-040",
  "Get more dates": "RC-040",
  "Become more relationship-ready": "RC-051",
};

function prioritize(
  ids: string[],
  preferredId: string | undefined,
): string[] {
  if (!preferredId || !ids.includes(preferredId)) return ids;
  return [preferredId, ...ids.filter((id) => id !== preferredId)];
}

export function buildOnboardingPlan(
  answers: OnboardingAnswers,
): OnboardingPlan {
  const startingModule = answers.goals.some((goal) =>
    connectionGoals.has(goal),
  )
    ? "connection"
    : "spark";
  const wantsPlayfulness = answers.goals.includes("Become funnier");
  const wantsReliability = answers.goals.includes(
    "Become more relationship-ready",
  );
  const sparkPreference = answers.goals
    .map((goal) => sparkScenarioByGoal[goal])
    .find(Boolean);
  const connectionPreference = answers.goals
    .map((goal) => connectionScenarioByGoal[goal])
    .find(Boolean);
  const personalizedSparkIds = prioritize(sparkIds, sparkPreference);
  const personalizedConnectionIds = prioritize(
    connectionIds,
    connectionPreference,
  );

  const skillPriorities: [string, string] =
    startingModule === "spark"
      ? [
          wantsPlayfulness ? "Playful specificity" : "Situational courage",
          "Reading reciprocity",
        ]
      : [
          wantsReliability ? "Honest follow-through" : "Balanced conversation",
          "Clear, low-pressure invitations",
        ];

  const growthDirections: OnboardingPlan["growthDirections"] =
    startingModule === "spark"
      ? [
          {
            quality: "Presence",
            whyItMatters:
              "Noticing the real moment helps you show up for the life you want, whether or not a date comes from it.",
            nextRep:
              "Name one concrete detail in your surroundings before starting one conversation.",
          },
          {
            quality: wantsPlayfulness ? "Playfulness" : "Courage",
            whyItMatters: wantsPlayfulness
              ? "A little honest personality makes shared life lighter without turning you into a performer."
              : "Small, respectful action trains you to choose clarity over another hour of overthinking.",
            nextRep: wantsPlayfulness
              ? "Tell one true observation with a slightly more playful angle today."
              : "Say one simple hello before your brain writes a committee report.",
          },
        ]
      : [
          {
            quality: "Listening",
            whyItMatters:
              "A durable relationship needs attention that changes how you respond, not questions fired on autopilot.",
            nextRep:
              "In one conversation, build your next sentence from a detail the other person just gave you.",
          },
          {
            quality: wantsReliability ? "Reliability" : "Honest follow-up",
            whyItMatters:
              "The shared life you described depends on clear follow-through long after the first spark.",
            nextRep:
              "Close one open loop today with a specific answer, plan, or respectful no.",
          },
        ];

  return {
    startingModule,
    skillPriorities,
    growthDirections,
    orderedScenarioIds:
      startingModule === "spark"
        ? [...personalizedSparkIds, ...personalizedConnectionIds]
        : [...personalizedConnectionIds, ...personalizedSparkIds],
    sideQuestId: wantsReliability ? "follow-through" : "speak-without-freezing",
  };
}

export function createProfile(
  answers?: OnboardingAnswers,
): UserProfile {
  const safeAnswers: OnboardingAnswers = answers ?? {
    goals: ["Talk naturally"],
    typeDescription: "",
    desiredRelationship: "An intentional, enjoyable relationship",
    struggles: "I overthink the first move.",
  };
  return {
    version: 1,
    displayName: "You",
    goals: safeAnswers.goals,
    typeDescription: safeAnswers.typeDescription,
    desiredRelationship: safeAnswers.desiredRelationship,
    struggles: safeAnswers.struggles ? [safeAnswers.struggles] : [],
    onboardingComplete: true,
    onboardingPlan: buildOnboardingPlan(safeAnswers),
  };
}

export const defaultProfile: UserProfile = {
  ...createProfile(),
  onboardingComplete: false,
};
