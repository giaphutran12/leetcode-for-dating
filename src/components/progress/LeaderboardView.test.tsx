import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LeaderboardView } from "./LeaderboardView";
import { makeProgressApi } from "../../test/fakeProgress";

function renderBoard(overrides = {}) {
  const api = makeProgressApi(overrides);
  return render(
    <MemoryRouter>
      <LeaderboardView progress={api} />
    </MemoryRouter>,
  );
}

describe("LeaderboardView", () => {
  it("labels itself a demo board", () => {
    renderBoard();
    expect(screen.getByText("Demo leaderboard")).toBeInTheDocument();
  });

  it("highlights the local player row with the display name and a you tag", () => {
    renderBoard({ profile: { displayName: "Eddie" }, progress: { publicXP: 700 } });

    const row = screen.getByText("Eddie").closest(".taste-board__row");
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("data-player", "true");
    expect(within(row as HTMLElement).getByText("you")).toBeInTheDocument();
  });

  it("sorts rows by practice XP descending", () => {
    const { container } = renderBoard({
      profile: { displayName: "Eddie" },
      progress: { publicXP: 700 },
    });

    const xps = Array.from(
      container.querySelectorAll(".taste-board__xp"),
    ).map((node) => Number.parseInt(node.textContent ?? "", 10));

    expect(xps.length).toBeGreaterThan(1);
    const sorted = [...xps].sort((a, b) => b - a);
    expect(xps).toEqual(sorted);
    // The player's 700 lands mid-pack, above the demo player seeded at 620.
    expect(xps).toContain(700);
  });
});
