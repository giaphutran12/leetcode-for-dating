// The onboarding plan builder (plan: "Onboarding contract"). Deterministic: the
// same four answers always produce the same plan. It reads goals + struggles +
// desired life and returns a starting module, two skill priorities, two growth
// directions phrased as directions (never verdicts), a full scenario ordering,
// and at most one Side Quest chosen only on a genuine interest match. No
// attachment or mental-health diagnosis language. Pure — no I/O.

import { scenarios } from "../data/scenarios";
import type {
  GrowthDirection,
  ModuleId,
  OnboardingPlan,
  UserProfile,
} from "./types";

// An empty, answer-free profile. Kept local so this pure domain module has no
// dependency on the storage layer; it mirrors the storage default and is the
// input the skip path plans against.
function emptyProfile(): UserProfile {
  return {
    version: 1,
    displayName: "",
    goals: [],
    typeDescription: "",
    desiredRelationship: "",
    struggles: [],
    onboardingComplete: false,
  };
}

// Signals that lean each way. Spark = getting started / landing a first moment;
// Connection = keeping it alive, texting, asking out, sustaining.
const SPARK_SIGNALS = [
  "open",
  "opener",
  "freeze",
  "frozen",
  "blank",
  "start",
  "approach",
  "what to say",
  "in person",
  "in-person",
  "talk natural",
  "naturally",
  "funnier",
  "funny",
  "banter",
  "confidence",
  "nervous",
  "small talk",
];

const CONNECTION_SIGNALS = [
  "text",
  "texting",
  "reply",
  "replies",
  "follow up",
  "follow-up",
  "follow through",
  "date",
  "dates",
  "ask someone out",
  "sustain",
  "keep it going",
  "keep the",
  "deepen",
  "relationship-ready",
  "relationship ready",
  "reliable",
  "reliability",
  "consistent",
  "ghost",
  "dry",
  "boring",
  "second date",
];

function countSignals(haystack: string, signals: string[]): number {
  return signals.reduce(
    (total, signal) => (haystack.includes(signal) ? total + 1 : total),
    0,
  );
}

function normalize(profile: UserProfile): string {
  return [...profile.goals, ...profile.struggles].join(" \n ").toLowerCase();
}

function startingModuleFor(profile: UserProfile): ModuleId {
  const text = normalize(profile);
  const spark = countSignals(text, SPARK_SIGNALS);
  const connection = countSignals(text, CONNECTION_SIGNALS);
  // Default is spark: a tie or no signal starts you at the very beginning.
  return connection > spark ? "connection" : "spark";
}

// Skill priorities, keyed by theme, in a fixed detection order. We collect the
// ones that match, then top up from the module default so there are always two.
interface Themed {
  match: string[];
  priority: string;
}

const SPARK_THEMES: Themed[] = [
  {
    match: ["freeze", "frozen", "blank", "nervous", "what to say", "start"],
    priority: "Getting the first sentence out before you overthink it",
  },
  {
    match: ["funnier", "funny", "banter", "boring"],
    priority: "Being playful on purpose without forcing the bit",
  },
  {
    match: ["open", "opener", "approach", "in person", "in-person"],
    priority: "Opening from something you can both actually see",
  },
  {
    match: ["confidence"],
    priority: "Staying loose when you don't know how it'll land",
  },
];

const CONNECTION_THEMES: Themed[] = [
  {
    match: ["text", "texting", "reply", "replies", "dry"],
    priority: "Texting like a person, not a survey",
  },
  {
    match: ["date", "dates", "ask someone out", "second date"],
    priority: "Making a clear, low-pressure invitation",
  },
  {
    match: ["ghost", "reliable", "reliability", "consistent", "follow through", "follow-up"],
    priority: "Following through once the shiny beginning wears off",
  },
  {
    match: ["boring", "sustain", "deepen", "keep the", "keep it going"],
    priority: "Keeping a thread alive without interviewing her",
  },
];

const SPARK_DEFAULT_PRIORITIES = [
  "Opening from something you can both actually see",
  "Bringing your own personality, not just questions",
];

const CONNECTION_DEFAULT_PRIORITIES = [
  "Keeping a thread alive without interviewing her",
  "Making a clear, low-pressure invitation",
];

function pickPriorities(
  profile: UserProfile,
  module: ModuleId,
): [string, string] {
  const text = normalize(profile);
  const themes = module === "spark" ? SPARK_THEMES : CONNECTION_THEMES;
  const defaults =
    module === "spark" ? SPARK_DEFAULT_PRIORITIES : CONNECTION_DEFAULT_PRIORITIES;

  const picked: string[] = [];
  for (const theme of themes) {
    if (theme.match.some((needle) => text.includes(needle))) {
      picked.push(theme.priority);
    }
  }
  for (const fallback of defaults) {
    if (picked.length >= 2) break;
    if (!picked.includes(fallback)) picked.push(fallback);
  }
  return [picked[0], picked[1]] as [string, string];
}

// Growth directions: qualities framed as a direction that serves HIS desired
// life, each with one concrete, immediately testable rep. Not a verdict on his
// worth. No diagnosis language.
interface QualityDirection extends GrowthDirection {
  match: string[];
}

const QUALITY_LIBRARY: QualityDirection[] = [
  {
    quality: "Presence",
    whyItMatters:
      "The life you want is built in real conversations, and those go better when you're actually in them instead of rehearsing the next line in your head.",
    nextRep:
      "In your next chat, notice one specific thing she said and respond to that before you say anything you planned.",
    match: ["freeze", "frozen", "blank", "nervous", "overthink", "what to say"],
  },
  {
    quality: "Playfulness",
    whyItMatters:
      "Fun is what makes someone want to see you again, and it's a muscle — the more you let yourself be a little silly, the more you become the guy people enjoy.",
    nextRep:
      "Send or say one lightly teasing, warm line this week and let it be imperfect.",
    match: ["funnier", "funny", "banter", "boring", "serious", "stiff"],
  },
  {
    quality: "Courage",
    whyItMatters:
      "Nothing you want happens if you never make the move, and the ask gets easier every single time you actually do it.",
    nextRep:
      "The next time you're enjoying a conversation, be the one who suggests a concrete next step.",
    match: ["ask", "date", "dates", "confidence", "approach", "shy"],
  },
  {
    quality: "Listening",
    whyItMatters:
      "The relationship you're after is two people feeling known, and that starts with her feeling like you actually heard her.",
    nextRep:
      "Ask one follow-up question that proves you were listening, then add something of your own.",
    match: ["interview", "listen", "reciprocity", "keep the", "deepen"],
  },
  {
    quality: "Follow-through",
    whyItMatters:
      "Reliability is the whole game once the exciting part fades, and it's the thing that turns a spark into something that lasts.",
    nextRep:
      "Send one honest reply you've been putting off — today, not tomorrow.",
    match: ["ghost", "reliable", "reliability", "consistent", "follow", "flaky", "disappear"],
  },
  {
    quality: "Self-control",
    whyItMatters:
      "Reading the room and easing off when she's not there yet is what makes people trust you — and it's what keeps the door open instead of slamming it.",
    nextRep:
      "Next time you get a lukewarm reply, match her energy down a notch instead of pushing.",
    match: ["push", "pressure", "rejection", "low interest", "dry", "calibrate"],
  },
];

const SPARK_DEFAULT_QUALITIES = ["Presence", "Playfulness"];
const CONNECTION_DEFAULT_QUALITIES = ["Listening", "Follow-through"];

function toGrowthDirection(quality: QualityDirection): GrowthDirection {
  return {
    quality: quality.quality,
    whyItMatters: quality.whyItMatters,
    nextRep: quality.nextRep,
  };
}

function pickGrowthDirections(
  profile: UserProfile,
  module: ModuleId,
): [GrowthDirection, GrowthDirection] {
  const text = normalize(profile);
  const picked: QualityDirection[] = [];
  for (const quality of QUALITY_LIBRARY) {
    if (quality.match.some((needle) => text.includes(needle))) {
      picked.push(quality);
    }
  }

  const defaults =
    module === "spark" ? SPARK_DEFAULT_QUALITIES : CONNECTION_DEFAULT_QUALITIES;
  for (const name of defaults) {
    if (picked.length >= 2) break;
    const quality = QUALITY_LIBRARY.find((entry) => entry.quality === name);
    if (quality && !picked.some((entry) => entry.quality === name)) {
      picked.push(quality);
    }
  }

  return [toGrowthDirection(picked[0]), toGrowthDirection(picked[1])] as [
    GrowthDirection,
    GrowthDirection,
  ];
}

function orderedScenarioIdsFor(module: ModuleId): string[] {
  const starting = scenarios
    .filter((scenario) => scenario.module === module)
    .map((scenario) => scenario.id);
  const rest = scenarios
    .filter((scenario) => scenario.module !== module)
    .map((scenario) => scenario.id);
  return [...starting, ...rest];
}

// Side Quests are chosen only on a genuine interest/life match, against the
// free-form answers. At most one, in a fixed priority order. Most users get
// none — that's the intended, conservative behavior.
interface SideQuestMatch {
  id: string;
  match: string[];
}

const SIDE_QUEST_MATCHES: SideQuestMatch[] = [
  {
    id: "learn-guitar",
    match: ["music", "guitar", "instrument", "band", "sing", "play songs"],
  },
  {
    id: "speak-without-freezing",
    match: ["freeze", "frozen", "blank", "public speaking", "stutter", "words come out"],
  },
  {
    id: "follow-through",
    match: ["ghost", "flaky", "reliable", "reliability", "follow through", "disappear", "postpone"],
  },
  {
    id: "learn-household-skill",
    match: ["cook", "fix", "handy", "household", "practical", "diy", "repair"],
  },
  {
    id: "presentation-reset",
    match: ["style", "dress", "grooming", "look", "presentation", "clothes", "posture"],
  },
];

function pickSideQuestId(profile: UserProfile): string | undefined {
  const text = [
    ...profile.goals,
    ...profile.struggles,
    profile.typeDescription,
    profile.desiredRelationship,
  ]
    .join(" \n ")
    .toLowerCase();

  for (const candidate of SIDE_QUEST_MATCHES) {
    if (candidate.match.some((needle) => text.includes(needle))) {
      return candidate.id;
    }
  }
  return undefined;
}

export function buildOnboardingPlan(profile: UserProfile): OnboardingPlan {
  const startingModule = startingModuleFor(profile);
  const plan: OnboardingPlan = {
    startingModule,
    skillPriorities: pickPriorities(profile, startingModule),
    growthDirections: pickGrowthDirections(profile, startingModule),
    orderedScenarioIds: orderedScenarioIdsFor(startingModule),
  };
  const sideQuestId = pickSideQuestId(profile);
  if (sideQuestId !== undefined) plan.sideQuestId = sideQuestId;
  return plan;
}

// The plan for a skipped onboarding: exactly what an empty profile produces —
// a sensible spark-first default with no Side Quest. Defined in terms of
// buildOnboardingPlan so the skip path and an empty profile can never drift.
export function defaultOnboardingPlan(): OnboardingPlan {
  return buildOnboardingPlan(emptyProfile());
}
