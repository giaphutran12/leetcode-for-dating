import {
  ArrowRight,
  CheckCircle,
  Sparkle,
} from "@phosphor-icons/react";
import { useRizzCode } from "../../context/RizzCodeContext";
import { masteryXP, nextPracticeScenario } from "../../domain/progression";
import { modules, scenarios } from "../../data/scenarios";
import {
  DifficultyBadge,
  ModeBadge,
  ProductShell,
} from "./ProductShell";

export function CurriculumView({
  notice,
}: {
  notice?: string;
}) {
  const { profile, progress } = useRizzCode();
  const next = nextPracticeScenario(progress, profile);

  return (
    <ProductShell
      eyebrow="Spark + Connection"
      title="Pick the rep. Keep the lesson."
      actions={
        <a className="rizz-primary-button" href={`/practice/${next.id}`}>
          Next challenge
          <ArrowRight size={18} weight="bold" />
        </a>
      }
    >
      {notice && (
        <div className="rizz-inline-notice" role="status">
          {notice}
        </div>
      )}

      {!profile.onboardingComplete && (
        <aside className="rizz-onboarding-callout">
          <div>
            <Sparkle size={24} weight="fill" />
            <span>
              <strong>Want a smarter starting point?</strong>
              Four quick answers unlock your Growth Direction.
            </span>
          </div>
          <a href="/onboarding">Set my direction</a>
        </aside>
      )}

      <section className="rizz-stats-strip" aria-label="Practice progress">
        <div>
          <span>Practice XP</span>
          <strong>{progress.publicXP}</strong>
        </div>
        <div>
          <span>Level</span>
          <strong>{progress.level}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>{progress.streak} days</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{progress.completedScenarioIds.length}/10</strong>
        </div>
      </section>

      {modules.map((module) => {
        const moduleScenarios = scenarios.filter(
          (scenario) => scenario.module === module.id,
        );
        const completeCount = moduleScenarios.filter((scenario) =>
          progress.completedScenarioIds.includes(scenario.id),
        ).length;
        return (
          <section className="rizz-module" key={module.id}>
            <header>
              <div>
                <p className="rizz-kicker">{module.eyebrow}</p>
                <h2>{module.name}</h2>
                <p>{module.description}</p>
              </div>
              <strong>
                {completeCount}/{moduleScenarios.length} complete
              </strong>
            </header>
            <div className="rizz-scenario-grid">
              {moduleScenarios.map((scenario, index) => {
                const complete = progress.completedScenarioIds.includes(
                  scenario.id,
                );
                const best = progress.bestScores[scenario.id];
                const bestMastery = progress.bestMasteryXP[scenario.id] ?? 0;
                const possibleGain = Math.max(
                  0,
                  masteryXP(10, scenario.difficulty) - bestMastery,
                );
                return (
                  <article
                    className="rizz-scenario-card"
                    data-state={complete ? "complete" : "available"}
                    key={scenario.id}
                  >
                    <div className="rizz-scenario-card__top">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {complete ? (
                        <CheckCircle size={20} weight="fill" />
                      ) : (
                        <span className="rizz-available">Available</span>
                      )}
                    </div>
                    <div className="rizz-badges">
                      <ModeBadge mode={scenario.mode} />
                      <DifficultyBadge difficulty={scenario.difficulty} />
                    </div>
                    <h3>{scenario.title}</h3>
                    <p>{scenario.objective}</p>
                    <div className="rizz-scenario-card__meta">
                      <span>
                        {best === undefined ? "No score yet" : `Best ${best}/10`}
                      </span>
                      <span>
                        Up to {possibleGain + (complete ? 0 : 10)} XP
                      </span>
                    </div>
                    <a href={`/practice/${scenario.id}`}>
                      {complete ? "Run it again" : "Enter scenario"}
                      <ArrowRight size={17} />
                    </a>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </ProductShell>
  );
}
