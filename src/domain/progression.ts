import { scenarios } from "../data/scenarios";
import type {
  Attempt,
  Difficulty,
  JudgeResult,
  Milestones,
  Progress,
  Scenario,
  UserProfile,
} from "./types";

const difficultyBonus: Record<Difficulty, number> = {
  easy: 0,
  medium: 10,
  hard: 20,
};

export const defaultProgress: Progress = {
  version: 1,
  publicXP: 0,
  level: 1,
  streak: 0,
  bestScores: {},
  bestMasteryXP: {},
  completedScenarioIds: [],
  achievements: [],
  rewardedAttemptIds: [],
};

export const defaultMilestones: Milestones = {
  version: 1,
  earned: [],
};

export function masteryXP(
  finalScore: number,
  difficulty: Difficulty,
): number {
  return finalScore * 10 + difficultyBonus[difficulty];
}

export function calculateXPDelta(input: {
  result: JudgeResult;
  difficulty: Difficulty;
  previousBestMasteryXP: number;
  firstValidCompletion: boolean;
}): number {
  if (input.result.hardGate.severity === "stop") {
    return 0;
  }
  const nextMastery = masteryXP(input.result.finalScore, input.difficulty);
  return (
    Math.max(0, nextMastery - input.previousBestMasteryXP) +
    (input.firstValidCompletion ? 10 : 0)
  );
}

function dateDiffInDays(a: string, b: string): number {
  const aDate = Date.parse(`${a}T00:00:00Z`);
  const bDate = Date.parse(`${b}T00:00:00Z`);
  return Math.round((aDate - bDate) / 86_400_000);
}

function achievementsFor(
  scenario: Scenario,
  result: JudgeResult,
  isFirstCompletion: boolean,
): string[] {
  const achievements: string[] = [];
  if (isFirstCompletion) achievements.push("First Rep");
  if (result.outcome.code === "contact_exchanged")
    achievements.push("First Contact");
  if (
    result.outcome.code === "date_invited" ||
    result.outcome.code === "date_agreed"
  )
    achievements.push("Asked Her Out");
  if (result.outcome.code === "graceful_exit") {
    achievements.push("Graceful Exit", "Read the Room");
  }
  if (
    result.rubric.find((item) => item.id === "playfulness_personality")
      ?.score === 2
  )
    achievements.push("Made Her Laugh");
  if (scenario.id === "connection-recover" && result.finalScore >= 7)
    achievements.push("Smooth Recovery");
  if (scenario.id === "connection-callback" && result.finalScore >= 8)
    achievements.push("Callback King");
  return achievements;
}

export function applyJudgment(input: {
  progress: Progress;
  attempt: Attempt;
  scenario: Scenario;
  result: JudgeResult;
  today?: string;
}): {
  progress: Progress;
  xpDelta: number;
  isPersonalBest: boolean;
  unlockedAchievements: string[];
} {
  const { progress, attempt, scenario, result } = input;
  if (progress.rewardedAttemptIds.includes(attempt.id)) {
    return {
      progress,
      xpDelta: 0,
      isPersonalBest: false,
      unlockedAchievements: [],
    };
  }

  const previousBestScore = progress.bestScores[scenario.id] ?? -1;
  const previousBestMasteryXP = progress.bestMasteryXP[scenario.id] ?? 0;
  const isValidCompletion = result.hardGate.severity !== "stop";
  const firstValidCompletion =
    !progress.completedScenarioIds.includes(scenario.id) &&
    isValidCompletion;
  const xpDelta = calculateXPDelta({
    result,
    difficulty: scenario.difficulty,
    previousBestMasteryXP,
    firstValidCompletion,
  });
  const isPersonalBest =
    isValidCompletion && result.finalScore > previousBestScore;
  const nextMastery = masteryXP(result.finalScore, scenario.difficulty);
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const nextStreak =
    progress.lastPracticeDate === today
      ? progress.streak
      : progress.lastPracticeDate &&
          dateDiffInDays(today, progress.lastPracticeDate) === 1
        ? progress.streak + 1
        : 1;
  const possibleAchievements = isValidCompletion
    ? achievementsFor(
        scenario,
        result,
        progress.completedScenarioIds.length === 0,
      )
    : [];
  const unlockedAchievements = possibleAchievements.filter(
    (achievement) => !progress.achievements.includes(achievement),
  );
  const publicXP = progress.publicXP + xpDelta;

  return {
    progress: {
      ...progress,
      publicXP,
      level: Math.floor(publicXP / 250) + 1,
      streak: nextStreak,
      bestScores: isValidCompletion
        ? {
            ...progress.bestScores,
            [scenario.id]: Math.max(previousBestScore, result.finalScore),
          }
        : progress.bestScores,
      bestMasteryXP: isValidCompletion
        ? {
            ...progress.bestMasteryXP,
            [scenario.id]: Math.max(previousBestMasteryXP, nextMastery),
          }
        : progress.bestMasteryXP,
      completedScenarioIds:
        !isValidCompletion
          ? progress.completedScenarioIds
          : [...new Set([...progress.completedScenarioIds, scenario.id])],
      achievements: [
        ...new Set([...progress.achievements, ...unlockedAchievements]),
      ],
      rewardedAttemptIds: [
        ...progress.rewardedAttemptIds.slice(-99),
        attempt.id,
      ],
      lastPracticeDate: today,
    },
    xpDelta,
    isPersonalBest,
    unlockedAchievements,
  };
}

export function nextPracticeScenario(
  progress: Progress,
  profile: UserProfile,
): Scenario {
  const ordered = profile.onboardingPlan.orderedScenarioIds
    .map((id) => scenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is Scenario => Boolean(scenario));
  return (
    ordered.find(
      (scenario) =>
        !progress.completedScenarioIds.includes(scenario.id),
    ) ??
    ordered[0] ??
    scenarios[0]
  );
}
