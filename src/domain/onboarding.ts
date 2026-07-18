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
  const combined = [...answers.goals, answers.struggles]
    .join(" ")
    .toLowerCase();
  const startingModule =
    /text|relationship|follow|reply|date plan|connection/.test(combined)
      ? "connection"
      : "spark";
  const wantsPlayfulness = /fun|funny|humor|boring/.test(combined);
  const wantsReliability = /relationship|follow|ready|disappear/.test(combined);
  const flavor = answers.typeDescription.toLowerCase();
  const sparkPreference = /book|quiet|cafe|coffee|reader/.test(flavor)
    ? "RC-002"
    : /tech|build|developer|project|nerd/.test(flavor)
      ? "RC-004"
      : /social|outgoing|party|group/.test(flavor)
        ? "RC-005"
        : undefined;
  const connectionPreference = /cook|food|vietnamese/.test(flavor)
    ? "RC-035"
    : /plant|playful|joke/.test(flavor)
      ? "RC-023"
      : /date|plan|direct/.test(combined)
        ? "RC-040"
        : /awkward|repair|apolog/.test(combined)
          ? "RC-044"
          : /reject|low interest|mismatch/.test(combined)
            ? "RC-051"
            : undefined;
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
