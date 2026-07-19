// Scenario introduction (plan: "Required product views" view 4). A cinematic,
// dark immersive brief — ink/oxblood fields, parchment text, lime accents — that
// sets the moment before the first turn. Mode badge, setting, difficulty,
// premise, objective, visible context, boundaries, and the persona's name/hook.

import { ArrowRight, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { Scenario } from "../../domain/types";
import { difficultyLabel, modeLanguage } from "./modeLanguage";

interface ScenarioIntroProps {
  scenario: Scenario;
  onBegin(): void;
}

export function ScenarioIntro({ scenario, onBegin }: ScenarioIntroProps) {
  const mode = modeLanguage(scenario.mode);

  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-intro">
        <div className="taste-intro__top">
          <Link className="taste-stage__back" to="/practice">
            ← Curriculum
          </Link>
          <div className="taste-intro__tags">
            <span className="taste-badge" data-mode={scenario.mode}>
              {mode.badge}
            </span>
            <span className="taste-intro__diff">
              {difficultyLabel(scenario.difficulty)}
            </span>
          </div>
        </div>

        <p className="taste-kicker taste-intro__kicker">
          {scenario.module === "connection" ? "Connection" : "Spark"} · The setup
        </p>
        <h1 className="taste-intro__title">{scenario.title}</h1>
        <p className="taste-intro__setting">{scenario.setting}</p>
        <p className="taste-intro__premise">{scenario.premise}</p>

        <p className="taste-intro__objective">
          <span>Your objective</span>
          {scenario.objective}
        </p>

        <div className="taste-intro__grid">
          <section aria-labelledby="intro-context">
            <h2 id="intro-context">What you can see</h2>
            <ul className="taste-intro__context">
              {scenario.visibleContext.map((item) => (
                <li key={item}>
                  <CheckCircle size={16} weight="fill" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="intro-boundaries">
            <h2 id="intro-boundaries">Keep it honest</h2>
            <ul className="taste-intro__boundaries">
              {scenario.boundaries.map((item) => (
                <li key={item}>
                  <ShieldCheck size={16} weight="fill" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="taste-intro__persona">
          <span>Who you’re talking to</span>
          <strong>{scenario.persona.name}</strong>
          <p>{scenario.persona.currentGoal}.</p>
        </div>

        <div className="taste-intro__actions">
          <button
            type="button"
            className="taste-button taste-button--lime"
            onClick={onBegin}
          >
            Begin
            <ArrowRight size={19} weight="bold" />
          </button>
          <p className="taste-intro__note">Three turns. No scripts. Just you.</p>
        </div>
      </div>
    </main>
  );
}
