import { ArrowRight, Code, Sparkle } from "@phosphor-icons/react";
import { BaselineExperience } from "./components/BaselineExperience";
import { TasteExperience } from "./components/TasteExperience";

function DesignPicker() {
  return (
    <main className="picker">
      <div className="picker__glow" />
      <header className="picker__header">
        <a className="picker__brand" href="/" aria-label="RizzCode home">
          <span>RC</span>
          RIZZCODE
        </a>
        <p>Prototype comparison</p>
      </header>

      <section className="picker__intro">
        <p className="picker__eyebrow">Same product. Two design systems.</p>
        <h1>Which interface makes you want to practice?</h1>
        <p>
          Both versions use the same scenario, scoring model, and three-turn
          interaction. Pick on clarity, feeling, and whether you would come back
          tomorrow.
        </p>
      </section>

      <section className="picker__cards" aria-label="Design choices">
        <a className="picker-card picker-card--control" href="/control">
          <div className="picker-card__icon">
            <Code size={24} weight="bold" />
          </div>
          <div>
            <span>Version A</span>
            <h2>Practice Console</h2>
            <p>
              Dense, familiar, and built like the developer tools you already
              know.
            </p>
          </div>
          <strong>
            Open control <ArrowRight size={18} />
          </strong>
        </a>

        <a className="picker-card picker-card--taste" href="/">
          <div className="picker-card__icon">
            <Sparkle size={24} weight="fill" />
          </div>
          <div>
            <span>Version B</span>
            <h2>Intentional Practice</h2>
            <p>
              Editorial, cinematic, and designed to make practice feel human.
            </p>
          </div>
          <strong>
            Open Taste version <ArrowRight size={18} />
          </strong>
        </a>
      </section>
    </main>
  );
}

export function App() {
  const route = window.location.pathname.replace(/\/+$/, "") || "/";

  if (route === "/control") {
    return <BaselineExperience />;
  }

  if (route === "/compare") {
    return <DesignPicker />;
  }

  return <TasteExperience />;
}
