// The XP application core (plan: "Gamification" — public XP, levels, streak,
// unlocks, achievements). This is the deterministic heart of progression: it
// takes a schema-validated JudgeResult and folds it into Progress. Pure — no
// I/O, no clock (today is passed in), no randomness.
//
// Invariants enforced here:
//  - Public XP derives ONLY from validated judge results, never milestones.
//  - Anti-farming: only improvement beyond a scenario's previous best mastery XP
//    adds XP; a first valid completion adds a one-time +10.
//  - Stop-level violations are inert: 0 XP, no completion, no streak, no best
//    update, no achievement — a slur-in-the-transcript attempt earns nothing.

import { achievements as ACHIEVEMENTS } from "../data/achievements";
import type { AchievementTrigger } from "../data/achievements";
import { scenarios } from "../data/scenarios";
import type {
  JudgeResult,
  ModuleId,
  OnboardingPlan,
  Progress,
  Scenario,
} from "./types";
import { levelFor, masteryXP, publicXPDelta } from "./xp";

export interface ApplyJudgeResultOutcome {
  next: Progress;
  publicXPDelta: number;
  masteryXP: number;
  isNewBestScore: boolean;
  isFirstCompletion: boolean;
  unlockedAchievementIds: string[];
  leveledUp: boolean;
}

// Parse a YYYY-MM-DD calendar day into a UTC epoch-day integer. Using UTC noon
// avoids any DST edge; only the whole-day difference matters for streaks.
function epochDay(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const ms = Date.UTC(year, month - 1, date);
  return Math.floor(ms / 86_400_000);
}

// Streak day math on the local calendar day of the last streak-advancing
// completion: same day keeps it, the next day increments, a gap of two or more
// days (or an unparseable/backward day) resets to 1, and a first-ever
// completion opens at 1.
function nextStreak(
  current: number,
  lastPracticeDay: string | null,
  today: string,
): number {
  if (lastPracticeDay === null) return 1;
  const last = epochDay(lastPracticeDay);
  const now = epochDay(today);
  if (last === null || now === null) return 1;
  const gap = now - last;
  if (gap === 0) return current >= 1 ? current : 1;
  if (gap === 1) return current + 1;
  return 1;
}

function achievementEarned(
  trigger: AchievementTrigger,
  result: JudgeResult,
  scenario: Scenario,
  progress: Progress,
): boolean {
  switch (trigger.kind) {
    case "outcome":
      return result.outcome.code === trigger.code;
    case "outcome_with_score":
      return (
        result.outcome.code === trigger.code &&
        result.finalScore >= trigger.atLeast
      );
    case "criterion_score": {
      const item = result.rubric.find((entry) => entry.id === trigger.criterion);
      return item !== undefined && item.score >= trigger.atLeast;
    }
    case "scenario_score":
      return (
        scenario.id === trigger.scenarioId && result.finalScore >= trigger.atLeast
      );
    case "streak":
      return progress.streak >= trigger.atLeast;
  }
}

export function applyJudgeResult(
  progress: Progress,
  scenario: Scenario,
  result: JudgeResult,
  today: string,
): ApplyJudgeResultOutcome {
  const stopViolation = result.hardGate.severity === "stop";
  // A stop-level attempt is inert for progression: it must not count toward
  // completion, streak, personal best, or achievements.
  const counts = !stopViolation;

  const alreadyCompleted = progress.completedScenarioIds.includes(scenario.id);
  const isFirstCompletion = counts && !alreadyCompleted;

  const previousBestMasteryXP = progress.bestMasteryXP[scenario.id] ?? 0;
  const gainedMasteryXP = masteryXP(result.finalScore, scenario.difficulty);

  const delta = publicXPDelta({
    masteryXP: gainedMasteryXP,
    previousBestMasteryXP,
    isFirstValidCompletion: isFirstCompletion,
    stopViolation,
  });

  const publicXP = progress.publicXP + delta;
  const level = levelFor(publicXP);
  const leveledUp = level > progress.level;

  // Personal-best updates (max), skipped entirely on a stop violation so a
  // capped-to-2 attempt can never poison the anti-farming ledger.
  const bestScores = { ...progress.bestScores };
  const bestMasteryXP = { ...progress.bestMasteryXP };
  let isNewBestScore = false;
  if (counts) {
    const previousBestScore = progress.bestScores[scenario.id] ?? 0;
    if (result.finalScore > previousBestScore) {
      bestScores[scenario.id] = result.finalScore;
      isNewBestScore = true;
    }
    if (gainedMasteryXP > previousBestMasteryXP) {
      bestMasteryXP[scenario.id] = gainedMasteryXP;
    }
  }

  const completedScenarioIds = isFirstCompletion
    ? [...progress.completedScenarioIds, scenario.id]
    : progress.completedScenarioIds;

  const streak = counts
    ? nextStreak(progress.streak, progress.lastPracticeDay, today)
    : progress.streak;
  const lastPracticeDay = counts ? today : progress.lastPracticeDay;

  const next: Progress = {
    version: 1,
    publicXP,
    level,
    streak,
    bestScores,
    bestMasteryXP,
    completedScenarioIds,
    achievements: progress.achievements,
    lastPracticeDay,
  };

  // Evaluate achievements against the just-updated progress (so streak-based
  // ones see the new streak). Skip entirely on a stop violation.
  const unlockedAchievementIds: string[] = [];
  if (counts) {
    const earned = new Set(progress.achievements);
    for (const achievement of ACHIEVEMENTS) {
      if (earned.has(achievement.id)) continue;
      if (achievementEarned(achievement.trigger, result, scenario, next)) {
        unlockedAchievementIds.push(achievement.id);
      }
    }
  }
  next.achievements =
    unlockedAchievementIds.length > 0
      ? [...progress.achievements, ...unlockedAchievementIds]
      : progress.achievements;

  return {
    next,
    publicXPDelta: delta,
    masteryXP: gainedMasteryXP,
    isNewBestScore,
    isFirstCompletion,
    unlockedAchievementIds,
    leveledUp,
  };
}

// Per-scenario predecessor within the same module, in catalog order. The first
// scenario of each module has no predecessor (always unlocked).
const predecessorById = (() => {
  const predecessor = new Map<string, string | null>();
  const lastByModule = new Map<ModuleId, string>();
  for (const scenario of scenarios) {
    predecessor.set(scenario.id, lastByModule.get(scenario.module) ?? null);
    lastByModule.set(scenario.module, scenario.id);
  }
  return predecessor;
})();

// A scenario is unlocked when it is first in its module, or the previous
// scenario in its module (catalog order) has been completed. Returned in
// catalog order.
export function unlockedScenarioIds(progress: Progress): string[] {
  const completed = new Set(progress.completedScenarioIds);
  return scenarios
    .filter((scenario) => {
      const predecessor = predecessorById.get(scenario.id) ?? null;
      return predecessor === null || completed.has(predecessor);
    })
    .map((scenario) => scenario.id);
}

// The next scenario to recommend: the first unlocked, uncompleted scenario in
// the plan's ordering (if a plan is given) or catalog order. Falls back to the
// first catalog scenario when everything unlocked is already completed, so a
// finished player always has a replayable suggestion.
export function nextRecommendedScenarioId(
  progress: Progress,
  plan?: OnboardingPlan,
): string {
  const unlocked = new Set(unlockedScenarioIds(progress));
  const completed = new Set(progress.completedScenarioIds);

  const preferredOrder = plan?.orderedScenarioIds ?? [];
  for (const id of preferredOrder) {
    if (unlocked.has(id) && !completed.has(id)) return id;
  }
  for (const scenario of scenarios) {
    if (unlocked.has(scenario.id) && !completed.has(scenario.id)) {
      return scenario.id;
    }
  }
  return scenarios[0].id;
}
