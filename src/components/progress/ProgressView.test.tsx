import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProgressView } from "./ProgressView";
import { makeProgressApi } from "../../test/fakeProgress";
import { defaultOnboardingPlan } from "../../domain/onboarding";

function renderProgress(overrides = {}) {
  const api = makeProgressApi(overrides);
  const utils = render(
    <MemoryRouter>
      <ProgressView progress={api} />
    </MemoryRouter>,
  );
  return { api, ...utils };
}

function achievement(title: string): HTMLElement {
  const el = screen.getByText(title).closest(".taste-achievement");
  if (!el) throw new Error(`no achievement card for ${title}`);
  return el as HTMLElement;
}

describe("ProgressView", () => {
  it("renders unlocked and locked achievements from progress", () => {
    renderProgress({ progress: { achievements: ["made-her-laugh"] } });

    const unlocked = achievement("Made Her Laugh");
    expect(unlocked).toHaveAttribute("data-state", "unlocked");
    expect(within(unlocked).getByText("Unlocked")).toBeInTheDocument();
    expect(within(unlocked).getByText(/Full marks on playfulness/)).toBeInTheDocument();

    const locked = achievement("First Contact");
    expect(locked).toHaveAttribute("data-state", "locked");
    expect(within(locked).getByText("Locked")).toBeInTheDocument();
    expect(within(locked).getByText(/Ask for her number/)).toBeInTheDocument();
  });

  it("records a milestone without touching XP or level", async () => {
    const user = userEvent.setup();
    const recordMilestone = vi.fn();
    renderProgress({ progress: { publicXP: 120, level: 1 }, recordMilestone });

    expect(screen.getByText("120")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Got her number/ }));

    expect(recordMilestone).toHaveBeenCalledWith("contact_exchanged");
    // XP text is unchanged — milestones never move the public number.
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/That.s a real one/)).toBeInTheDocument();
  });

  it("requires a two-step confirm before resetting", async () => {
    const user = userEvent.setup();
    const resetProgress = vi.fn();
    renderProgress({ resetProgress });

    await user.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(resetProgress).not.toHaveBeenCalled();
    expect(screen.getByText(/Reset everything\?/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, wipe it" }));
    expect(resetProgress).toHaveBeenCalledTimes(1);
  });

  it("shows a side quest only when the plan has one", () => {
    const { unmount } = renderProgress();
    expect(screen.queryByText("Optional side quest")).not.toBeInTheDocument();
    unmount();

    renderProgress({
      plan: { ...defaultOnboardingPlan(), sideQuestId: "learn-guitar" },
    });
    expect(screen.getByText("Optional side quest")).toBeInTheDocument();
    expect(screen.getByText("Learn Guitar")).toBeInTheDocument();
  });
});
