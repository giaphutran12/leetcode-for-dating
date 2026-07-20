import {
  ArrowSquareOut,
  Check,
  Copy,
  Medal,
  Sparkle,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  ActivityContributionGraph,
  BrandKicker,
  BrandSurface,
} from "@/design-system";
import { useRizzCode } from "../../context/RizzCodeContext";
import { buildActivityCalendar } from "../../domain/activity";
import type { MilestoneId } from "../../domain/types";
import { getSideQuest } from "../../data/sideQuests";
import { modules, scenarios } from "../../data/scenarios";
import { ProductShell } from "./ProductShell";

const milestoneLabels: Record<MilestoneId, string> = {
  good_conversation: "Good real conversation",
  contact_exchanged: "Contact exchanged",
  received_reply: "Received a reply",
  date_scheduled: "Date scheduled",
  went_on_date: "Went on a date",
  second_date: "Second date",
  graceful_exit: "Graceful exit",
};

export function ProgressView() {
  const {
    profile,
    progress,
    activity,
    milestones,
    toggleMilestone,
  } = useRizzCode();
  const [copied, setCopied] = useState(false);
  const quest = getSideQuest(profile.onboardingPlan.sideQuestId);
  const activityCalendar = buildActivityCalendar(activity);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(quest.handoffPrompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ProductShell
      eyebrow="Your progress"
      title="Receipts over vibes."
    >
      <section className="rizz-progress-hero">
        <div>
          <span>Level</span>
          <strong>{progress.level}</strong>
        </div>
        <div>
          <span>App-verified practice XP</span>
          <strong>{progress.publicXP}</strong>
        </div>
        <div>
          <span>Current streak</span>
          <strong>{progress.streak} days</strong>
        </div>
      </section>

      <BrandSurface className="rizz-activity-panel">
        <header>
          <div>
            <BrandKicker>Practice activity</BrandKicker>
            <h2>Build the reps.</h2>
          </div>
          <p>
            Each square is a local calendar day. More completed judgments mean
            more intensity. Failed judgments never count.
          </p>
        </header>
        <ActivityContributionGraph
          weeks={activityCalendar.weeks}
          total={activityCalendar.total}
        />
      </BrandSurface>

      <section className="rizz-progress-grid">
        <article className="rizz-progress-panel">
          <header>
            <div>
              <p className="rizz-kicker">Curriculum</p>
              <h2>Module progress</h2>
            </div>
          </header>
          {modules.map((module) => {
            const moduleScenarios = scenarios.filter(
              (scenario) => scenario.module === module.id,
            );
            const completed = moduleScenarios.filter((scenario) =>
              progress.completedScenarioIds.includes(scenario.id),
            ).length;
            return (
              <div className="rizz-module-progress" key={module.id}>
                <div>
                  <strong>{module.name}</strong>
                  <span>
                    {completed}/{moduleScenarios.length}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${module.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={moduleScenarios.length}
                  aria-valuenow={completed}
                >
                  <span
                    style={{
                      width: `${(completed / moduleScenarios.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </article>

        <article className="rizz-progress-panel">
          <header>
            <div>
              <p className="rizz-kicker">Achievements</p>
              <h2>Unlocked in practice</h2>
            </div>
          </header>
          <div className="rizz-achievements">
            {progress.achievements.length ? (
              progress.achievements.map((achievement) => (
                <span key={achievement}>
                  <Medal size={20} weight="fill" />
                  {achievement}
                </span>
              ))
            ) : (
              <p>Finish a judged rep and the cabinet starts filling up.</p>
            )}
          </div>
        </article>
      </section>

      <section className="rizz-private-milestones">
        <header>
          <div>
            <p className="rizz-kicker">Private and self-reported</p>
            <h2>Real-world milestones</h2>
          </div>
          <p>
            These badges add zero public XP and never affect demo rank. They are
            yours, not a performance claim.
          </p>
        </header>
        <div>
          {(Object.keys(milestoneLabels) as MilestoneId[]).map((milestone) => {
            const earned = milestones.earned.includes(milestone);
            return (
              <button
                type="button"
                data-earned={earned}
                aria-pressed={earned}
                onClick={() => toggleMilestone(milestone)}
                key={milestone}
              >
                <span>{earned && <Check size={17} weight="bold" />}</span>
                {milestoneLabels[milestone]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rizz-side-quest">
        <div>
          <p className="rizz-kicker">Optional side quest</p>
          <h2>{quest.title}</h2>
          <p>{quest.whyItFits}</p>
        </div>
        <div className="rizz-side-quest__why">
          <article>
            <strong>Personal benefit</strong>
            <p>{quest.personalBenefit}</p>
          </article>
          <article>
            <strong>Possible social benefit</strong>
            <p>{quest.socialBenefit}</p>
          </article>
        </div>
        <div className="rizz-side-quest__action">
          <Sparkle size={23} weight="fill" />
          <span>
            <strong>One starter action</strong>
            {quest.starterAction}
          </span>
        </div>
        <blockquote>{quest.handoffPrompt}</blockquote>
        <div className="rizz-side-quest__buttons">
          <button type="button" onClick={copyPrompt}>
            <Copy size={18} />
            {copied ? "Copied" : "Copy handoff prompt"}
          </button>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              quest.title,
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            Generic YouTube search
            <ArrowSquareOut size={18} />
          </a>
        </div>
        <p className="rizz-side-quest__boundary">
          Bro, RizzCode does not teach the subject. Take the prompt to ChatGPT
          or use the generic search, then come back when you have the rep.
        </p>
      </section>
    </ProductShell>
  );
}
