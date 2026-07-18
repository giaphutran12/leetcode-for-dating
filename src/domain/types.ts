// Shared domain contracts for RizzCode.
//
// Adopted verbatim from docs/RIZZCODE_MASTER_PLAN.md ("Scenario and persona
// contracts", "Three-turn state machine", "Structured judgment", "Required LLM
// judge", "Onboarding contract", "Side Quests", "Persistence"). These types are
// imported by every later layer (persona engine, judge server, storage, UI).
// Pure types only — no runtime code lives here.

export type ScenarioMode = "in_person" | "messaging";
export type ModuleId = "spark" | "connection";
export type Difficulty = "easy" | "medium" | "hard";

export type Engagement = "closed" | "low" | "neutral" | "warm";
export type BoundaryState = "none" | "soft" | "explicit";

export interface PersonaState {
  engagement: Engagement;
  boundary: BoundaryState;
  terminal: boolean;
}

export interface PersonaDefinition {
  name: string;
  traits: string[];
  currentGoal: string;
  constraints: string[];
  initialState: PersonaState;
}

export interface Scenario {
  id: string;
  module: ModuleId;
  mode: ScenarioMode;
  difficulty: Difficulty;
  title: string;
  setting: string;
  premise: string;
  objective: string;
  visibleContext: string[];
  boundaries: string[];
  skills: string[];
  opening:
    | { kind: "scene_only" }
    | { kind: "persona_message"; body: string };
  persona: PersonaDefinition;
  successSignals: string[];
  supportedOutcomeCodes: OutcomeCode[];
  fallback: ScenarioFallbackGraph;
}

export interface ScenarioFallbackGraph {
  positiveSignals: string[];
  lowInterestSignals: string[];
  boundarySignals: string[];
  exitSignals: string[];
  repliesByTurn: Record<1 | 2 | 3, Record<Engagement, string>>;
}

export interface PersonaReply {
  reply: string;
  state: PersonaState;
  interestChange: "down" | "same" | "up";
  terminalReason:
    | null
    | "completed"
    | "persona_exit"
    | "user_exit"
    | "boundary";
}

export interface PracticeMessage {
  id: string;
  speaker: "you" | "her";
  body: string;
  turn: number;
  createdAt: string;
}

export interface Attempt {
  id: string;
  scenarioId: string;
  messages: PracticeMessage[];
  userTurn: 0 | 1 | 2 | 3;
  status:
    | "idle"
    | "active"
    | "awaiting_reply"
    | "awaiting_judgment"
    | "complete"
    | "error";
  result?: JudgeResult;
  startedAt: string;
  completedAt?: string;
}

export type CriterionId =
  | "context_naturalness"
  | "reciprocity_listening"
  | "playfulness_personality"
  | "respect_calibration"
  | "challenge_objective";

export type OutcomeCode =
  | "conversation_continues"
  | "shared_interest"
  | "contact_exchanged"
  | "date_invited"
  | "date_agreed"
  | "graceful_exit"
  | "low_interest"
  | "incompatible"
  | "boundary_crossed";

export type Verdict = "FUMBLED" | "COOKED" | "ATE";
export type GateSeverity = "none" | "cap" | "stop";

export interface Evidence {
  turn: 1 | 2 | 3;
  excerpt: string;
  reason: string;
}

export interface JudgeResult {
  schemaVersion: "1.0";
  attemptId: string;
  mode: "llm";
  hardGate: {
    triggered: boolean;
    severity: GateSeverity;
    codes: string[];
    maxScore: 2 | 4 | 10;
    evidence: Evidence[];
  };
  rubric: Array<{
    id: CriterionId;
    score: 0 | 1 | 2;
    evidence: Evidence;
    feedback: string;
  }>;
  rawScore: number;
  finalScore: number;
  verdict: Verdict;
  worked: string[];
  improve: string[];
  betterResponse: string;
  outcome: {
    code: OutcomeCode;
    label: string;
    confidence: "low" | "medium" | "high";
    basis: Evidence[];
  };
}

export interface JudgeRequest {
  schemaVersion: "1.0";
  attemptId: string;
  scenarioId: string;
  responses: Array<{
    turn: 1 | 2 | 3;
    body: string;
  }>;
}

export type JudgeApiResponse =
  | { ok: true; result: JudgeResult }
  | {
      ok: false;
      retryable: boolean;
      code:
        | "judge_unconfigured"
        | "judge_timeout"
        | "judge_rate_limited"
        | "judge_invalid_output"
        | "judge_unavailable";
      message: string;
    };

export interface GrowthDirection {
  quality: string;
  whyItMatters: string;
  nextRep: string;
}

export interface OnboardingPlan {
  startingModule: ModuleId;
  skillPriorities: [string, string];
  growthDirections: [GrowthDirection, GrowthDirection];
  orderedScenarioIds: string[];
  sideQuestId?: string;
}

export interface SideQuest {
  id: string;
  title: string;
  whyItFits: string;
  starterAction: string;
  handoffPrompt: string;
}

export interface UserProfile {
  version: 1;
  displayName: string;
  goals: string[];
  typeDescription: string;
  desiredRelationship: string;
  struggles: string[];
  onboardingComplete: boolean;
}

export interface Progress {
  version: 1;
  publicXP: number;
  level: number;
  streak: number;
  bestScores: Record<string, number>;
  bestMasteryXP: Record<string, number>;
  completedScenarioIds: string[];
  achievements: string[];
}

// Private real-world milestones (plan: "Private real-world milestones"). These
// produce private badges only and never affect public XP or leaderboard rank.
export type MilestoneCode =
  | "good_conversation"
  | "contact_exchanged"
  | "received_reply"
  | "date_scheduled"
  | "went_on_date"
  | "second_date"
  | "graceful_exit";

export interface Milestone {
  id: string;
  code: MilestoneCode;
  recordedAt: string;
}
