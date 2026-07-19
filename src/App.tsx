"use client";

import { ArrowRight, Code, Sparkle } from "@phosphor-icons/react";
import { usePathname, useSearchParams } from "next/navigation";
import { BaselineExperience } from "./components/BaselineExperience";
import { TasteExperience } from "./components/TasteExperience";
import { CurriculumView } from "./components/product/CurriculumView";
import { LeaderboardView } from "./components/product/LeaderboardView";
import { NotFoundView } from "./components/product/NotFoundView";
import { OnboardingView } from "./components/product/OnboardingView";
import { PracticeView } from "./components/product/PracticeView";
import { ProgressView } from "./components/product/ProgressView";
import {
  AccountView,
  AuthCallbackView,
  LoginView,
  ResetPasswordView,
} from "./components/auth/AuthViews";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RizzCodeProvider, useRizzCode } from "./context/RizzCodeContext";
import { getScenario } from "./data/scenarios";
import { requiresLoginForScenario } from "./domain/guestAccess";
import { safeReturnPath } from "./lib/auth";

function DesignPicker() {
  return (
    <main className="picker">
      <div className="picker__glow" />
      <header className="picker__header">
        <a className="picker__brand" href="/" aria-label="RizzCode home">
          <span>RC</span>
          RIZZCODE
        </a>
        <p>Historical prototype comparison</p>
      </header>
      <section className="picker__intro">
        <p className="picker__eyebrow">The Taste direction won.</p>
        <h1>Two visual starting points. One shipped product.</h1>
        <p>
          Version A remains a historical control. Version B became the full
          RizzCode experience.
        </p>
      </section>
      <section className="picker__cards" aria-label="Design choices">
        <a className="picker-card picker-card--control" href="/control">
          <div className="picker-card__icon">
            <Code size={24} weight="bold" />
          </div>
          <div>
            <span>Historical Version A</span>
            <h2>Practice Console</h2>
            <p>Original control prototype retained as a visual reference.</p>
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
            <span>Production direction</span>
            <h2>RizzCode Taste</h2>
            <p>The editorial system extended across the complete MVP.</p>
          </div>
          <strong>
            Open RizzCode <ArrowRight size={18} />
          </strong>
        </a>
      </section>
    </main>
  );
}

function Routes() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = pathname.replace(/\/+$/, "") || "/";
  const auth = useAuth();
  const { progress } = useRizzCode();

  if (route === "/auth/callback") return <AuthCallbackView />;
  if (route === "/auth/reset") return <ResetPasswordView />;
  if (route === "/login") {
    if (auth.loading) {
      return (
        <main className="rizz-auth-loading" role="status">
          Opening RizzCode…
        </main>
      );
    }
    const returnTo = safeReturnPath(searchParams.get("returnTo"));
    return auth.user ? (
      <TasteExperience />
    ) : (
      <LoginView
        returnTo={returnTo}
        guestLimitReached={searchParams.get("reason") === "guest-limit"}
      />
    );
  }

  if (route === "/") return <TasteExperience />;
  if (route === "/onboarding") return <OnboardingView />;
  if (route === "/practice") return <CurriculumView />;
  if (route.startsWith("/practice/")) {
    let scenarioId: string | undefined;
    try {
      scenarioId = decodeURIComponent(route.slice("/practice/".length));
    } catch {
      scenarioId = undefined;
    }
    const scenario = scenarioId ? getScenario(scenarioId) : undefined;
    if (
      scenario &&
      auth.loading &&
      requiresLoginForScenario(progress, scenario.id, false)
    ) {
      return (
        <main className="rizz-auth-loading" role="status">
          Opening RizzCode…
        </main>
      );
    }
    if (
      scenario &&
      !auth.loading &&
      requiresLoginForScenario(progress, scenario.id, Boolean(auth.user))
    ) {
      return <LoginView returnTo={route} guestLimitReached />;
    }
    return scenario ? (
      <PracticeView scenario={scenario} />
    ) : (
      <CurriculumView notice="That scenario does not exist. Pick one from the canonical ten below." />
    );
  }
  if (route === "/progress") return <ProgressView />;
  if (route === "/leaderboard") return <LeaderboardView />;
  if (route === "/account") {
    if (auth.loading) {
      return (
        <main className="rizz-auth-loading" role="status">
          Opening RizzCode…
        </main>
      );
    }
    return auth.user ? <AccountView /> : <LoginView returnTo="/account" />;
  }
  if (route === "/control") return <BaselineExperience />;
  if (route === "/compare") return <DesignPicker />;
  return <NotFoundView />;
}

export function App() {
  return (
    <AuthProvider>
      <RizzCodeProvider>
        <Routes />
      </RizzCodeProvider>
    </AuthProvider>
  );
}
