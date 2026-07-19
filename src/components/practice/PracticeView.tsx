// Practice (plan: "Required product views" view 5 + "Three-turn state machine"
// UI). Exactly three user-authored turns over the injected session hook, with
// mode-correct input language, a live persona-thinking indicator, a full-card
// judging moment, and a transcript that survives a judge failure so nothing the
// user wrote is ever lost.

import { KeyboardEvent, useState } from "react";
import { ArrowRight, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { Scenario } from "../../domain/types";
import type { UsePracticeSessionResult } from "../../hooks/usePracticeSession";
import { modeLanguage } from "./modeLanguage";

interface PracticeViewProps {
  scenario: Scenario;
  session: UsePracticeSessionResult;
}

const MAX_LENGTH = 420;

// Warm, specific error copy per judge failure code (plan: "Error and failure
// behavior" — preserve the transcript, award no XP, offer Retry judgment).
const JUDGE_ERROR_COPY: Record<string, string> = {
  judge_unconfigured:
    "The judge isn’t wired up in this environment yet. Your transcript is safe — retry, and if it’s since been configured it’ll go through.",
  judge_timeout:
    "The judge took too long to call it. Your transcript is right here — give it another shot.",
  judge_rate_limited:
    "The judge is getting slammed right now. Hang tight a second, then retry.",
  judge_invalid_output:
    "The judge came back with something we couldn’t read. Nothing’s lost — retry the judgment.",
  judge_unavailable:
    "Couldn’t reach the judge. Your transcript’s intact — retry when you’re ready.",
};

const EARLY_EXIT_COPY: Record<string, string> = {
  boundary:
    "She closed it down — that crossed a line for her. We’ll still score the attempt.",
  user_exit: "You bowed out. Clean exits count too — scoring what you left on the table.",
  persona_exit: "She wrapped it up on her terms. Let’s see how the moment played.",
};

export function PracticeView({ scenario, session }: PracticeViewProps) {
  const mode = modeLanguage(scenario.mode);
  const [draft, setDraft] = useState("");

  const isSceneOnly = scenario.opening.kind === "scene_only";
  const composerBusy = session.personaThinking || session.judging;
  const canSubmit =
    session.status === "active" && !composerBusy && draft.trim().length > 0;

  function submit() {
    if (session.submitResponse(draft)) setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits; Shift+Enter inserts a newline. Keyboard-completable in both
    // modes, so nobody needs a mouse to finish a turn.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) submit();
    }
  }

  const showComposer =
    session.status === "active" && !session.judging && session.judgeError === null;

  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-practice">
        <div className="taste-practice__head">
          <Link className="taste-stage__back" to="/practice">
            ← Curriculum
          </Link>
          <span className="taste-badge" data-mode={scenario.mode}>
            {mode.badge}
          </span>
          <span className="taste-practice__turns" aria-live="polite">
            {session.userTurn} of 3
          </span>
        </div>

        <h1 className="taste-practice__title">{scenario.title}</h1>

        {isSceneOnly ? (
          <div className="taste-scene" role="note">
            <span>The scene</span>
            <p>{scenario.setting}</p>
            <p>{scenario.premise}</p>
            <p className="taste-scene__prompt">{mode.prompt}</p>
          </div>
        ) : null}

        <div
          className="taste-thread"
          aria-live="polite"
          aria-label="Practice conversation"
        >
          {session.messages.map((message) => (
            <div
              className={`taste-message taste-message--${message.speaker === "you" ? "you" : "her"}`}
              key={message.id}
            >
              <span>{message.speaker === "you" ? mode.youLabel : mode.herLabel}</span>
              <p>{message.body}</p>
            </div>
          ))}

          {session.personaThinking ? (
            <div className="taste-message taste-message--her taste-message--thinking">
              <span>{mode.herLabel}</span>
              <p aria-label={mode.thinking}>
                <span className="taste-typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {mode.thinking}
              </p>
            </div>
          ) : null}
        </div>

        {session.endedEarly ? (
          <p className="taste-practice__early" role="status">
            {EARLY_EXIT_COPY[session.endedEarly.reason]}
          </p>
        ) : null}

        {session.judging ? (
          <div className="taste-judging" role="status">
            <CircleNotch size={30} weight="bold" className="taste-judging__spin" />
            <strong>Scoring the posture behind your words…</strong>
            <p>Not the pickup line. The listening, the calibration, the courage.</p>
          </div>
        ) : null}

        {session.judgeError ? (
          <div className="taste-judge-error" role="alert">
            <div className="taste-judge-error__head">
              <WarningCircle size={22} weight="fill" aria-hidden="true" />
              <strong>Couldn’t score that one — yet</strong>
            </div>
            <p>
              {JUDGE_ERROR_COPY[session.judgeError.code] ?? session.judgeError.message}
            </p>
            <p className="taste-judge-error__safe">
              Your transcript is untouched. No score, no XP lost.
            </p>
            <div className="taste-judge-error__actions">
              {/* Every judge failure preserves the transcript and offers Retry
                  judgment — including judge_unconfigured and auth failures, since
                  config can change between attempts (plan decision 24). The API's
                  `retryable` flag describes transience, not whether the user may
                  try again; the button is always available, with "Practice again"
                  as an alternate reset rather than the only path. */}
              <button
                type="button"
                className="taste-button taste-button--lime"
                onClick={session.retryJudgment}
              >
                Retry judgment
              </button>
              <button
                type="button"
                className="taste-button taste-button--ghost"
                onClick={session.reset}
              >
                Practice again
              </button>
            </div>
          </div>
        ) : null}

        {showComposer ? (
          <form
            className="taste-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) submit();
            }}
          >
            <label htmlFor="practice-input">{mode.prompt}</label>
            <textarea
              id="practice-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              maxLength={MAX_LENGTH}
              placeholder={
                scenario.mode === "in_person"
                  ? "Say it like you'd actually say it out loud…"
                  : "Type it like a real text…"
              }
              disabled={composerBusy}
            />
            <div className="taste-composer__foot">
              <span aria-live="polite">
                {draft.length}/{MAX_LENGTH}
              </span>
              <button
                type="submit"
                className="taste-button taste-button--ink"
                disabled={!canSubmit}
              >
                {session.userTurn >= 2 ? "Send the last one" : "Send"}
                <ArrowRight size={17} weight="bold" />
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
