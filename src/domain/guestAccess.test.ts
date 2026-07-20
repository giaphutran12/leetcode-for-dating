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
  it("lets a guest complete three distinct scenarios", () => {
    expect(GUEST_SCENARIO_LIMIT).toBe(3);
    expect(guestCanOpenScenario(progressWith(), "RC-001")).toBe(true);
    expect(
      guestCanOpenScenario(progressWith("RC-001", "RC-002"), "RC-003"),
    ).toBe(true);
  });

  it("gates the fourth new scenario but keeps completed replays available", () => {
    const progress = progressWith("RC-001", "RC-002", "RC-003");

    expect(guestCanOpenScenario(progress, "RC-001")).toBe(true);
    expect(guestCanOpenScenario(progress, "RC-004")).toBe(false);
    expect(requiresLoginForScenario(progress, "RC-004", true)).toBe(false);
  });

  it("builds a local return path for the Google login flow", () => {
    expect(loginPathForScenario("RC-004")).toBe(
      "/login?reason=guest-limit&returnTo=%2Fpractice%2FRC-004",
    );
  });
});
