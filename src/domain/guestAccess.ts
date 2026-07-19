import type { Progress } from "./types";

export const GUEST_SCENARIO_LIMIT = 3;

export function completedScenarioCount(progress: Progress): number {
  return new Set(progress.completedScenarioIds).size;
}

export function guestCanOpenScenario(
  progress: Progress,
  scenarioId: string,
): boolean {
  return (
    progress.completedScenarioIds.includes(scenarioId) ||
    completedScenarioCount(progress) < GUEST_SCENARIO_LIMIT
  );
}

export function requiresLoginForScenario(
  progress: Progress,
  scenarioId: string,
  authenticated: boolean,
): boolean {
  return !authenticated && !guestCanOpenScenario(progress, scenarioId);
}

export function loginPathForScenario(scenarioId: string): string {
  const returnTo = `/practice/${encodeURIComponent(scenarioId)}`;
  return `/login?reason=guest-limit&returnTo=${encodeURIComponent(returnTo)}`;
}
