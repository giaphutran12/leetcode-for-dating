import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  ShieldCheck,
  Sparkle,
  Target,
} from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRizzCode } from "../context/RizzCodeContext";
import { useAuth } from "../context/AuthContext";
import { nextPracticeScenario } from "../domain/progression";
import { modules, scenarios } from "../data/scenarios";
import "../styles/taste.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const accordionStories = [
  {
    title: "Open with presence",
    copy: "Notice what is already true in the moment. A delayed bus or cursed projector is enough material.",
    image: "https://picsum.photos/seed/open-source-demo-table/1200/1500",
  },
  {
    title: "Follow the thread",
    copy: "Ask one thing you actually care about, then let her answer change what you say next.",
    image: "https://picsum.photos/seed/quiet-cafe-conversation/1200/1500",
  },
  {
    title: "Invite with clarity",
    copy: "When the energy is mutual, make a real plan with an easy exit. Clean. Human. No chess match.",
    image: "https://picsum.photos/seed/courtyard-coffee-invitation/1200/1500",
  },
];

const marqueePhrases = [
  "Fun is the game",
  "Respect is the floor",
  "Specific beats generic",
  "Read the room",
];

export function TasteExperience() {
  const pageRef = useRef<HTMLElement>(null);
  const [activeAccordion, setActiveAccordion] = useState(0);
  const { profile, progress } = useRizzCode();
  const auth = useAuth();
  const featured = scenarios[1];
  const next = nextPracticeScenario(progress, profile);
  const startHref = !auth.user
    ? `/practice/${scenarios[0].id}`
    : profile.onboardingComplete
      ? `/practice/${next.id}`
      : "/onboarding";

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.utils.toArray<HTMLElement>(".taste-reveal-image").forEach((image) => {
        gsap.fromTo(
          image,
          { scale: 0.9, opacity: 0.5 },
          {
            scale: 1,
            opacity: 1,
            scrollTrigger: { trigger: image, start: "top 90%" },
            duration: 0.7,
          },
        );
      });
    },
    { scope: pageRef },
  );

  return (
    <main ref={pageRef} className="taste-page">
      <header className="taste-nav">
        <a className="taste-nav__brand" href="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </a>
        <nav aria-label="RizzCode navigation">
          <a href="#approach">How it works</a>
          <a href="/practice">Curriculum</a>
          <a href="/progress">Progress</a>
          <a href="/leaderboard">Leaderboard</a>
        </nav>
        <a className="taste-nav__switch" href={startHref}>
          {auth.user && profile.onboardingComplete ? "Next rep" : "Try a rep"}
          <ArrowUpRight size={17} weight="bold" />
        </a>
      </header>

      <section className="taste-hero" aria-labelledby="taste-hero-title">
        <div className="taste-hero__wash" aria-hidden="true" />
        <div className="taste-hero__copy">
          <p className="taste-kicker">Dating practice without the weird tactics</p>
          <h1 id="taste-hero-title">
            <span>Stop rehearsing.</span>
            <span>Start getting</span>
            <span className="taste-hero__intent">good reps.</span>
          </h1>
          <p className="taste-hero__lede">
            RizzCode is LeetCode for grounded social fluency. Three turns,
            realistic reactions, specific feedback, and enough personality to
            make practice worth coming back to.
          </p>
          <div className="taste-hero__actions">
            <a className="taste-button taste-button--ink" href={startHref}>
              {auth.user && profile.onboardingComplete
                ? "Run the next scenario"
                : "Try the first scenario"}
              <ArrowRight size={19} weight="bold" />
            </a>
            <a className="taste-button taste-button--quiet" href="#approach">
              See the loop
            </a>
          </div>
        </div>

        <figure className="taste-hero__figure">
          <div className="taste-hero__image-wrap">
            <img
              className="taste-hero__image"
              src="https://picsum.photos/seed/open-source-social-evening/1500/1800"
              alt="People talking at a warm evening community gathering"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
          <figcaption>
            <div>
              <span>Featured rep</span>
              <strong>{featured.title}</strong>
            </div>
            <p>3 turns · {featured.difficulty}</p>
          </figcaption>
        </figure>
      </section>

      <section
        id="approach"
        className="taste-interest"
        aria-labelledby="taste-interest-title"
      >
        <div className="taste-section-heading">
          <p className="taste-kicker">Build the skill, not a fake persona</p>
          <h2 id="taste-interest-title">
            A gym for the{" "}
            <span
              className="taste-inline-image taste-inline-image--books"
              aria-hidden="true"
            />{" "}
            moments you overthink.
          </h2>
          <p>
            Both spoken and text scenarios react to your actual words. The
            judge cites your exact lines, so the feedback cannot hide behind
            vague coaching fog.
          </p>
        </div>

        <div className="taste-bento">
          <article className="taste-bento__card taste-bento__card--scenario">
            <div className="taste-card-heading">
              <Target size={25} weight="duotone" />
              <span>67 playable situations</span>
            </div>
            <div>
              <h3>Spark gets attention. Connection keeps it real.</h3>
              <p>
                Openers, callbacks, invitations, repairs, dry replies, and the
                underrated art of leaving gracefully.
              </p>
            </div>
            <ul>
              <li>In Person</li>
              <li>Messaging</li>
              <li>Three authored turns</li>
            </ul>
          </article>

          <article className="taste-bento__card taste-bento__card--image">
            <img
              className="taste-reveal-image"
              src="https://picsum.photos/seed/vietnamese-literature-table/1200/1400"
              alt="Books and notes arranged on a café table"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div>
              <BookOpen size={24} weight="duotone" />
              <p>
                Learn to use what is actually happening instead of deploying a
                memorized line from another planet.
              </p>
            </div>
          </article>

          <article className="taste-bento__card taste-bento__card--principle">
            <Sparkle size={27} weight="duotone" />
            <h3>Safe is not the same as interesting.</h3>
            <p>Warmth, humor, personality, and a little nerve all count.</p>
          </article>

          <article className="taste-bento__card taste-bento__card--character">
            <ShieldCheck size={27} weight="duotone" />
            <h3>Respect stays non-negotiable.</h3>
            <p>
              Confidence does not rescue pressure, deception, insults, or a
              refusal you decided not to hear.
            </p>
          </article>

          <article className="taste-bento__card taste-bento__card--progress">
            <div className="taste-card-heading">
              <CheckCircle size={25} weight="duotone" />
              <span>Practice that compounds</span>
            </div>
            <h3>XP rewards mastery, not spam.</h3>
            <div className="taste-mini-curriculum">
              {modules.map((module) => (
                <div key={module.id}>
                  <span>{module.name}</span>
                  <p>{module.eyebrow}</p>
                </div>
              ))}
              <div>
                <span>Level {progress.level}</span>
                <p>{progress.publicXP} app-verified practice XP</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="taste-accordion-section" aria-label="Practice method">
        <div className="taste-accordion">
          {accordionStories.map((story, index) => {
            const active = activeAccordion === index;
            return (
              <button
                className="taste-accordion__panel"
                data-active={active}
                key={story.title}
                type="button"
                aria-pressed={active}
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

      <section className="taste-desire" aria-labelledby="taste-modules-title">
        <div className="taste-desire__grid">
          <div className="taste-desire__narrative">
            <p className="taste-kicker">Two connected tracks</p>
            <h2 id="taste-modules-title">Getting the spark is chapter one.</h2>
            <p>
              RizzCode also trains the less cinematic stuff that makes a real
              relationship possible: listening, follow-up, planning, repair,
              and accepting a mismatch without turning it into a trial.
            </p>
          </div>
          <div className="taste-desire__practice">
            {modules.map((module) => (
              <article
                className="taste-practice-card taste-practice-card--context"
                key={module.id}
              >
                <div className="taste-practice-card__topline">
                  <span>{module.name} module</span>
                  <strong>
                    {scenarios.filter((item) => item.module === module.id).length} reps
                  </strong>
                </div>
                <h3>{module.eyebrow}</h3>
                <p>{module.description}</p>
              </article>
            ))}
            <a className="taste-button taste-button--lime" href={startHref}>
              Build my practice path
              <ArrowRight size={20} weight="bold" />
            </a>
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
            More game.
          </h2>
          <a className="taste-button taste-button--lime" href={startHref}>
            Start the first rep
            <ArrowRight size={20} weight="bold" />
          </a>
        </div>
        <div className="taste-footer__bottom">
          <a className="taste-nav__brand" href="/" aria-label="RizzCode home">
            <span aria-hidden="true">RC</span>
            <strong>RizzCode</strong>
          </a>
          <p>Grounded social fluency for men who want something real.</p>
          <div>
            <a href="/practice">Practice</a>
            <a href="/progress">Progress</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
