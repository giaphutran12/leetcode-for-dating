// Demo leaderboard (plan: "Required product views" view 8 + "Gamification").
// Seeded fictional players plus the local player, sorted by app-verified
// practice XP only. Explicitly labeled a demo — there is no real global ranking
// yet, and private real-world milestones never count here. Readable at 375px
// with no horizontal scroll: each row stacks name over its meta.

import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { demoLeaderboardRows } from "../../domain/leaderboard";
import { useProgress, type UseProgressResult } from "../../hooks/useProgress";

interface LeaderboardViewProps {
  // Injectable for tests; production reads the real hook.
  progress?: UseProgressResult;
}

export function LeaderboardView({ progress: injected }: LeaderboardViewProps) {
  const real = useProgress();
  const api = injected ?? real;
  const rows = demoLeaderboardRows(api.progress, api.profile.displayName);

  return (
    <main className="taste-page taste-leaderboard">
      <header className="taste-nav">
        <Link className="taste-nav__brand" to="/" aria-label="RizzCode home">
          <span aria-hidden="true">RC</span>
          <strong>RizzCode</strong>
        </Link>
        <nav aria-label="RizzCode navigation">
          <Link to="/">Home</Link>
          <Link to="/practice">Practice</Link>
          <Link to="/progress">Progress</Link>
        </nav>
        <Link className="taste-nav__switch" to="/practice">
          Climb the board
          <ArrowRight size={17} weight="bold" />
        </Link>
      </header>

      <section className="taste-leaderboard__head" aria-labelledby="board-title">
        <p className="taste-kicker">Demo leaderboard</p>
        <h1 id="board-title">Where you stand.</h1>
        <p className="taste-leaderboard__note">
          Seeded demo players plus you. Practice XP only — real global ranking
          comes later, and your private real-world wins never count here.
        </p>
      </section>

      <ol className="taste-board" aria-label="Demo leaderboard standings">
        {rows.map((row, index) => (
          <li
            className="taste-board__row"
            data-player={row.isPlayer || undefined}
            key={row.id}
          >
            <span className="taste-board__rank">{index + 1}</span>
            <span className="taste-board__name">
              {row.name}
              {row.isPlayer ? (
                <span className="taste-board__you">you</span>
              ) : null}
            </span>
            <span className="taste-board__level">Lvl {row.level}</span>
            <span className="taste-board__xp">
              {row.xp}
              <small>XP</small>
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
