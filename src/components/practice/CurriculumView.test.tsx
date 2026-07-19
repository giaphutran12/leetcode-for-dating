import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CurriculumView } from "./CurriculumView";
import { makeProgressApi } from "../../test/fakeProgress";

function card(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  const el = heading.closest(".taste-scenario-card");
  if (!el) throw new Error(`no card for ${title}`);
  return el as HTMLElement;
}

function renderCurriculum() {
  // Completing scenario 1 unlocks scenario 2, but scenario 3 stays locked.
  const progress = makeProgressApi({
    progress: {
      completedScenarioIds: ["spark-bus-stop"],
      bestScores: { "spark-bus-stop": 9 },
      level: 2,
      publicXP: 120,
      streak: 3,
    },
  });
  render(
    <MemoryRouter>
      <CurriculumView progress={progress} />
    </MemoryRouter>,
  );
}

describe("CurriculumView", () => {
  it("renders complete, available, and locked states from progress", () => {
    renderCurriculum();

    // Complete: best score + verdict chip.
    const complete = card("The bus-stop opener");
    expect(complete).toHaveAttribute("data-state", "complete");
    expect(within(complete).getByText("ATE")).toBeInTheDocument();
    expect(within(complete).getByText(/Best 9\/10/)).toBeInTheDocument();

    // Available: predecessor completed.
    const available = card("The demo-table introduction");
    expect(available).toHaveAttribute("data-state", "available");

    // Locked: predecessor not completed.
    const locked = card("The café that respects focus");
    expect(locked).toHaveAttribute("data-state", "locked");
  });

  it("makes locked cards non-navigable and available cards links", () => {
    renderCurriculum();

    const locked = card("The café that respects focus");
    expect(locked.tagName).toBe("DIV");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked.closest("a")).toBeNull();

    const available = card("The demo-table introduction");
    expect(available.tagName).toBe("A");
    expect(available).toHaveAttribute("href", "/practice/spark-open-source");
  });

  it("shows the mode badge matching each scenario", () => {
    renderCurriculum();

    // Scenario 1 is in person; scenario 6 is messaging.
    const inPerson = card("The bus-stop opener");
    expect(within(inPerson).getByText("IN PERSON")).toBeInTheDocument();

    const messaging = card("Keep the thread alive");
    expect(within(messaging).getByText("MESSAGING")).toBeInTheDocument();
  });
});
