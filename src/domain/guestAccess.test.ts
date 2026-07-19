import { describe, expect, it } from "vitest";
import { defaultProgress } from "./progression";
import {
  GUEST_SCENARIO_LIMIT,
  guestCanOpenScenario,
  loginPathForScenario,
  requiresLoginForScenario,
} from "./guestAccess";

function progressWith(...scenarioIds: string[]) {
  return {
    ...defaultProgress,
    completedScenarioIds: scenarioIds,
  };
}

describe("guest practice access", () => {
  it("lets a guest complete one distinct scenario", () => {
    expect(GUEST_SCENARIO_LIMIT).toBe(1);
    expect(guestCanOpenScenario(progressWith(), "RC-001")).toBe(true);
  });

  it("gates the second new scenario but keeps completed replays available", () => {
    const progress = progressWith("RC-001");

    expect(guestCanOpenScenario(progress, "RC-001")).toBe(true);
    expect(guestCanOpenScenario(progress, "RC-002")).toBe(false);
    expect(requiresLoginForScenario(progress, "RC-002", true)).toBe(false);
  });

  it("builds a local return path for the Google login flow", () => {
    expect(loginPathForScenario("RC-002")).toBe(
      "/login?reason=guest-limit&returnTo=%2Fpractice%2FRC-002",
    );
  });
});
