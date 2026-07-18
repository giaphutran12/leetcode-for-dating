// Result (plan: "Required product views" view 6 + "Structured judgment" +
// "Simulated outcomes"). Score out of 10, verdict, five rubric criteria with
// evidence, an optional hard-gate callout, what-worked / what-to-improve, a
// better response, the LIKELY SIMULATED OUTCOME (framed as a simulation, never a
// prediction), and the XP / personal-best / level-up moment. All model and user
// text renders as plain text — never as HTML.

import { ArrowRight, ArrowsClockwise, Trophy, WarningOctagon } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { achievements } from "../../data/achievements";
import type { ApplyJudgeResultOutcome } from "../../domain/progression";
import type { CriterionId, JudgeResult, Scenario } from "../../domain/types";
import { verdictCopy } from "./verdict";

interface ResultViewProps {
  scenario: Scenario;
  result: JudgeResult;
  outcome: ApplyJudgeResultOutcome;
  level: number;
  nextScenarioId: string;
  // When false, storage is unavailable and this run lives in memory only.
  // Defaults true so existing render sites need no change.
  persistent?: boolean;
  onRunItBack(): void;
}

const CRITERION_LABEL: Record<CriterionId, string> = {
  context_naturalness: "Context & naturalness",
  reciprocity_listening: "Reciprocity & listening",
  playfulness_personality: "Playfulness & personality",
  respect_calibration: "Respect & calibration",
  challenge_objective: "Challenging the objective",
};

const CONFIDENCE_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

function achievementTitle(id: string): string {
  return achievements.find((a) => a.id === id)?.title ?? id;
}

export function ResultView({
  scenario,
  result,
  outcome,
  level,
  nextScenarioId,
  persistent = true,
  onRunItBack,
}: ResultViewProps) {
  const verdict = result.verdict;
  const isStop = result.hardGate.severity === "stop";
  const xpDelta = outcome.publicXPDelta;

  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-result">
        <div className="taste-result__head">
          <Link className="taste-stage__back" to="/practice">
            ← Curriculum
          </Link>
          <span className="taste-result__scenario">{scenario.title}</span>
        </div>

        {!persistent ? (
          <p className="taste-storage-note" role="status">
            Heads up: your browser isn’t saving right now, so this score lives on
            this device only. Everything still counts here.
          </p>
        ) : null}

        <section className="taste-result__score" aria-label="Your score">
          <div className="taste-result__score-num">
            <strong>{result.finalScore}</strong>
            <span>/ 10</span>
          </div>
          <div className="taste-result__verdict">
            <span className="taste-chip taste-chip--lg" data-verdict={verdict}>
              {verdict}
            </span>
            <p>{verdictCopy(verdict, scenario.id)}</p>
          </div>
        </section>

        {result.hardGate.triggered ? (
          <section className="taste-gate" data-severity={result.hardGate.severity} role="alert">
            <div className="taste-gate__head">
              <WarningOctagon size={22} weight="fill" aria-hidden="true" />
              <strong>
                {isStop
                  ? "That crossed a hard line"
                  : "This one got capped"}
              </strong>
            </div>
            <p>
              {isStop
                ? "Threats, coercion, or pressure end the scenario and earn nothing. Not a lecture — just the standard the whole product is built on."
                : "Something in here pulled the ceiling down on this attempt. Read the moment below and reset."}
            </p>
            {result.hardGate.evidence.map((ev, i) => (
              <blockquote key={`${ev.turn}-${i}`} className="taste-gate__evidence">
                <span>Turn {ev.turn}</span>
                “{ev.excerpt}” — {ev.reason}
              </blockquote>
            ))}
          </section>
        ) : null}

        <section className="taste-rubric" aria-label="Rubric breakdown">
          {result.rubric.map((item) => (
            <article className="taste-rubric-row" key={item.id}>
              <div className="taste-rubric-row__head">
                <strong>{CRITERION_LABEL[item.id]}</strong>
                <span className="taste-rubric-row__score">{item.score}/2</span>
              </div>
              <div className="taste-rubric-row__track" aria-hidden="true">
                <span style={{ width: `${(item.score / 2) * 100}%` }} />
              </div>
              <blockquote className="taste-rubric-row__evidence">
                <span>Turn {item.evidence.turn}</span>“{item.evidence.excerpt}”
              </blockquote>
              <p className="taste-rubric-row__reason">{item.evidence.reason}</p>
              <p className="taste-rubric-row__feedback">{item.feedback}</p>
            </article>
          ))}
        </section>

        <section className="taste-result__lists">
          <div className="taste-result__worked">
            <h2>What worked</h2>
            <ul>
              {result.worked.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="taste-result__improve">
            <h2>What to sharpen</h2>
            <ul>
              {result.improve.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="taste-better" aria-labelledby="better-title">
          <h2 id="better-title">One way it could’ve landed harder</h2>
          <blockquote>{result.betterResponse}</blockquote>
        </section>

        <section className="taste-outcome" aria-labelledby="outcome-title">
          <p className="taste-kicker" id="outcome-title">
            Likely simulated outcome
          </p>
          <strong>{result.outcome.label}</strong>
          <p className="taste-outcome__conf">
            {CONFIDENCE_LABEL[result.outcome.confidence]} · this is a simulation
            of one person, not a prediction of what any real woman would do.
          </p>
        </section>

        <section className="taste-xp" aria-label="XP and progress">
          {isStop ? (
            <p className="taste-xp__delta taste-xp__delta--zero">
              No XP — that crossed a line. The rep still shows up in your history.
            </p>
          ) : xpDelta > 0 ? (
            <p className="taste-xp__delta">
              +{xpDelta} practice XP
              {outcome.isFirstCompletion ? " (first clear bonus included)" : ""}
            </p>
          ) : (
            <p className="taste-xp__delta taste-xp__delta--zero">
              No new XP this run — you didn’t beat your best yet. Run it back and
              top it.
            </p>
          )}

          <div className="taste-xp__badges">
            {outcome.isNewBestScore ? (
              <span className="taste-xp__badge taste-xp__badge--best">
                <Trophy size={15} weight="fill" aria-hidden="true" />
                New personal best
              </span>
            ) : null}
            {outcome.leveledUp ? (
              <span className="taste-xp__badge taste-xp__badge--level">
                Level {level} — leveled up
              </span>
            ) : null}
            {outcome.unlockedAchievementIds.map((id) => (
              <span className="taste-xp__badge taste-xp__badge--ach" key={id}>
                {achievementTitle(id)} unlocked
              </span>
            ))}
          </div>
        </section>

        <div className="taste-result__actions">
          <button
            type="button"
            className="taste-button taste-button--lime"
            onClick={onRunItBack}
          >
            <ArrowsClockwise size={17} weight="bold" />
            Run it back
          </button>
          <Link
            className="taste-button taste-button--ink"
            to={`/practice/${nextScenarioId}`}
          >
            Next challenge
            <ArrowRight size={17} weight="bold" />
          </Link>
          <Link className="taste-button taste-button--ghost" to="/practice">
            Back to curriculum
          </Link>
        </div>
      </div>
    </main>
  );
}
