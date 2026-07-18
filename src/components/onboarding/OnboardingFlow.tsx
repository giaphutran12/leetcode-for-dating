// Onboarding (plan: "Onboarding contract" + "Required product views" view 2).
// An optional name, then the four plan questions one step at a time, a skip that
// works from every step, back navigation, and full keyboard completability.
// Finishing builds the deterministic plan and reveals the "Your starting line"
// screen: recommended module, two skill priorities, a two-quality Growth
// Direction with a first rep each, an optional side quest, and the CTA into the
// first recommended scenario. Warm wingman, zero therapist — the questions never
// promise to read a woman's mind from a description of her looks.

import { KeyboardEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { scenarioById } from "../../data/scenarios";
import { sideQuests } from "../../data/sideQuests";
import {
  buildOnboardingPlan,
  defaultOnboardingPlan,
} from "../../domain/onboarding";
import { nextRecommendedScenarioId } from "../../domain/progression";
import type { ModuleId, OnboardingPlan, UserProfile } from "../../domain/types";
import { useProgress, type UseProgressResult } from "../../hooks/useProgress";
import { SideQuestCard } from "../progress/SideQuestCard";

interface OnboardingFlowProps {
  // Injectable for tests; production reads the real hook.
  progress?: UseProgressResult;
}

// Exact plan options for "What do you want to improve?" — BINDING copy.
const GOAL_OPTIONS = [
  "Talk naturally",
  "Become funnier",
  "Improve texting",
  "Ask someone out",
  "Get more dates",
  "Become more relationship-ready",
];

// Derived from the plan's target-user problem list, in the user's own voice.
const STRUGGLE_OPTIONS = [
  "I freeze in person",
  "My texts are boring",
  "I can’t make the invite",
  "I interview instead of talking",
  "I disappear after the exciting start",
  "I perform a fake personality",
];

const STEP_IDS = ["name", "improve", "type", "relationship", "struggle"] as const;
type StepId = (typeof STEP_IDS)[number];

const MODULE_REC: Record<ModuleId, { name: string; why: string }> = {
  spark: {
    name: "Spark",
    why: "You’re starting where the nerve lives — getting the first words out and turning a plain moment into one worth continuing.",
  },
  connection: {
    name: "Connection",
    why: "You can get something started; these reps are about keeping it warm, asking with a clear head, and not vanishing after the good part.",
  },
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function OnboardingFlow({ progress: injected }: OnboardingFlowProps) {
  const real = useProgress();
  const api = injected ?? real;

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [typeText, setTypeText] = useState("");
  const [relationshipText, setRelationshipText] = useState("");
  const [struggles, setStruggles] = useState<string[]>([]);
  const [customStruggle, setCustomStruggle] = useState("");
  const [resultPlan, setResultPlan] = useState<OnboardingPlan | null>(null);

  function assembleProfile(): UserProfile {
    const extra = customStruggle.trim();
    return {
      version: 1,
      // Optional name defaults to "You" so the leaderboard and copy never blank.
      displayName: name.trim() || "You",
      goals,
      typeDescription: typeText.trim(),
      desiredRelationship: relationshipText.trim(),
      struggles: extra ? [...struggles, extra] : struggles,
      onboardingComplete: false,
    };
  }

  function finish() {
    const profile = assembleProfile();
    api.completeOnboarding(profile);
    setResultPlan(buildOnboardingPlan({ ...profile, onboardingComplete: true }));
  }

  function skip() {
    api.skipOnboarding();
    setResultPlan(defaultOnboardingPlan());
  }

  if (resultPlan !== null) {
    return <StartingLine plan={resultPlan} api={api} />;
  }

  const step: StepId = STEP_IDS[stepIndex];
  const isLast = stepIndex === STEP_IDS.length - 1;

  function next() {
    if (isLast) finish();
    else setStepIndex((index) => index + 1);
  }

  function back() {
    setStepIndex((index) => Math.max(0, index - 1));
  }

  // Enter on a single-line field advances (textareas keep Enter for newlines).
  function onFieldEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      next();
    }
  }

  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-onboard">
        <div className="taste-onboard__head">
          <Link className="taste-stage__back" to="/">
            ← Home
          </Link>
          <span className="taste-onboard__count">
            Step {stepIndex + 1} of {STEP_IDS.length}
          </span>
        </div>

        <ol className="taste-onboard__progress" aria-hidden="true">
          {STEP_IDS.map((id, index) => (
            <li key={id} data-active={index <= stepIndex} />
          ))}
        </ol>

        {step === "name" ? (
          <section className="taste-onboard__step" aria-labelledby="onboard-q">
            <p className="taste-kicker taste-intro__kicker">
              Let’s build your track
            </p>
            <h1 id="onboard-q">First — what should we call you?</h1>
            <p className="taste-onboard__help">
              Totally optional. It’s just the name on your progress and the demo
              board. Leave it blank and you’re “You.”
            </p>
            <input
              className="taste-onboard__input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={onFieldEnter}
              placeholder="Your name or a handle"
              aria-label="Your name (optional)"
              maxLength={40}
            />
          </section>
        ) : null}

        {step === "improve" ? (
          <section className="taste-onboard__step" aria-labelledby="onboard-q">
            <p className="taste-kicker taste-intro__kicker">What you’re here for</p>
            <h1 id="onboard-q">What do you want to improve?</h1>
            <p className="taste-onboard__help">
              Pick any that fit — or none. No wrong answers, and wanting a date is
              a completely fine reason to be here.
            </p>
            <div className="taste-onboard__chips" role="group" aria-label="Goals">
              {GOAL_OPTIONS.map((option) => {
                const selected = goals.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className="taste-chip-toggle"
                    aria-pressed={selected}
                    onClick={() => setGoals((list) => toggle(list, option))}
                  >
                    {selected ? (
                      <Check size={14} weight="bold" aria-hidden="true" />
                    ) : null}
                    {option}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === "type" ? (
          <section className="taste-onboard__step" aria-labelledby="onboard-q">
            <p className="taste-kicker taste-intro__kicker">Your type</p>
            <h1 id="onboard-q">What kind of woman catches your attention?</h1>
            <p className="taste-onboard__help">
              Appearance, energy, interests, personality — whatever’s true for
              you. This flavors your scenarios. It’s not a mind-reader: nobody can
              tell you what she wants from how she looks.
            </p>
            <textarea
              className="taste-onboard__textarea"
              value={typeText}
              onChange={(event) => setTypeText(event.target.value)}
              rows={4}
              placeholder="Funny, a bit nerdy, into live music, doesn’t take herself too seriously…"
              aria-label="What kind of woman catches your attention"
            />
          </section>
        ) : null}

        {step === "relationship" ? (
          <section className="taste-onboard__step" aria-labelledby="onboard-q">
            <p className="taste-kicker taste-intro__kicker">The life you want</p>
            <h1 id="onboard-q">
              What kind of relationship or shared life do you want?
            </h1>
            <p className="taste-onboard__help">
              Where’s this pointed? A real partner, a calm home, someone to build
              with. This is what your growth reps get pointed at.
            </p>
            <textarea
              className="taste-onboard__textarea"
              value={relationshipText}
              onChange={(event) => setRelationshipText(event.target.value)}
              rows={4}
              placeholder="Someone I can be fully myself with, who’s building toward the same kind of life…"
              aria-label="What kind of relationship or shared life do you want"
            />
          </section>
        ) : null}

        {step === "struggle" ? (
          <section className="taste-onboard__step" aria-labelledby="onboard-q">
            <p className="taste-kicker taste-intro__kicker">The honest part</p>
            <h1 id="onboard-q">Where do you currently struggle?</h1>
            <p className="taste-onboard__help">
              Be honest — this is where the reps do the most. Pick what lands, or
              add your own.
            </p>
            <div
              className="taste-onboard__chips"
              role="group"
              aria-label="Struggles"
            >
              {STRUGGLE_OPTIONS.map((option) => {
                const selected = struggles.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className="taste-chip-toggle"
                    aria-pressed={selected}
                    onClick={() => setStruggles((list) => toggle(list, option))}
                  >
                    {selected ? (
                      <Check size={14} weight="bold" aria-hidden="true" />
                    ) : null}
                    {option}
                  </button>
                );
              })}
            </div>
            <input
              className="taste-onboard__input"
              type="text"
              value={customStruggle}
              onChange={(event) => setCustomStruggle(event.target.value)}
              onKeyDown={onFieldEnter}
              placeholder="Something else in your words (optional)"
              aria-label="Add your own struggle"
              maxLength={120}
            />
          </section>
        ) : null}

        <div className="taste-onboard__actions">
          {stepIndex > 0 ? (
            <button
              type="button"
              className="taste-button taste-button--ghost"
              onClick={back}
            >
              <ArrowLeft size={16} weight="bold" />
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="taste-button taste-button--lime"
            onClick={next}
          >
            {isLast ? "See my starting line" : "Next"}
            <ArrowRight size={17} weight="bold" />
          </button>
          <button
            type="button"
            className="taste-onboard__skip"
            onClick={skip}
          >
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}

interface StartingLineProps {
  plan: OnboardingPlan;
  api: UseProgressResult;
}

function StartingLine({ plan, api }: StartingLineProps) {
  const firstId = nextRecommendedScenarioId(api.progress, plan);
  const firstScenario = scenarioById(firstId);
  const rec = MODULE_REC[plan.startingModule];
  const quest = plan.sideQuestId
    ? sideQuests.find((entry) => entry.id === plan.sideQuestId)
    : undefined;

  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-startingline">
        <p className="taste-kicker taste-intro__kicker">Your starting line</p>
        <h1 className="taste-startingline__title">
          Here’s where you begin.
        </h1>
        <p className="taste-startingline__lede">
          Built from your answers. Nothing’s locked in — it just points you at the
          rep that’ll move the needle first.
        </p>

        <section className="taste-startingline__module" aria-label="Recommended module">
          <span className="taste-startingline__tag">Start in</span>
          <strong>{rec.name}</strong>
          <p>{rec.why}</p>
        </section>

        <section
          className="taste-startingline__block"
          aria-labelledby="priorities-title"
        >
          <h2 id="priorities-title">Two things to sharpen first</h2>
          <ol className="taste-startingline__priorities">
            {plan.skillPriorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ol>
        </section>

        <section
          className="taste-startingline__block"
          aria-labelledby="growth-title"
        >
          <h2 id="growth-title">Growth Direction</h2>
          <p className="taste-startingline__growth-intro">
            Two qualities worth building — not a verdict on you, just a direction
            that serves the life you’re after.
          </p>
          <div className="taste-startingline__growth-grid">
            {plan.growthDirections.map((direction) => (
              <article
                className="taste-startingline__growth"
                key={direction.quality}
              >
                <strong>{direction.quality}</strong>
                <p>{direction.whyItMatters}</p>
                <p className="taste-startingline__rep">
                  <span>First rep:</span> {direction.nextRep}
                </p>
              </article>
            ))}
          </div>
        </section>

        {quest ? <SideQuestCard quest={quest} /> : null}

        <div className="taste-startingline__actions">
          <Link
            className="taste-button taste-button--lime"
            to={`/practice/${firstId}`}
          >
            {firstScenario ? `Start: ${firstScenario.title}` : "Start practicing"}
            <ArrowRight size={18} weight="bold" />
          </Link>
          <Link className="taste-button taste-button--ghost" to="/practice">
            See the full curriculum
          </Link>
        </div>
      </div>
    </main>
  );
}
