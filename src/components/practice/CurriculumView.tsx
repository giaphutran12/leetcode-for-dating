// Curriculum and scenario selection (plan: "Required product views" view 3).
// Spark and Connection modules, each scenario in catalog order with a locked /
// available / complete state, plus a header strip carrying level, XP, streak,
// and the next recommendation. Locked cards are non-navigable — no link, and
// aria-disabled so assistive tech announces them as unavailable.

import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import { scenarios } from "../../data/scenarios";
import type { ModuleId } from "../../domain/types";
import {
  nextRecommendedScenarioId,
  unlockedScenarioIds,
} from "../../domain/progression";
import { useProgress, type UseProgressResult } from "../../hooks/useProgress";
import { verdictFor } from "../results/verdict";
import { difficultyLabel, modeLanguage } from "./modeLanguage";

interface CurriculumViewProps {
  // Injectable for tests; production reads the real hook.
  progress?: UseProgressResult;
}

const MODULE_INTRO: Record<ModuleId, { title: string; line: string }> = {
  spark: {
    title: "Spark",
    line: "Starting the moment — openers, first texts, and the nerve to say the first thing.",
  },
  connection: {
    title: "Connection",
    line: "Keeping it alive — callbacks, asking her out, and reading the room when it cools.",
  },
};

function premiseTeaser(premise: string): string {
  const firstSentence = premise.split(/(?<=[.!?])\s/)[0] ?? premise;
  return firstSentence.length > 120
    ? `${firstSentence.slice(0, 117).trimEnd()}…`
    : firstSentence;
}

export function CurriculumView({ progress: injected }: CurriculumViewProps) {
  const real = useProgress();
  const api = injected ?? real;
  const { progress, plan, persistent } = api;
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;

  const unlocked = new Set(unlockedScenarioIds(progress));
  const completed = new Set(progress.completedScenarioIds);
  const nextId = nextRecommendedScenarioId(progress, plan);
  const nextScenario = scenarios.find((s) => s.id === nextId);

  const modules: ModuleId[] = ["spark", "connection"];

  return (
    <main className="taste-page taste-curriculum">
      <header className="taste-nav">
        <Link className="taste-nav__brand" to="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </Link>
        <nav aria-label="RizzCode navigation">
          <Link to="/">Home</Link>
          <Link to="/progress">Progress</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </nav>
        <Link className="taste-nav__switch" to={`/practice/${nextId}`}>
          Next up
          <ArrowRight size={17} weight="bold" />
        </Link>
      </header>

      <section className="taste-curriculum__head" aria-labelledby="curriculum-title">
        <p className="taste-kicker">Your curriculum</p>
        <h1 id="curriculum-title">Ten reps. One honest conversation at a time.</h1>

        <div className="taste-stat-strip taste-stat-strip--dark" aria-label="Your progress">
          <div>
            <span>Level</span>
            <strong>{progress.level}</strong>
          </div>
          <div>
            <span>Practice XP</span>
            <strong>{progress.publicXP}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>
              {progress.streak} {progress.streak === 1 ? "day" : "days"}
            </strong>
          </div>
          <div className="taste-stat-strip__next">
            <span>Next up</span>
            <strong>{nextScenario ? nextScenario.title : "All caught up"}</strong>
          </div>
        </div>

        {notice ? (
          <p className="taste-curriculum__notice" role="status">
            {notice}
          </p>
        ) : null}
        {!persistent ? (
          <p className="taste-curriculum__notice" role="status">
            Your browser won’t let us save right now, so progress lives on this
            device only. Practice still works fine.
          </p>
        ) : null}
      </section>

      {modules.map((moduleId) => {
        const intro = MODULE_INTRO[moduleId];
        const moduleScenarios = scenarios.filter((s) => s.module === moduleId);
        const startIndex = scenarios.findIndex((s) => s.module === moduleId);

        return (
          <section
            key={moduleId}
            className="taste-module"
            aria-labelledby={`module-${moduleId}`}
          >
            <div className="taste-module__intro">
              <h2 id={`module-${moduleId}`}>{intro.title}</h2>
              <p>{intro.line}</p>
            </div>

            <ol className="taste-scenario-grid">
              {moduleScenarios.map((s, i) => {
                const number = String(startIndex + i + 1).padStart(2, "0");
                const mode = modeLanguage(s.mode);
                const isComplete = completed.has(s.id);
                const isUnlocked = unlocked.has(s.id);
                const state = isComplete
                  ? "complete"
                  : isUnlocked
                    ? "available"
                    : "locked";
                const bestScore = progress.bestScores[s.id];

                const inner = (
                  <>
                    <div className="taste-scenario-card__top">
                      <span className="taste-scenario-card__num">{number}</span>
                      <span className="taste-badge" data-mode={s.mode}>
                        {mode.badge}
                      </span>
                      <span className="taste-scenario-card__diff">
                        {difficultyLabel(s.difficulty)}
                      </span>
                    </div>
                    <h3>{s.title}</h3>
                    <p className="taste-scenario-card__teaser">
                      {premiseTeaser(s.premise)}
                    </p>
                    <div className="taste-scenario-card__foot" data-state={state}>
                      {state === "locked" ? (
                        <span className="taste-scenario-card__lock">
                          <LockSimple size={15} weight="fill" aria-hidden="true" />
                          Unlocks after the one before it
                        </span>
                      ) : null}
                      {state === "available" ? (
                        <span className="taste-scenario-card__go">
                          Start
                          <ArrowRight size={15} weight="bold" aria-hidden="true" />
                        </span>
                      ) : null}
                      {state === "complete" && bestScore !== undefined ? (
                        <span className="taste-scenario-card__best">
                          <span className="taste-chip" data-verdict={verdictFor(bestScore)}>
                            {verdictFor(bestScore)}
                          </span>
                          Best {bestScore}/10
                        </span>
                      ) : null}
                    </div>
                  </>
                );

                if (state === "locked") {
                  return (
                    <li key={s.id}>
                      <div
                        className="taste-scenario-card"
                        data-state="locked"
                        aria-disabled="true"
                      >
                        {inner}
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={s.id}>
                    <Link
                      className="taste-scenario-card"
                      data-state={state}
                      to={`/practice/${s.id}`}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
