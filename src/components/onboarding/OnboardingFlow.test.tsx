import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OnboardingFlow } from "./OnboardingFlow";
import { makeProgressApi } from "../../test/fakeProgress";

function renderOnboarding(overrides = {}) {
  const api = makeProgressApi(overrides);
  const utils = render(
    <MemoryRouter>
      <OnboardingFlow progress={api} />
    </MemoryRouter>,
  );
  return { api, ...utils };
}

describe("OnboardingFlow", () => {
  it("completes the flow and shows the starting line from the assembled profile", async () => {
    const user = userEvent.setup();
    const completeOnboarding = vi.fn();
    const { api, container } = renderOnboarding({ completeOnboarding });

    // Step 1: optional name.
    await user.type(screen.getByLabelText("Your name (optional)"), "Eddie");
    await user.click(screen.getByRole("button", { name: /^Next/ }));

    // Step 2: goals — connection-leaning picks.
    await user.click(screen.getByRole("button", { name: "Improve texting" }));
    await user.click(screen.getByRole("button", { name: "Ask someone out" }));
    await user.click(screen.getByRole("button", { name: /^Next/ }));

    // Step 3 + 4: free-form answers.
    await user.type(
      screen.getByRole("textbox", { name: /catches your attention/ }),
      "funny and into live music",
    );
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    await user.type(
      screen.getByRole("textbox", { name: /relationship or shared life/ }),
      "a real partner to build with",
    );
    await user.click(screen.getByRole("button", { name: /^Next/ }));

    // Step 5: a struggle.
    await user.click(screen.getByRole("button", { name: "My texts are boring" }));
    await user.click(screen.getByRole("button", { name: /See my starting line/ }));

    // completeOnboarding got the assembled profile.
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    const profile = completeOnboarding.mock.calls[0][0];
    expect(profile.displayName).toBe("Eddie");
    expect(profile.goals).toEqual(
      expect.arrayContaining(["Improve texting", "Ask someone out"]),
    );
    expect(profile.struggles).toContain("My texts are boring");

    // Starting line: module + exactly two priorities + two growth directions.
    expect(
      screen.getByRole("heading", { name: /Here.s where you begin/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Connection")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".taste-startingline__priorities li"),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll(".taste-startingline__growth"),
    ).toHaveLength(2);

    void api;
  });

  it("skips from step one straight to the default plan", async () => {
    const user = userEvent.setup();
    const skipOnboarding = vi.fn();
    renderOnboarding({ skipOnboarding });

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(skipOnboarding).toHaveBeenCalledTimes(1);
    // Default plan starts in Spark and still shows a usable starting line.
    expect(
      screen.getByRole("heading", { name: /Here.s where you begin/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Spark")).toBeInTheDocument();
  });

  it("is keyboard-completable: tab to a chip, Space to toggle, Enter to advance", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    // Move off the name step onto the chip step, then drop focus so the tab
    // walk starts from a known point (clicking Next leaves it focused).
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    await user.tab(); // ← Home link
    await user.tab(); // first chip: "Talk naturally"
    const firstChip = screen.getByRole("button", { name: "Talk naturally" });
    expect(document.activeElement).toBe(firstChip);

    await user.keyboard(" ");
    expect(
      screen.getByRole("button", { name: "Talk naturally" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Enter on the Next button advances to the next question.
    screen.getByRole("button", { name: /^Next/ }).focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: /catches your attention/ }),
    ).toBeInTheDocument();
  });
});
