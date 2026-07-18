// Progress (plan: "Required product views" view 7 + "Gamification"). Summary
// strip, per-module progress, all nine achievements as locked/unlocked, the
// seven PRIVATE real-world milestones (recordable, celebrated, and pointedly
// never worth public XP), an optional side quest, and an inline two-step reset.
// Milestones and practice XP are kept visibly separate — recording a milestone
// touches useProgress.recordMilestone only, never the score.

import { useState } from "react";
import {
  ArrowRight,
  Lock,
  SealCheck,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { achievements } from "../../data/achievements";
import { sideQuests } from "../../data/sideQuests";
import { scenarios } from "../../data/scenarios";
import type { MilestoneCode, ModuleId } from "../../domain/types";
import { useProgress, type UseProgressResult } from "../../hooks/useProgress";
import { verdictFor } from "../results/verdict";
import { SideQuestCard } from "./SideQuestCard";

interface ProgressViewProps {
  // Injectable for tests; production reads the real hook.
  progress?: UseProgressResult;
}

const MODULE_TITLE: Record<ModuleId, string> = {
  spark: "Spark",
  connection: "Connection",
};

// Hints for locked achievements — how you earn it, in voice, no spoilers.
const ACHIEVEMENT_HINT: Record<string, string> = {
  "first-contact": "Ask for her number when the moment’s actually there.",
  "made-her-laugh": "Land full marks on playfulness in any scenario.",
  "smooth-recovery": "Take the awkward-message rep and pull it back to an 8+.",
  "asked-her-out": "Make a clear, low-pressure invitation that lands.",
  "first-date": "Get to a yes with a real plan attached.",
  "callback-king": "Nail the callback scenario with an 8 or better.",
  "read-the-room": "Handle the low-interest rep with grace, 7 or better.",
  "graceful-exit": "Leave a going-nowhere moment with dignity, 7 or better.",
  "consistent-communicator": "Practice three days in a row.",
};

// The seven private milestones, in the user's voice (plan lists the codes).
const MILESTONES: { code: MilestoneCode; label: string }[] = [
  { code: "good_conversation", label: "Had a real conversation" },
  { code: "contact_exchanged", label: "Got her number" },
  { code: "received_reply", label: "She replied" },
  { code: "date_scheduled", label: "Got a date on the calendar" },
  { code: "went_on_date", label: "Went on the date" },
  { code: "second_date", label: "Second date" },
  { code: "graceful_exit", label: "Made a clean exit" },
];

const MILESTONE_LABEL: Record<MilestoneCode, string> = MILESTONES.reduce(
  (map, item) => ({ ...map, [item.code]: item.label }),
  {} as Record<MilestoneCode, string>,
);

function relativeDay(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProgressView({ progress: injected }: ProgressViewProps) {
  const real = useProgress();
  const api = injected ?? real;
  const { progress, profile, plan, milestones, persistent } = api;

  const [justLogged, setJustLogged] = useState<MilestoneCode | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const xpIntoLevel = progress.publicXP % 250;
  const xpToNext = 250 - xpIntoLevel;
  const unlocked = new Set(progress.achievements);
  const quest = plan.sideQuestId
    ? sideQuests.find((entry) => entry.id === plan.sideQuestId)
    : undefined;

  const recentMilestones = [...milestones].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  function logMilestone(code: MilestoneCode) {
    api.recordMilestone(code);
    setJustLogged(code);
  }

  const modules: ModuleId[] = ["spark", "connection"];

  return (
    <main className="taste-page taste-progress">
      <header className="taste-nav">
        <Link className="taste-nav__brand" to="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </Link>
        <nav aria-label="RizzCode navigation">
          <Link to="/">Home</Link>
          <Link to="/practice">Practice</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </nav>
        <Link className="taste-nav__switch" to="/practice">
          Keep practicing
          <ArrowRight size={17} weight="bold" />
        </Link>
      </header>

      <section className="taste-progress__head" aria-labelledby="progress-title">
        <p className="taste-kicker">Your progress</p>
        <h1 id="progress-title">Every rep is on the board.</h1>

        <div className="taste-stat-strip" aria-label="Your progress">
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
            <span>To next level</span>
            <strong>{xpToNext} XP</strong>
          </div>
        </div>

        {!persistent ? (
          <p className="taste-progress__notice" role="status">
            Your browser won’t let us save right now, so this progress lives on
            this device only. Everything still works.
          </p>
        ) : null}
      </section>

      <section className="taste-progress__section" aria-labelledby="modules-title">
        <h2 id="modules-title">Module progress</h2>
        <div className="taste-progress__modules">
          {modules.map((moduleId) => {
            const moduleScenarios = scenarios.filter(
              (scenario) => scenario.module === moduleId,
            );
            const completed = moduleScenarios.filter((scenario) =>
              progress.completedScenarioIds.includes(scenario.id),
            );
            const scored = completed
              .map((scenario) => progress.bestScores[scenario.id])
              .filter((value): value is number => value !== undefined);
            const avgBest =
              scored.length > 0
                ? Math.round(
                    (scored.reduce((sum, value) => sum + value, 0) /
                      scored.length) *
                      10,
                  ) / 10
                : null;

            return (
              <article className="taste-module-card" key={moduleId}>
                <div className="taste-module-card__head">
                  <h3>{MODULE_TITLE[moduleId]}</h3>
                  <span>
                    {completed.length}/{moduleScenarios.length} done
                  </span>
                </div>
                <p className="taste-module-card__avg">
                  {avgBest !== null
                    ? `${avgBest} avg best score`
                    : "No reps logged here yet"}
                </p>
                <ul className="taste-module-card__list">
                  {moduleScenarios.map((scenario) => {
                    const best = progress.bestScores[scenario.id];
                    return (
                      <li key={scenario.id}>
                        <Link to={`/practice/${scenario.id}`}>
                          <span className="taste-module-card__scenario">
                            {scenario.title}
                          </span>
                          {best !== undefined ? (
                            <span
                              className="taste-chip"
                              data-verdict={verdictFor(best)}
                            >
                              {best}/10
                            </span>
                          ) : (
                            <span className="taste-module-card__todo">
                              Not yet
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="taste-progress__section" aria-labelledby="ach-title">
        <h2 id="ach-title">Achievements</h2>
        <ul className="taste-achievements">
          {achievements.map((achievement) => {
            const isUnlocked = unlocked.has(achievement.id);
            return (
              <li
                className="taste-achievement"
                data-state={isUnlocked ? "unlocked" : "locked"}
                key={achievement.id}
              >
                <div className="taste-achievement__icon" aria-hidden="true">
                  {isUnlocked ? (
                    <Trophy size={20} weight="fill" />
                  ) : (
                    <Lock size={18} weight="bold" />
                  )}
                </div>
                <div className="taste-achievement__body">
                  <div className="taste-achievement__head">
                    <strong>{achievement.title}</strong>
                    <span className="taste-achievement__state">
                      {isUnlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                  <p>
                    {isUnlocked
                      ? achievement.description
                      : ACHIEVEMENT_HINT[achievement.id]}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="taste-progress__section taste-milestones"
        aria-labelledby="milestones-title"
      >
        <h2 id="milestones-title">Private wins</h2>
        <p className="taste-milestones__lede">
          Private wins. Logged for you, never for the leaderboard — real-world
          stuff earns no XP and nobody else ever sees it. Tap one when it actually
          happens.
        </p>
        <div className="taste-milestones__grid" role="group" aria-label="Log a private win">
          {MILESTONES.map((milestone) => (
            <button
              key={milestone.code}
              type="button"
              className="taste-milestone-btn"
              onClick={() => logMilestone(milestone.code)}
            >
              <Sparkle size={15} weight="fill" aria-hidden="true" />
              {milestone.label}
            </button>
          ))}
        </div>

        {justLogged ? (
          <p className="taste-milestones__confirm" role="status">
            <SealCheck size={17} weight="fill" aria-hidden="true" />
            Logged “{MILESTONE_LABEL[justLogged]}.” That’s a real one — no XP,
            just yours to keep.
          </p>
        ) : null}

        {recentMilestones.length > 0 ? (
          <ul className="taste-milestones__log" aria-label="Your logged wins">
            {recentMilestones.map((milestone) => (
              <li key={milestone.id}>
                <span>{MILESTONE_LABEL[milestone.code]}</span>
                <span className="taste-milestones__when">
                  {relativeDay(milestone.recordedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="taste-milestones__empty">
            Nothing logged yet. When something happens out there for real, this is
            where it lives.
          </p>
        )}
      </section>

      {quest ? (
        <section className="taste-progress__section" aria-label="Side quest">
          <SideQuestCard quest={quest} />
        </section>
      ) : null}

      <section
        className="taste-progress__section taste-reset"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Start over</h2>
        {confirmingReset ? (
          <div className="taste-reset__confirm" role="alertdialog" aria-label="Confirm reset">
            <p>
              Reset everything? This wipes your XP, streak, badges, and logged
              wins. Can’t be undone.
            </p>
            <div className="taste-reset__confirm-actions">
              <button
                type="button"
                className="taste-button taste-button--oxblood"
                onClick={() => {
                  api.resetProgress();
                  setConfirmingReset(false);
                  setJustLogged(null);
                }}
              >
                Yes, wipe it
              </button>
              <button
                type="button"
                className="taste-button taste-button--ghost"
                onClick={() => setConfirmingReset(false)}
              >
                Never mind
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="taste-reset__trigger"
            onClick={() => setConfirmingReset(true)}
          >
            Reset progress
          </button>
        )}
      </section>

      {/* profile.displayName is surfaced on the leaderboard; referenced here so a
          returning user's name context stays wired through the view. */}
      <p className="taste-progress__foot">
        Signed in as <strong>{profile.displayName || "You"}</strong> · practice XP
        is the only thing the board ever sees.
      </p>
    </main>
  );
}
