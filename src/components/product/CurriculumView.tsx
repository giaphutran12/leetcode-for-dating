import {
  ArrowRight,
  CheckCircle,
  Sparkle,
} from "@phosphor-icons/react";
import { useRizzCode } from "../../context/RizzCodeContext";
import { useAuth } from "../../context/AuthContext";
import {
  completedScenarioCount,
  GUEST_SCENARIO_LIMIT,
  loginPathForScenario,
} from "../../domain/guestAccess";
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
  const auth = useAuth();
  const next = nextPracticeScenario(progress, profile);
  const completedCount = completedScenarioCount(progress);
  const guestLimitReached =
    !auth.loading &&
    !auth.user &&
    completedCount >= GUEST_SCENARIO_LIMIT;

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
      {!auth.user && (
        <div className="rizz-inline-notice" role="status">
          <span>
            Try three exercises free. Log in when you are ready to keep going.
          </span>
          <strong>
            {Math.min(completedCount, GUEST_SCENARIO_LIMIT)}/
            {GUEST_SCENARIO_LIMIT} guest reps complete
          </strong>
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
          <strong>
            {progress.completedScenarioIds.length}/{scenarios.length}
          </strong>
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
              {moduleScenarios.map((scenario) => {
                const complete = progress.completedScenarioIds.includes(
                  scenario.id,
                );
                const locked = guestLimitReached && !complete;
                const best = progress.bestScores[scenario.id];
                const bestMastery = progress.bestMasteryXP[scenario.id] ?? 0;
                const possibleGain = Math.max(
                  0,
                  masteryXP(10, scenario.difficulty) - bestMastery,
                );
                return (
                  <article
                    className="rizz-scenario-card"
                    data-state={
                      complete ? "complete" : locked ? "locked" : "available"
                    }
                    key={scenario.id}
                  >
                    <div className="rizz-scenario-card__top">
                      <span>
                        {String(scenario.problemNumber).padStart(2, "0")}
                      </span>
                      {complete ? (
                        <CheckCircle size={20} weight="fill" />
                      ) : locked ? (
                        <span className="rizz-available">Login required</span>
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
                    <ul
                      className="rizz-scenario-card__skills"
                      aria-label="Skills tested"
                    >
                      {scenario.skills.slice(0, 3).map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                    <div className="rizz-scenario-card__meta">
                      <span>
                        {best === undefined ? "No score yet" : `Best ${best}/10`}
                      </span>
                      <span>
                        Up to {possibleGain + (complete ? 0 : 10)} XP
                      </span>
                    </div>
                    <a
                      href={
                        locked
                          ? loginPathForScenario(scenario.id)
                          : `/practice/${scenario.id}`
                      }
                    >
                      {complete
                        ? "Run it again"
                        : locked
                          ? "Log in for this rep"
                          : "Enter scenario"}
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
