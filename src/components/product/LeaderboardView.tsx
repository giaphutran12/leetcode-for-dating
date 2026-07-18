import { Crown, Trophy } from "@phosphor-icons/react";
import { useRizzCode } from "../../context/RizzCodeContext";
import { ProductShell } from "./ProductShell";

const seededPlayers = [
  { name: "CallbackCarlos", xp: 920, level: 4 },
  { name: "ReadsTheRoom", xp: 710, level: 3 },
  { name: "SpecificSam", xp: 480, level: 2 },
  { name: "GracefulGio", xp: 260, level: 2 },
  { name: "NoMoreHey", xp: 130, level: 1 },
];

export function LeaderboardView() {
  const { profile, progress } = useRizzCode();
  const players = [
    ...seededPlayers,
    {
      name: profile.displayName,
      xp: progress.publicXP,
      level: progress.level,
      local: true,
    },
  ].sort((a, b) => b.xp - a.xp);
  const localRank = players.findIndex((player) => "local" in player) + 1;

  return (
    <ProductShell eyebrow="Leaderboard" title="Climb the ranks.">
      <section className="rizz-rank-summary">
        <div>
          <span>Your position</span>
          <strong>#{localRank}</strong>
        </div>
        <div>
          <span>Practice XP</span>
          <strong>{progress.publicXP}</strong>
        </div>
        <div>
          <span>Level</span>
          <strong>{progress.level}</strong>
        </div>
      </section>

      <section className="rizz-leaderboard" aria-label="Leaderboard">
        <header>
          <span>Rank</span>
          <span>Player</span>
          <span>Level</span>
          <span>XP</span>
        </header>
        {players.map((player, index) => (
          <article
            data-local={"local" in player}
            key={player.name}
          >
            <strong>
              {index === 0 ? (
                <Crown size={20} weight="fill" aria-label="First place" />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </strong>
            <span>
              {"local" in player && <Trophy size={18} weight="fill" />}
              {player.name}
            </span>
            <span>LVL {player.level}</span>
            <strong>{player.xp}</strong>
          </article>
        ))}
      </section>
    </ProductShell>
  );
}
