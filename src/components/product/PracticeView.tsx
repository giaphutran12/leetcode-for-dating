import { useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Lightning,
  MapPin,
  PaperPlaneRight,
  ShieldWarning,
  Sparkle,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRizzCode } from "../../context/RizzCodeContext";
import { CRITERION_LABELS } from "../../domain/constants";
import {
  MAX_CONVERSATION_TURNS,
  MIN_CONVERSATION_TURNS,
} from "../../domain/constants";
import { nextPracticeScenario } from "../../domain/progression";
import type { JudgeResult, Scenario } from "../../domain/types";
import { useRizzPracticeSession } from "../../hooks/useRizzPracticeSession";
import {
  DifficultyBadge,
  ModeBadge,
  ProductShell,
} from "./ProductShell";

type Receipt = {
  xpDelta: number;
  isPersonalBest: boolean;
  unlockedAchievements: string[];
};

function ResultView({
  scenario,
  result,
  receipt,
  retry,
}: {
  scenario: Scenario;
  result: JudgeResult;
  receipt?: Receipt;
  retry: () => void;
}) {
  const { profile, progress } = useRizzCode();
  const next = nextPracticeScenario(progress, profile);
  return (
    <section
      className="rizz-result"
      data-verdict={result.verdict.toLowerCase()}
      aria-labelledby="result-title"
    >
      <header className="rizz-result__hero">
        <div>
          <p className="rizz-kicker">Official LLM judgment</p>
          <h2 id="result-title">{result.verdict}</h2>
          <p>
            {result.verdict === "ATE"
              ? "That had a pulse. Specific, calibrated, and actually fun."
              : result.verdict === "COOKED"
                ? "There is a real thread here. A little less autopilot and you are dangerous."
                : "The moment got away from you. Good news: this is exactly why the rep exists."}
          </p>
        </div>
        <div className="rizz-score-disc">
          <strong>{result.finalScore}</strong>
          <span>out of 10</span>
        </div>
      </header>

      {result.hardGate.triggered && (
        <aside className="rizz-gate" data-severity={result.hardGate.severity}>
          <ShieldWarning size={26} weight="fill" />
          <div>
            <strong>
              {result.hardGate.severity === "stop"
                ? "Stop-level boundary"
                : "Score capped at 4"}
            </strong>
            {result.hardGate.evidence.map((evidence) => (
              <p key={`${evidence.turn}-${evidence.excerpt}`}>
                “{evidence.excerpt}” {evidence.reason}
              </p>
            ))}
          </div>
        </aside>
      )}

      <div className="rizz-result__grid">
        <section className="rizz-rubric" aria-label="Five-part rubric">
          <h3>Five-part rubric</h3>
          {result.rubric.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{CRITERION_LABELS[item.id]}</strong>
                <span>{item.score}/2</span>
              </div>
              <div
                className="rizz-rubric__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={2}
                aria-valuenow={item.score}
                aria-label={`${CRITERION_LABELS[item.id]} score`}
              >
                <span style={{ width: `${item.score * 50}%` }} />
              </div>
              <blockquote>“{item.evidence.excerpt}”</blockquote>
              <p>{item.feedback}</p>
            </article>
          ))}
        </section>

        <div className="rizz-coaching">
          <article>
            <h3>What worked</h3>
            <ul>
              {result.worked.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>What to improve</h3>
            <ul>
              {result.improve.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rizz-better-response">
            <h3>A stronger response</h3>
            <p>“{result.betterResponse}”</p>
          </article>
          <article className="rizz-outcome">
            <span>Likely simulated outcome</span>
            <h3>{result.outcome.label}</h3>
            <p>
              {result.outcome.basis[0]?.reason} Confidence:{" "}
              {result.outcome.confidence}.
            </p>
          </article>
        </div>
      </div>

      <footer className="rizz-result__footer">
        <div>
          <Lightning size={24} weight="fill" />
          <span>
            <strong>+{receipt?.xpDelta ?? 0} practice XP</strong>
            {receipt?.isPersonalBest
              ? "New personal best."
              : "Only improvement earns more mastery XP."}
          </span>
        </div>
        {receipt?.unlockedAchievements.map((achievement) => (
          <span className="rizz-achievement-pop" key={achievement}>
            <Sparkle size={17} weight="fill" />
            {achievement} unlocked
          </span>
        ))}
        <div className="rizz-result__actions">
          <button type="button" onClick={retry}>
            <ArrowCounterClockwise size={18} />
            Retry scenario
          </button>
          <a href={`/practice/${next.id}`}>
            Next challenge
            <ArrowRight size={18} />
          </a>
        </div>
      </footer>
    </section>
  );
}

export function PracticeView({ scenario }: { scenario: Scenario }) {
  const { profile, progress } = useRizzCode();
  const [started, setStarted] = useState(false);
  const session = useRizzPracticeSession(scenario);
  const { attempt } = session;

  if (!started) {
    return (
      <ProductShell
        eyebrow={`${scenario.module} · scenario briefing`}
        title={scenario.title}
        actions={
          <a className="rizz-text-button" href="/practice">
            <ArrowLeft size={18} />
            Curriculum
          </a>
        }
      >
        <section className="rizz-briefing">
          <div className="rizz-briefing__scene">
            <div className="rizz-badges">
              <ModeBadge mode={scenario.mode} />
              <DifficultyBadge difficulty={scenario.difficulty} />
            </div>
            <p>{scenario.premise}</p>
            <div>
              <span>
                <MapPin size={18} />
                {scenario.setting}
              </span>
              <span>
                <Clock size={18} />
                3–6 adaptive turns
              </span>
            </div>
          </div>
          <div className="rizz-briefing__details">
            <article>
              <Target size={24} weight="duotone" />
              <h2>Your objective</h2>
              <p>{scenario.objective}</p>
            </article>
            <article>
              <CheckCircle size={24} weight="duotone" />
              <h2>What you can observe</h2>
              <ul>
                {scenario.visibleContext.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <ShieldWarning size={24} weight="duotone" />
              <h2>Boundaries</h2>
              <ul>
                {scenario.boundaries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <Sparkle size={24} weight="duotone" />
              <h2>Tips for this rep</h2>
              <ul>
                {scenario.tips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
          <button
            className="rizz-primary-button"
            type="button"
            onClick={() => setStarted(true)}
          >
            Start conversation
            <ArrowRight size={19} weight="bold" />
          </button>
        </section>
      </ProductShell>
    );
  }

  if (attempt.status === "complete" && attempt.result) {
    return (
      <ProductShell
        eyebrow={`${scenario.module} · result`}
        title={scenario.title}
      >
        <ResultView
          scenario={scenario}
          result={attempt.result}
          receipt={session.receipt}
          retry={session.reset}
        />
      </ProductShell>
    );
  }

  const prompt =
    scenario.mode === "in_person"
      ? "What would you say?"
      : "What would you text?";
  const speakerLabel = (speaker: "you" | "her") => {
    if (scenario.mode === "in_person") {
      return speaker === "you" ? "You say" : `${scenario.persona.name} says`;
    }
    return speaker === "you" ? "You" : scenario.persona.name;
  };
  const personaError = attempt.error?.code.startsWith("persona_") ?? false;
  const canRetryError = attempt.error?.retryable !== false;

  return (
    <ProductShell
      eyebrow={`${scenario.module} · live practice`}
      title={scenario.title}
      actions={
        <button className="rizz-text-button" type="button" onClick={session.reset}>
          <ArrowCounterClockwise size={18} />
          Reset attempt
        </button>
      }
    >
      <section className="rizz-practice">
        <aside className="rizz-practice__context">
          <div className="rizz-badges">
            <ModeBadge mode={scenario.mode} />
            <DifficultyBadge difficulty={scenario.difficulty} />
          </div>
          <p>{scenario.premise}</p>
          <div className="rizz-objective">
            <Target size={20} />
            <span>
              <strong>Objective</strong>
              {scenario.objective}
            </span>
          </div>
          <div
            className="rizz-turn-meter"
            aria-label={`${attempt.userTurn} of ${MAX_CONVERSATION_TURNS} possible turns complete`}
          >
            <div>
              <span>Conversation progress</span>
              <strong>
                {attempt.userTurn} / {MAX_CONVERSATION_TURNS}
              </strong>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={MAX_CONVERSATION_TURNS}
              aria-valuenow={attempt.userTurn}
            >
              <span
                style={{
                  width: `${(attempt.userTurn / MAX_CONVERSATION_TURNS) * 100}%`,
                }}
              />
            </div>
            <small>
              Judge anytime after {MIN_CONVERSATION_TURNS} turns
            </small>
          </div>
        </aside>

        <section className="rizz-chat" aria-labelledby="chat-title">
          <header>
            <div>
              <span>Adaptive AI persona</span>
              <h2 id="chat-title">{scenario.persona.name}</h2>
            </div>
            <span className="rizz-live-dot">
              <i aria-hidden="true" />
              {attempt.status === "awaiting_judgment"
                ? "Judging"
                : session.isPersonaTyping
                  ? "Typing"
                  : attempt.status === "awaiting_reply"
                    ? "Sent"
                    : "Your turn"}
            </span>
          </header>

          <div
            className="rizz-messages"
            aria-live="polite"
            aria-label="Practice conversation"
          >
            {scenario.opening.kind === "scene_only" &&
              attempt.messages.length === 0 && (
                <div className="rizz-scene-prompt">
                  <MapPin size={20} />
                  <p>{scenario.premise}</p>
                </div>
              )}
            {attempt.messages.map((message) => (
              <article
                className={`rizz-message rizz-message--${message.speaker} rizz-message--${message.kind}`}
                key={message.id}
              >
                <span>{speakerLabel(message.speaker)}</span>
                <p>{message.body}</p>
                {scenario.mode === "messaging" &&
                  message.speaker === "you" &&
                  message.deliveryStatus && (
                    <small
                      className="rizz-message__status"
                      aria-label={`Message ${message.deliveryStatus}`}
                    >
                      {message.deliveryStatus}
                    </small>
                  )}
              </article>
            ))}
            {session.isPersonaTyping && (
              <div className="rizz-thinking" role="status">
                <i />
                <i />
                <i />
                {scenario.persona.name} is typing…
              </div>
            )}
            {attempt.status === "awaiting_judgment" && (
              <div className="rizz-judging" role="status">
                <Sparkle size={20} weight="fill" />
                The judge is reading the canonical conversation and checking the receipts…
              </div>
            )}
          </div>

          {session.fallbackNotice && (
            <p className="rizz-inline-notice" role="status">
              {session.fallbackNotice}
            </p>
          )}

          {attempt.status === "error" ? (
            <div className="rizz-judge-error" role="alert">
              <WarningCircle size={26} weight="fill" />
              <div>
                <strong>
                  {personaError
                    ? "Reaction did not land."
                    : "Judgment did not land."}
                </strong>
                <p>{attempt.error?.message}</p>
                <span>
                  {personaError && canRetryError
                    ? "Your line is preserved. Retry the same turn or reset."
                    : personaError
                      ? "This conversation fell out of sync. Reset the attempt to continue."
                    : "No score or XP was awarded. Your transcript is preserved."}
                </span>
              </div>
              {canRetryError && (
                <button
                  type="button"
                  onClick={
                    personaError
                      ? session.retryPersona
                      : session.retryJudgment
                  }
                >
                  {personaError ? "Retry reaction" : "Retry judgment"}
                </button>
              )}
            </div>
          ) : (
            <form className="rizz-composer" onSubmit={session.submit}>
              <label htmlFor="practice-response">{prompt}</label>
              <textarea
                id="practice-response"
                value={session.input}
                onChange={(event) => session.setInput(event.target.value)}
                rows={4}
                maxLength={420}
                disabled={session.isBusy}
                placeholder={
                  scenario.mode === "in_person"
                    ? "Type the brief line you would actually say…"
                    : "Type the message you would actually send…"
                }
              />
              <div>
                <span
                  className={session.inputError ? "rizz-input-error" : undefined}
                  role={session.inputError ? "alert" : undefined}
                >
                  {session.inputError ?? `${session.input.length}/420`}
                </span>
                <div className="rizz-composer__actions">
                  {session.canEnd && (
                    <button
                      className="rizz-end-button"
                      type="button"
                      onClick={session.endConversation}
                    >
                      End &amp; get judgment
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={session.isBusy || !session.input.trim()}
                  >
                    {attempt.userTurn === MAX_CONVERSATION_TURNS - 1
                      ? "Send final turn"
                      : "Send response"}
                    <PaperPlaneRight size={18} weight="fill" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </section>
    </ProductShell>
  );
}
