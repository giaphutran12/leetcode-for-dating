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
    withProvider(<PracticeView scenario={getScenario("RC-001")!} />);
    fireEvent.click(screen.getByRole("button", { name: /start conversation/i }));
    expect(screen.getByText("0 / 6")).toBeInTheDocument();
    expect(screen.getByLabelText("What would you say?")).toBeInTheDocument();
    expect(screen.queryByText(/Maya says/i)).not.toBeInTheDocument();
  });

  it("shows the incoming message and messaging-specific prompt", () => {
    withProvider(
      <PracticeView scenario={getScenario("RC-035")!} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start conversation/i }));
    expect(
      screen.getByText(/commute took ninety minutes/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What would you text?")).toBeInTheDocument();
  });

  it("sends with Enter and keeps Shift+Enter available for new lines", () => {
    withProvider(<PracticeView scenario={getScenario("RC-001")!} />);
    fireEvent.click(screen.getByRole("button", { name: /start conversation/i }));
    const composer = screen.getByLabelText("What would you say?");

    fireEvent.change(composer, { target: { value: "first line" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(composer).toHaveValue("first line");
    expect(screen.getByText("0 / 6")).toBeInTheDocument();

    fireEvent.change(composer, {
      target: { value: "first line\nsecond line" },
    });
    expect(composer).toHaveValue("first line\nsecond line");

    fireEvent.keyDown(composer, { key: "Enter" });
    expect(composer).toHaveValue("");
    expect(screen.getByText("first line second line")).toBeInTheDocument();
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

  it("keeps leaderboard copy focused on competition", () => {
    withProvider(<LeaderboardView />);
    expect(
      screen.getByRole("heading", { name: "Climb the ranks." }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/demo leaderboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not a real global rank/i)).not.toBeInTheDocument();
  });

  it("keeps all 67 practice scenarios available from day one", () => {
    withProvider(<CurriculumView />);
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /enter scenario/i })).toHaveLength(
      67,
    );
  });
});
