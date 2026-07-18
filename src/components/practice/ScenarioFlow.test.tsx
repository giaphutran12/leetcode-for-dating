import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ScenarioFlow, ScenarioSession } from "./ScenarioFlow";
import { scenarioById, scenarios } from "../../data/scenarios";
import { makeProgressApi } from "../../test/fakeProgress";
import {
  flakyJudge,
  makeJudgeResult,
  okJudge,
  scriptedEngine,
  unretryableThenOkJudge,
} from "../../test/fakeJudge";
import type { UseProgressResult } from "../../hooks/useProgress";

const sceneScenario = scenarioById("spark-bus-stop")!;
const messageScenario = scenarioById("connection-keep-thread")!;

function renderSession(
  scenario = sceneScenario,
  progress: UseProgressResult = makeProgressApi(),
  judge = okJudge(makeJudgeResult()),
) {
  return render(
    <MemoryRouter>
      <ScenarioSession
        scenario={scenario}
        progress={progress}
        engine={scriptedEngine()}
        judge={judge}
      />
    </MemoryRouter>,
  );
}

async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Begin/ }));
}

async function turn(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  text: string,
) {
  const textarea = await screen.findByLabelText(label);
  await user.type(textarea, text);
  await user.click(screen.getByRole("button", { name: /Send/ }));
}

describe("ScenarioSession — scene_only intro", () => {
  it("shows 'What would you say?', a 0 of 3 counter, and no invented her-message", async () => {
    const user = userEvent.setup();
    renderSession();
    await begin(user);

    expect(await screen.findByLabelText("What would you say?")).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    // Scene_only starts with no persona line.
    expect(screen.queryByText("She says")).not.toBeInTheDocument();
    expect(screen.queryByText(/her reply on turn/)).not.toBeInTheDocument();
  });
});

describe("ScenarioSession — persona_message intro", () => {
  it("shows her opening message and 'What would you text?'", async () => {
    const user = userEvent.setup();
    renderSession(messageScenario);
    await begin(user);

    expect(await screen.findByLabelText("What would you text?")).toBeInTheDocument();
    expect(
      screen.getByText(/longest monday of all time/),
    ).toBeInTheDocument();
    // Messaging mode labels the incoming bubble "Her" (in-person keeps "She says").
    expect(screen.getByText("Her")).toBeInTheDocument();
  });
});

describe("ScenarioSession — full loop", () => {
  it("reaches the result after three submissions", async () => {
    const user = userEvent.setup();
    renderSession();
    await begin(user);

    await turn(user, "What would you say?", "what are you reading?");
    await turn(user, "What would you say?", "nice, I love a slow burn");
    await turn(user, "What would you say?", "which bus are you catching?");

    expect(await screen.findByText("ATE")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("preserves the transcript and offers retry on a judge error, then records exactly once across error → retry", async () => {
    const user = userEvent.setup();
    const recordResult = vi.fn(() => ({
      next: makeProgressApi().progress,
      publicXPDelta: 40,
      masteryXP: 80,
      isNewBestScore: true,
      isFirstCompletion: true,
      unlockedAchievementIds: [],
      leveledUp: false,
    }));
    const progress = makeProgressApi({ recordResult });
    // Fail the first judgment, succeed on retry.
    renderSession(sceneScenario, progress, flakyJudge(makeJudgeResult(), 1));
    await begin(user);

    await turn(user, "What would you say?", "what are you reading?");
    await turn(user, "What would you say?", "nice, a slow burn");
    await turn(user, "What would you say?", "which bus is yours?");

    // Judge failed: retry offered, transcript intact, nothing recorded.
    expect(await screen.findByRole("button", { name: "Retry judgment" })).toBeInTheDocument();
    expect(screen.getByText("what are you reading?")).toBeInTheDocument();
    expect(recordResult).not.toHaveBeenCalled();

    // Retry succeeds → result renders, recorded exactly once.
    await user.click(screen.getByRole("button", { name: "Retry judgment" }));
    expect(await screen.findByText("ATE")).toBeInTheDocument();
    expect(recordResult).toHaveBeenCalledTimes(1);
  });

  it("still offers Retry judgment on a NON-retryable judge error, and the retry can succeed", async () => {
    const user = userEvent.setup();
    // judge_unconfigured is flagged retryable:false, but config can change
    // between attempts — the UI must still let the user retry (plan decision 24).
    renderSession(
      sceneScenario,
      makeProgressApi(),
      unretryableThenOkJudge(makeJudgeResult(), 1),
    );
    await begin(user);

    await turn(user, "What would you say?", "what are you reading?");
    await turn(user, "What would you say?", "nice, a slow burn");
    await turn(user, "What would you say?", "which bus is yours?");

    // Non-retryable failure: Retry judgment is offered anyway, transcript intact.
    expect(
      await screen.findByRole("button", { name: "Retry judgment" }),
    ).toBeInTheDocument();
    expect(screen.getByText("what are you reading?")).toBeInTheDocument();

    // Retrying re-invokes the judge and succeeds → the result renders.
    await user.click(screen.getByRole("button", { name: "Retry judgment" }));
    expect(await screen.findByText("ATE")).toBeInTheDocument();
  });
});

describe("ScenarioFlow — routing guards", () => {
  it("redirects an unknown scenario id to the curriculum with a message", async () => {
    render(
      <MemoryRouter initialEntries={["/practice/not-a-real-id"]}>
        <Routes>
          <Route path="/practice/:scenarioId" element={<ScenarioFlow />} />
          <Route
            path="/practice"
            element={<div>Curriculum landing</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Curriculum landing")).toBeInTheDocument();
  });

  it("redirects a locked scenario deep-link back to the curriculum", async () => {
    // Scenario 3 is locked with no completions.
    const locked = scenarios[2];
    render(
      <MemoryRouter initialEntries={[`/practice/${locked.id}`]}>
        <Routes>
          <Route path="/practice/:scenarioId" element={<ScenarioFlow />} />
          <Route path="/practice" element={<div>Curriculum landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Curriculum landing")).toBeInTheDocument();
  });
});
