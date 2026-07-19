import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResultView } from "./ResultView";
import { scenarioById } from "../../data/scenarios";
import { makeOutcome } from "../../test/fakeProgress";
import { makeJudgeResult } from "../../test/fakeJudge";
import type { ApplyJudgeResultOutcome } from "../../domain/progression";
import type { JudgeResult } from "../../domain/types";

const scenario = scenarioById("spark-bus-stop")!;

function renderResult(result: JudgeResult, outcome: ApplyJudgeResultOutcome) {
  render(
    <MemoryRouter>
      <ResultView
        scenario={scenario}
        result={result}
        outcome={outcome}
        level={2}
        nextScenarioId="spark-open-source"
        onRunItBack={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ResultView", () => {
  it("renders the score, verdict, five criteria with evidence, outcome, and XP", () => {
    renderResult(makeJudgeResult(), makeOutcome({ publicXPDelta: 40 }));

    // Score + verdict chip.
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("ATE")).toBeInTheDocument();

    // Five criteria rows with labels + evidence.
    expect(screen.getByText("Context & naturalness")).toBeInTheDocument();
    expect(screen.getByText("Reciprocity & listening")).toBeInTheDocument();
    expect(screen.getByText("Playfulness & personality")).toBeInTheDocument();
    expect(screen.getByText("Respect & calibration")).toBeInTheDocument();
    expect(screen.getByText("Challenging the objective")).toBeInTheDocument();
    expect(
      screen.getByText(/evidence excerpt for context_naturalness/),
    ).toBeInTheDocument();

    // Likely simulated outcome — exact framing label.
    expect(screen.getByText("Likely simulated outcome")).toBeInTheDocument();
    expect(screen.getByText("Comfortable continuation")).toBeInTheDocument();

    // XP delta.
    expect(screen.getByText(/\+40 practice XP/)).toBeInTheDocument();
  });

  it("shows the hard-gate callout and zero-XP copy on a stop-level result", () => {
    renderResult(
      makeJudgeResult({ severity: "stop", finalScore: 2 }),
      makeOutcome({
        publicXPDelta: 0,
        isNewBestScore: false,
        isFirstCompletion: false,
      }),
    );

    expect(screen.getByText("That crossed a hard line")).toBeInTheDocument();
    expect(screen.getByText(/give me your number now/)).toBeInTheDocument();
    expect(screen.getByText(/No XP — that crossed a line/)).toBeInTheDocument();
    expect(screen.getByText("FUMBLED")).toBeInTheDocument();
  });
});
