export type ScenarioMode = "in_person" | "messaging";
export type ModuleId = "spark" | "connection";
export type Difficulty = "easy" | "medium" | "hard";
export type Engagement = "closed" | "low" | "neutral" | "warm";
export type BoundaryState = "none" | "soft" | "explicit";
export type ConversationTurn = 1 | 2 | 3 | 4 | 5 | 6;
export type ConversationTurnCount = 0 | ConversationTurn;
export type MessageDeliveryStatus = "sent" | "delivered" | "seen";

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

export interface ScenarioFallbackGraph {
  positiveSignals: string[];
  lowInterestSignals: string[];
  boundarySignals: string[];
  exitSignals: string[];
  repliesByTurn: Record<1 | 2 | 3, Record<Engagement, string>>;
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

export interface PersonaReply {
  actions: PersonaAction[];
  state: PersonaState;
  interestChange: "down" | "same" | "up";
  terminalReason:
    | null
    | "completed"
    | "persona_exit"
    | "user_exit"
    | "boundary";
}

export type PersonaAction =
  | {
      kind: "text";
      body: string;
      delayMs: number;
    }
  | {
      kind: "reaction";
      body: "😂" | "😭" | "❤️" | "👀" | "👍" | "✨";
      delayMs: number;
    };

export interface PracticeMessage {
  id: string;
  speaker: "you" | "her";
  body: string;
  turn: ConversationTurnCount;
  kind: "text" | "reaction";
  sequence: number;
  deliveryStatus?: MessageDeliveryStatus;
  createdAt: string;
}

export interface Evidence {
  turn: ConversationTurn;
  excerpt: string;
  reason: string;
}

export interface HardGate {
  triggered: boolean;
  severity: "none" | "cap" | "stop";
  codes: string[];
  maxScore: 2 | 4 | 10;
  evidence: Evidence[];
}

export interface RubricResult {
  id: CriterionId;
  score: 0 | 1 | 2;
  evidence: Evidence;
  feedback: string;
}

export interface JudgeResult {
  schemaVersion: "1.0";
  attemptId: string;
  mode: "llm";
  hardGate: HardGate;
  rubric: RubricResult[];
  rawScore: number;
  finalScore: number;
  verdict: "FUMBLED" | "COOKED" | "ATE";
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

export interface JudgeModelDraft {
  rubric: RubricResult[];
  worked: string[];
  improve: string[];
  betterResponse: string;
  outcome: JudgeResult["outcome"];
}

export interface JudgeRequest {
  schemaVersion: "1.0";
  attemptId: string;
  scenarioId: string;
  responses: Array<{ turn: ConversationTurn; body: string }>;
}

export interface PersonaRequest {
  schemaVersion: "1.0";
  attemptId: string;
  scenarioId: string;
  turn: ConversationTurn;
  body: string;
}

export type PersonaErrorCode =
  | "persona_invalid_request"
  | "persona_conflict"
  | "persona_unavailable";

export type PersonaApiResponse =
  | {
      ok: true;
      attemptId: string;
      scenarioId: string;
      turn: ConversationTurn;
      reply: PersonaReply;
      usedFallback: boolean;
    }
  | {
      ok: false;
      retryable: boolean;
      code: PersonaErrorCode;
      message: string;
    };

export type PersonaPrepareApiResponse =
  | {
      ok: true;
      attemptId: string;
      scenarioId: string;
      turn: ConversationTurn;
      prepared: true;
    }
  | {
      ok: false;
      retryable: boolean;
      code: PersonaErrorCode;
      message: string;
    };

export type JudgeErrorCode =
  | "judge_unconfigured"
  | "judge_timeout"
  | "judge_rate_limited"
  | "judge_invalid_output"
  | "judge_unavailable";

export type JudgeApiResponse =
  | { ok: true; result: JudgeResult }
  | {
      ok: false;
      retryable: boolean;
      code: JudgeErrorCode;
      message: string;
    };

export interface Attempt {
  id: string;
  scenarioId: string;
  messages: PracticeMessage[];
  userTurn: ConversationTurnCount;
  status:
    | "idle"
    | "active"
    | "awaiting_reply"
    | "awaiting_judgment"
    | "complete"
    | "error";
  personaState: PersonaState;
  result?: JudgeResult;
  error?: {
    code: JudgeErrorCode | PersonaErrorCode;
    message: string;
    retryable?: boolean;
  };
  xpAwarded?: number;
  isPersonalBest?: boolean;
  startedAt: string;
  completedAt?: string;
}

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

export interface UserProfile {
  version: 1;
  displayName: string;
  goals: string[];
  typeDescription: string;
  desiredRelationship: string;
  struggles: string[];
  onboardingComplete: boolean;
  onboardingPlan: OnboardingPlan;
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
  rewardedAttemptIds: string[];
  lastPracticeDate?: string;
}

export type MilestoneId =
  | "good_conversation"
  | "contact_exchanged"
  | "received_reply"
  | "date_scheduled"
  | "went_on_date"
  | "second_date"
  | "graceful_exit";

export interface Milestones {
  version: 1;
  earned: MilestoneId[];
}

export interface SideQuest {
  id: string;
  title: string;
  whyItFits: string;
  personalBenefit: string;
  socialBenefit: string;
  starterAction: string;
  handoffPrompt: string;
}
