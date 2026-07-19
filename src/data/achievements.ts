// The nine achievements (plan: "Gamification" — Suggested achievements). Each
// trigger is a small discriminated union that a later task evaluates from a
// (JudgeResult, Scenario, Progress) tuple. Kept deliberately simple so unlocking
// stays deterministic and testable.

import type { CriterionId, OutcomeCode } from "../domain/types";

export type AchievementTrigger =
  // The judged outcome matched this code (e.g. contact_exchanged, date_invited).
  | { kind: "outcome"; code: OutcomeCode }
  // The judged outcome matched this code and the final score cleared a bar.
  | { kind: "outcome_with_score"; code: OutcomeCode; atLeast: number }
  // A specific rubric criterion hit at least this score in the attempt.
  | { kind: "criterion_score"; criterion: CriterionId; atLeast: number }
  // A specific scenario was completed with at least this final score.
  | { kind: "scenario_score"; scenarioId: string; atLeast: number }
  // The player's streak reached at least this many days.
  | { kind: "streak"; atLeast: number };

export interface Achievement {
  id: string;
  title: string;
  description: string;
  trigger: AchievementTrigger;
}

export const achievements: Achievement[] = [
  {
    id: "first-contact",
    title: "First Contact",
    description: "You asked cleanly, she was into it, and numbers were exchanged.",
    trigger: { kind: "outcome", code: "contact_exchanged" },
  },
  {
    id: "made-her-laugh",
    title: "Made Her Laugh",
    description: "Full marks on playfulness. You brought a personality and it landed.",
    trigger: { kind: "criterion_score", criterion: "playfulness_personality", atLeast: 2 },
  },
  {
    id: "smooth-recovery",
    title: "Smooth Recovery",
    description: "You took an L, reset like an adult, and pulled the conversation back.",
    trigger: { kind: "scenario_score", scenarioId: "connection-recover-awkward", atLeast: 8 },
  },
  {
    id: "asked-her-out",
    title: "Asked Her Out",
    description: "A clear, low-pressure invitation. No 'we should hang sometime' energy.",
    trigger: { kind: "outcome", code: "date_invited" },
  },
  {
    id: "first-date",
    title: "First Date",
    description: "She said yes and you've got a plan. Now don't be weird about it.",
    trigger: { kind: "outcome", code: "date_agreed" },
  },
  {
    id: "callback-king",
    title: "Callback King",
    description: "A callback so clean it earned the laugh without forcing the bit.",
    trigger: { kind: "scenario_score", scenarioId: "connection-playful-callback", atLeast: 8 },
  },
  {
    id: "read-the-room",
    title: "Read the Room",
    description: "You caught the low interest and handled it with grace instead of pressure.",
    trigger: { kind: "scenario_score", scenarioId: "connection-handle-low-interest", atLeast: 7 },
  },
  {
    id: "graceful-exit",
    title: "Graceful Exit",
    description: "The moment didn't support more, and you left with dignity. That counts.",
    trigger: { kind: "outcome_with_score", code: "graceful_exit", atLeast: 7 },
  },
  {
    id: "consistent-communicator",
    title: "Consistent Communicator",
    description: "Three days in a row. Reliability is a skill, and you're building it.",
    trigger: { kind: "streak", atLeast: 3 },
  },
];
