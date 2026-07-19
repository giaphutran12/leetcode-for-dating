import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Heart,
  ShieldCheck,
  Target,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { curriculum, rubric, scenario } from "../data/prototype";
import { usePracticeSession } from "../hooks/usePracticeSession";
import "../styles/taste.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const accordionStories = [
  {
    title: "Open with presence",
    copy: "Notice what is already true in the moment. A shared table is enough reason to begin.",
    image: "https://picsum.photos/seed/open-source-demo-table/1200/1500",
  },
  {
    title: "Follow the thread",
    copy: "Ask one question you genuinely want answered, then let her response change the conversation.",
    image: "https://picsum.photos/seed/quiet-cafe-conversation/1200/1500",
  },
  {
    title: "Invite with clarity",
    copy: "When interest feels mutual, make a specific, low-pressure invitation that leaves room for an honest answer.",
    image: "https://picsum.photos/seed/courtyard-coffee-invitation/1200/1500",
  },
];

const marqueePhrases = [
  "Respect before performance",
  "Curiosity without tactics",
  "Clarity without pressure",
  "Confidence with character",
];

export function TasteExperience() {
  const pageRef = useRef<HTMLElement>(null);
  const desireRef = useRef<HTMLElement>(null);
  const [activeAccordion, setActiveAccordion] = useState(0);
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

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(min-width: 960px)", () => {
        ScrollTrigger.create({
          trigger: desireRef.current,
          start: "top top+=112",
          end: "bottom bottom-=80",
          pin: ".taste-desire__narrative",
          pinSpacing: false,
        });
      });

      gsap.utils
        .toArray<HTMLElement>(".taste-reveal-image")
        .forEach((image) => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: image,
                start: "top 92%",
                end: "bottom 8%",
                scrub: 0.7,
              },
            })
            .fromTo(
              image,
              { scale: 0.82, opacity: 0.42 },
              { scale: 1, opacity: 1, ease: "none", duration: 0.55 },
            )
            .to(image, {
              scale: 1.055,
              opacity: 0.2,
              ease: "none",
              duration: 0.45,
            });
        });

      return () => media.revert();
    },
    { scope: pageRef },
  );

  const progress = `${Math.min(userTurns, 3) * 33.333}%`;

  return (
    <main ref={pageRef} className="taste-page">
      <header className="taste-nav">
        <a className="taste-nav__brand" href="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </a>
        <nav aria-label="RizzCode navigation">
          <a href="#approach">Approach</a>
          <a href="#practice">Practice</a>
          <a href="#curriculum">Curriculum</a>
        </nav>
        <a className="taste-nav__switch" href="#practice">
          Start practice
          <ArrowUpRight size={17} weight="bold" />
        </a>
      </header>

      <section className="taste-hero" aria-labelledby="taste-hero-title">
        <div className="taste-hero__wash" aria-hidden="true" />
        <div className="taste-hero__copy">
          <p className="taste-kicker">Relationship practice for men</p>
          <h1 id="taste-hero-title">
            <span>Practice courage.</span>
            <span>Meet someone</span>
            <span className="taste-hero__intent">with intention.</span>
          </h1>
          <p className="taste-hero__lede">
            RizzCode helps men rehearse honest conversations, read reciprocity,
            and make respectful invitations without scripts, games, or
            pretending to be someone else.
          </p>
          <div className="taste-hero__actions">
            <a className="taste-button taste-button--ink" href="#practice">
              Enter the scenario
              <ArrowRight size={19} weight="bold" />
            </a>
            <a className="taste-button taste-button--quiet" href="#approach">
              See how practice works
            </a>
          </div>
        </div>

        <figure className="taste-hero__figure">
          <div className="taste-hero__image-wrap">
            <img
              className="taste-hero__image"
              src="https://picsum.photos/seed/open-source-social-evening/1500/1800"
              alt="A warm evening gathering with space for a thoughtful conversation"
            />
          </div>
          <figcaption>
            <div>
              <span>Tonight’s scenario</span>
              <strong>{scenario.title}</strong>
            </div>
            <p>{scenario.place}</p>
          </figcaption>
        </figure>
      </section>

      <section
        id="approach"
        className="taste-interest"
        aria-labelledby="taste-interest-title"
      >
        <div className="taste-section-heading">
          <p className="taste-kicker">Build relational fluency</p>
          <h2 id="taste-interest-title">
            The soft skills behind{" "}
            <span
              className="taste-inline-image taste-inline-image--books"
              aria-hidden="true"
            />{" "}
            a brave first move.
          </h2>
          <p>
            Practice the whole moment: what you notice, how you listen, and
            whether your invitation honors the person in front of you.
          </p>
        </div>

        <div className="taste-bento">
          <article className="taste-bento__card taste-bento__card--scenario">
            <div className="taste-card-heading">
              <Target size={25} weight="duotone" />
              <span>Practice in context</span>
            </div>
            <div>
              <h3>{scenario.title}</h3>
              <p>{scenario.premise}</p>
            </div>
            <ul>
              {scenario.context.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="taste-bento__card taste-bento__card--image">
            <img
              className="taste-reveal-image"
              src="https://picsum.photos/seed/vietnamese-literature-table/1200/1400"
              alt="Books and notes arranged for an attentive conversation"
            />
            <div>
              <BookOpen size={24} weight="duotone" />
              <p>
                Learn to follow what matters to her, not the line you planned
                before the conversation began.
              </p>
            </div>
          </article>

          <article className="taste-bento__card taste-bento__card--principle">
            <ShieldCheck size={27} weight="duotone" />
            <h3>Never a tactic.</h3>
            <p>
              Respect, consent, and an honest exit are part of every scenario,
              not fine print after the lesson.
            </p>
          </article>

          <article className="taste-bento__card taste-bento__card--character">
            <Heart size={27} weight="duotone" />
            <h3>Character shapes the posture.</h3>
            <p>
              Good dating starts with dignity, honesty, and the self-control to
              choose clarity over pressure.
            </p>
          </article>

          <article className="taste-bento__card taste-bento__card--progress">
            <div className="taste-card-heading">
              <CheckCircle size={25} weight="duotone" />
              <span>Practice that compounds</span>
            </div>
            <h3>One honest rep at a time.</h3>
            <div className="taste-mini-curriculum">
              {curriculum.slice(0, 3).map((lesson) => (
                <div key={lesson.title}>
                  <span>{lesson.status}</span>
                  <p>{lesson.title}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="taste-accordion-section" aria-label="Practice method">
        <div className="taste-accordion">
          {accordionStories.map((story, index) => {
            const isActive = activeAccordion === index;

            return (
              <button
                className="taste-accordion__panel"
                data-active={isActive}
                key={story.title}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveAccordion(index)}
                onMouseEnter={() => setActiveAccordion(index)}
                onFocus={() => setActiveAccordion(index)}
              >
                <img src={story.image} alt="" />
                <span className="taste-accordion__shade" />
                <span className="taste-accordion__content">
                  <strong>{story.title}</strong>
                  <span className="taste-accordion__copy">{story.copy}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="taste-marquee" aria-label="RizzCode principles">
        <div className="taste-marquee__track">
          {[...marqueePhrases, ...marqueePhrases].map((phrase, index) => (
            <span key={`${phrase}-${index}`}>
              {phrase}
              <span aria-hidden="true">+</span>
            </span>
          ))}
        </div>
      </div>

      <section
        ref={desireRef}
        id="practice"
        className="taste-desire"
        aria-labelledby="taste-practice-title"
      >
        <div className="taste-desire__grid">
          <div className="taste-desire__narrative">
            <p className="taste-kicker">Try the whole moment</p>
            <h2 id="taste-practice-title">
              You do not need a perfect line.
            </h2>
            <p>
              You need enough calm to listen, enough courage to be clear, and
              enough humility to receive her answer. Take three turns. RizzCode
              will score the posture behind your words.
            </p>
            <div className="taste-desire__progress">
              <div>
                <span>Conversation progress</span>
                <strong>{Math.min(userTurns, 3)} of 3 turns</strong>
              </div>
              <div className="taste-progress-track" aria-hidden="true">
                <span style={{ width: progress }} />
              </div>
            </div>
          </div>

          <div className="taste-desire__practice">
            <article className="taste-practice-card taste-practice-card--context">
              <div className="taste-practice-card__topline">
                <span>Scenario context</span>
                <strong>{scenario.difficulty}</strong>
              </div>
              <h3>{scenario.title}</h3>
              <p>{scenario.objective}</p>
              <div className="taste-context-list">
                {scenario.boundaries.map((boundary) => (
                  <span key={boundary}>
                    <CheckCircle size={17} weight="fill" />
                    {boundary}
                  </span>
                ))}
              </div>
            </article>

            <article className="taste-practice-card taste-practice-card--conversation">
              <div className="taste-practice-card__topline">
                <span>Live practice</span>
                <strong>{isScored ? "Complete" : scenario.time}</strong>
              </div>

              <div
                className="taste-conversation"
                aria-live="polite"
                aria-label="Practice conversation"
              >
                {messages.map((message) => (
                  <div
                    className={`taste-message taste-message--${message.speaker}`}
                    key={message.id}
                  >
                    <span>{message.speaker === "you" ? "You" : "Her"}</span>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>

              {!isScored ? (
                <form className="taste-response" onSubmit={submit}>
                  <label htmlFor="taste-response-input">
                    Your next response
                  </label>
                  <textarea
                    id="taste-response-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={4}
                    maxLength={420}
                  />
                  <div>
                    <span>{input.length}/420</span>
                    <button type="submit" disabled={!input.trim()}>
                      {userTurns >= 2 ? "Finish and score" : "Send response"}
                      <ArrowRight size={18} weight="bold" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="taste-complete">
                  <CheckCircle size={25} weight="fill" />
                  <div>
                    <strong>Practice complete</strong>
                    <span>Your rubric is ready below.</span>
                  </div>
                  <button type="button" onClick={reset}>
                    Practice again
                  </button>
                </div>
              )}
            </article>

            <article className="taste-practice-card taste-practice-card--rubric">
              <div className="taste-score">
                <span>Conversation score</span>
                <strong>{isScored ? score : "Pending"}</strong>
                <p>
                  {isScored
                    ? "Warm, specific, and grounded. Keep the invitation low-pressure."
                    : "Complete all three turns to reveal your score."}
                </p>
              </div>
              <div className="taste-rubric-list">
                {rubric.map((item) => (
                  <div className="taste-rubric-item" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{isScored ? `${item.score}/10` : "Pending"}</span>
                    </div>
                    <div className="taste-rubric-track" aria-hidden="true">
                      <span
                        style={{
                          width: isScored ? `${item.score * 10}%` : "0%",
                        }}
                      />
                    </div>
                    <p>{isScored ? item.note : "Measured after completion."}</p>
                  </div>
                ))}
              </div>
            </article>

            <article
              id="curriculum"
              className="taste-practice-card taste-practice-card--curriculum"
            >
              <div className="taste-practice-card__topline">
                <span>Your curriculum</span>
                <strong>Foundations</strong>
              </div>
              <div className="taste-curriculum-list">
                {curriculum.map((lesson, index) => (
                  <div
                    className="taste-curriculum-item"
                    data-status={lesson.status.toLowerCase()}
                    key={lesson.title}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{lesson.title}</strong>
                      <p>{lesson.detail}</p>
                    </div>
                    <em>{lesson.status}</em>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <footer className="taste-footer">
        <div className="taste-footer__ambient" aria-hidden="true" />
        <div className="taste-footer__copy">
          <p>Practice for the relationship you actually want.</p>
          <h2>
            Less performance.
            <br />
            More courage.
          </h2>
          <a className="taste-button taste-button--lime" href="#practice">
            Begin the conversation
            <ArrowRight size={20} weight="bold" />
          </a>
        </div>
        <div className="taste-footer__bottom">
          <a className="taste-nav__brand" href="/" aria-label="RizzCode home">
            <span aria-hidden="true">RC</span>
            <strong>RizzCode</strong>
          </a>
          <p>Respectful relationship practice for men who want something real.</p>
          <div>
            <a href="#approach">Approach</a>
            <a href="#practice">Practice</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
