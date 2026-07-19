import {
  ArrowLeft,
  ArrowRight,
  ChartBar,
  ChatCircleDots,
  Check,
  CheckCircle,
  Clock,
  Code,
  Compass,
  Cross,
  GearSix,
  House,
  LockSimple,
  MapPin,
  PaperPlaneRight,
  Path,
  ArrowCounterClockwise,
  ShieldCheck,
  Target,
  UserCircle,
} from "@phosphor-icons/react";
import { curriculum, rubric, scenario } from "../data/prototype";
import { usePracticeSession } from "../hooks/usePracticeSession";
import "../styles/baseline.css";

const navigation = [
  { label: "Home", icon: House },
  { label: "Practice", icon: ChatCircleDots, active: true },
  { label: "Curriculum", icon: Path },
  { label: "Progress", icon: ChartBar },
];

export function BaselineExperience() {
  const {
    input,
    isScored,
    messages,
    reset,
    score,
    setInput,
    submit,
    userTurns,
  } = usePracticeSession();

  const completedTurns = Math.min(userTurns, 3);
  const progress = (completedTurns / 3) * 100;

  return (
    <div className="baseline-shell">
      <aside className="baseline-sidebar" aria-label="Primary navigation">
        <a className="baseline-brand" href="/compare" aria-label="RizzCode comparison">
          <span className="baseline-brand__mark" aria-hidden="true">
            <Code size={20} weight="bold" />
          </span>
          <span className="baseline-brand__name">RizzCode</span>
        </a>

        <nav className="baseline-nav">
          <p className="baseline-nav__label">Workspace</p>
          {navigation.map(({ active, icon: Icon, label }) => (
            <a
              className={`baseline-nav__item${active ? " is-active" : ""}`}
              href={active ? "#practice" : `#${label.toLowerCase()}`}
              aria-current={active ? "page" : undefined}
              key={label}
            >
              <Icon size={19} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="baseline-sidebar__footer">
          <div className="baseline-streak">
            <div className="baseline-streak__icon">
              <Cross size={17} weight="bold" />
            </div>
            <div>
              <strong>Practice with purpose</strong>
              <span>Charity before technique</span>
            </div>
          </div>
          <a className="baseline-nav__item" href="#settings">
            <GearSix size={19} />
            <span>Settings</span>
          </a>
          <button className="baseline-profile" type="button">
            <UserCircle size={30} weight="duotone" />
            <span>
              <strong>Edward</strong>
              <small>Level 6</small>
            </span>
          </button>
        </div>
      </aside>

      <main className="baseline-main" id="practice">
        <header className="baseline-topbar">
          <div className="baseline-topbar__scenario">
            <a href="/" aria-label="Back to design comparison">
              <ArrowLeft size={18} />
            </a>
            <div>
              <span>{scenario.id}</span>
              <strong>{scenario.title}</strong>
            </div>
          </div>

          <div
            className="baseline-turn-progress"
            aria-label={`${completedTurns} of 3 conversation turns complete`}
          >
            <div className="baseline-turn-progress__copy">
              <span>Conversation progress</span>
              <strong>{completedTurns} / 3 turns</strong>
            </div>
            <div
              className="baseline-turn-progress__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={completedTurns}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="baseline-version-links" aria-label="Prototype versions">
            <span className="baseline-version-links__current">Version A</span>
            <a href="/">
              View Version B
              <ArrowRight size={15} />
            </a>
          </div>
        </header>

        <div className="baseline-content">
          <section className="baseline-workspace" aria-labelledby="scenario-title">
            <div className="baseline-scenario">
              <div className="baseline-scenario__heading">
                <div>
                  <div className="baseline-kicker">
                    <Compass size={16} weight="fill" />
                    Active scenario
                  </div>
                  <h1 id="scenario-title">{scenario.title}</h1>
                </div>
                <span className="baseline-difficulty">{scenario.difficulty}</span>
              </div>

              <div className="baseline-meta">
                <span>
                  <MapPin size={16} />
                  {scenario.place}
                </span>
                <span>
                  <Clock size={16} />
                  {scenario.time}
                </span>
              </div>

              <p className="baseline-premise">{scenario.premise}</p>

              <div className="baseline-objective">
                <Target size={20} weight="duotone" />
                <div>
                  <span>Your objective</span>
                  <p>{scenario.objective}</p>
                </div>
              </div>

              <div className="baseline-context-grid">
                <div>
                  <h2>Context</h2>
                  <ul>
                    {scenario.context.map((item) => (
                      <li key={item}>
                        <Check size={14} weight="bold" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2>Practice boundaries</h2>
                  <ul>
                    {scenario.boundaries.map((item) => (
                      <li key={item}>
                        <ShieldCheck size={15} weight="duotone" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <section
              className="baseline-conversation"
              aria-labelledby="conversation-title"
            >
              <div className="baseline-panel-heading">
                <div>
                  <h2 id="conversation-title">Conversation</h2>
                  <span>Respond naturally. Clarity beats cleverness.</span>
                </div>
                <span className="baseline-panel-heading__status">
                  <span aria-hidden="true" />
                  {isScored ? "Session complete" : "Live practice"}
                </span>
              </div>

              <div
                className="baseline-messages"
                aria-live="polite"
                aria-label="Practice conversation"
              >
                {messages.map((message) => (
                  <article
                    className={`baseline-message baseline-message--${message.speaker}`}
                    key={message.id}
                  >
                    <div className="baseline-message__avatar" aria-hidden="true">
                      {message.speaker === "you" ? "ET" : "AM"}
                    </div>
                    <div className="baseline-message__content">
                      <span>{message.speaker === "you" ? "You" : "Anna"}</span>
                      <p>{message.body}</p>
                    </div>
                  </article>
                ))}
              </div>

              {isScored ? (
                <div className="baseline-complete">
                  <CheckCircle size={24} weight="fill" />
                  <div>
                    <strong>Practice complete</strong>
                    <p>Your rubric is ready. Review it, then run the scenario again.</p>
                  </div>
                  <button type="button" onClick={reset}>
                    <ArrowCounterClockwise size={17} />
                    Try again
                  </button>
                </div>
              ) : (
                <form className="baseline-composer" onSubmit={submit}>
                  <label htmlFor="baseline-reply">
                    Your response
                    <span>Turn {Math.min(userTurns + 1, 3)} of 3</span>
                  </label>
                  <textarea
                    id="baseline-reply"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Type what you would actually say..."
                    rows={3}
                    maxLength={280}
                  />
                  <div className="baseline-composer__footer">
                    <span>{input.length} / 280</span>
                    <button type="submit" disabled={!input.trim()}>
                      Send response
                      <PaperPlaneRight size={17} weight="fill" />
                    </button>
                  </div>
                </form>
              )}
            </section>
          </section>

          <aside className="baseline-insights" aria-label="Session insights">
            <section className="baseline-score-card" aria-labelledby="score-title">
              <div className="baseline-score-card__heading">
                <div>
                  <span>Rubric score</span>
                  <h2 id="score-title">
                    {isScored ? score : "Pending"}
                    {isScored && <small>/10</small>}
                  </h2>
                </div>
                <div
                  className={`baseline-score-ring${isScored ? " is-ready" : ""}`}
                  aria-hidden="true"
                >
                  {isScored ? score : "?"}
                </div>
              </div>

              {isScored ? (
                <div className="baseline-rubric">
                  {rubric.map((item) => (
                    <div className="baseline-rubric__item" key={item.label}>
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.score}</strong>
                      </div>
                      <div className="baseline-rubric__bar">
                        <span style={{ width: `${item.score * 10}%` }} />
                      </div>
                      <p>{item.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="baseline-score-pending">
                  <ChartBar size={28} weight="duotone" />
                  <p>
                    Complete all three turns to see feedback on respect,
                    curiosity, calibration, authenticity, and forward motion.
                  </p>
                </div>
              )}
            </section>

            <section className="baseline-curriculum" aria-labelledby="curriculum-title">
              <div className="baseline-panel-heading">
                <div>
                  <h2 id="curriculum-title">Your curriculum</h2>
                  <span>Level 6 · Foundations</span>
                </div>
                <strong>43%</strong>
              </div>
              <div className="baseline-curriculum__progress">
                <span />
              </div>

              <ol>
                {curriculum.map((item, index) => {
                  const isComplete = item.status === "Complete";
                  const isCurrent = item.status === "Current";

                  return (
                    <li
                      className={isCurrent ? "is-current" : undefined}
                      key={item.title}
                    >
                      <span className="baseline-curriculum__marker">
                        {isComplete ? (
                          <Check size={14} weight="bold" />
                        ) : item.status === "Locked" ? (
                          <LockSimple size={13} weight="fill" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      {isCurrent && <ArrowRight size={16} />}
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="baseline-comparison-link">
              <div>
                <span>Design comparison</span>
                <strong>See this scenario in Version B</strong>
              </div>
              <a href="/" aria-label="Open the selected RizzCode experience">
                <ArrowRight size={18} />
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
