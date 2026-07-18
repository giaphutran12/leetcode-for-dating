import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RizzCodeProvider } from "../../context/RizzCodeContext";
import { getScenario } from "../../data/scenarios";
import { OnboardingView } from "./OnboardingView";
import { PracticeView } from "./PracticeView";
import { LeaderboardView } from "./LeaderboardView";
import { CurriculumView } from "./CurriculumView";

function withProvider(node: React.ReactNode) {
  return render(<RizzCodeProvider>{node}</RizzCodeProvider>);
}

describe("product view contracts", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows a scene-only in-person scenario at 0 of 6 with the correct prompt", () => {
    withProvider(<PracticeView scenario={getScenario("spark-bus-stop")!} />);
    fireEvent.click(screen.getByRole("button", { name: /start conversation/i }));
    expect(screen.getByText("0 / 6")).toBeInTheDocument();
    expect(screen.getByLabelText("What would you say?")).toBeInTheDocument();
    expect(screen.queryByText(/Maya says/i)).not.toBeInTheDocument();
  });

  it("shows the incoming message and messaging-specific prompt", () => {
    withProvider(
      <PracticeView scenario={getScenario("connection-keep-thread")!} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start conversation/i }));
    expect(
      screen.getByText(/second bánh xèo was edible/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What would you text?")).toBeInTheDocument();
  });

  it("offers a working onboarding skip with Growth Direction", () => {
    withProvider(<OnboardingView />);
    fireEvent.click(
      screen.getByRole("button", { name: /skip with smart defaults/i }),
    );
    expect(screen.getByText("Growth direction")).toBeInTheDocument();
    expect(screen.getByText("Presence")).toBeInTheDocument();
    expect(screen.getByText("Courage")).toBeInTheDocument();
  });

  it("labels the local ranking as a demo leaderboard", () => {
    withProvider(<LeaderboardView />);
    expect(screen.getByText("Demo leaderboard")).toBeInTheDocument();
    expect(screen.getByText(/not a real global rank/i)).toBeInTheDocument();
  });

  it("keeps all ten practice scenarios available from day one", () => {
    withProvider(<CurriculumView />);
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /enter scenario/i })).toHaveLength(
      10,
    );
  });
});
