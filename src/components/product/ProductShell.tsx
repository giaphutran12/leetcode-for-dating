import type { PropsWithChildren, ReactNode } from "react";
import {
  ChartBar,
  Fire,
  House,
  ListBullets,
  UserCircle,
  Trophy,
  X,
} from "@phosphor-icons/react";
import { useRizzCode } from "../../context/RizzCodeContext";
import { useAuth } from "../../context/AuthContext";
import "../../styles/product.css";

export function ProductShell({
  children,
  eyebrow,
  title,
  actions,
}: PropsWithChildren<{
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
}>) {
  const { progress, storageWarning, dismissWarning } = useRizzCode();
  const auth = useAuth();

  return (
    <main className="rizz-product">
      <header className="rizz-nav">
        <a className="rizz-brand" href="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </a>
        <nav aria-label="Main navigation">
          <a href="/">
            <House size={18} />
            <span>Home</span>
          </a>
          <a href="/practice">
            <ListBullets size={18} />
            <span>Practice</span>
          </a>
          <a href="/progress">
            <ChartBar size={18} />
            <span>Progress</span>
          </a>
          <a href="/leaderboard">
            <Trophy size={18} />
            <span>Ranks</span>
          </a>
          <a href="/account">
            <UserCircle size={18} />
            <span>{auth.user ? "Account" : "Log in"}</span>
          </a>
        </nav>
        <div className="rizz-nav__stats" aria-label="Current progress">
          <span>
            <Fire size={17} weight="fill" />
            {progress.streak}
          </span>
          <strong>LVL {progress.level}</strong>
          <span>{progress.publicXP} XP</span>
        </div>
      </header>

      {storageWarning && (
        <div className="rizz-warning" role="status">
          <span>{storageWarning}</span>
          <button
            type="button"
            onClick={dismissWarning}
            aria-label="Dismiss storage warning"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {(title || eyebrow || actions) && (
        <header className="rizz-page-heading">
          <div>
            {eyebrow && <p className="rizz-kicker">{eyebrow}</p>}
            {title && <h1>{title}</h1>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </main>
  );
}

export function ModeBadge({
  mode,
}: {
  mode: "in_person" | "messaging";
}) {
  return (
    <span className="rizz-mode" data-mode={mode}>
      {mode === "in_person" ? "In Person" : "Messaging"}
    </span>
  );
}

export function DifficultyBadge({
  difficulty,
}: {
  difficulty: "easy" | "medium" | "hard";
}) {
  return <span className="rizz-difficulty">{difficulty}</span>;
}
