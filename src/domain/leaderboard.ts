// Demo leaderboard rows (plan: "Gamification" — "seeded demo users plus the
// local player", "app-verified practice XP only", labeled Demo). Pure: merges
// the seeded fictional users with the local player and sorts by practice XP
// descending. The player's XP is progress.publicXP — never milestones. No I/O.

import { demoLeaderboard } from "../data/demoLeaderboard";
import type { Progress } from "./types";
import { levelFor } from "./xp";

export interface LeaderboardRow {
  id: string;
  name: string;
  xp: number;
  level: number;
  isPlayer: boolean;
}

export const LOCAL_PLAYER_ID = "local-player";

export function demoLeaderboardRows(
  progress: Progress,
  displayName: string,
): LeaderboardRow[] {
  const player: LeaderboardRow = {
    id: LOCAL_PLAYER_ID,
    name: displayName.trim() || "You",
    xp: progress.publicXP,
    level: levelFor(progress.publicXP),
    isPlayer: true,
  };

  const seeded: LeaderboardRow[] = demoLeaderboard.map((user) => ({
    id: user.id,
    name: user.name,
    xp: user.xp,
    level: levelFor(user.xp),
    isPlayer: false,
  }));

  // Descending by XP. On a tie, surface the player above the demo crowd so a
  // new player at 0 XP still sees themselves clearly.
  return [...seeded, player].sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    if (a.isPlayer) return -1;
    if (b.isPlayer) return 1;
    return 0;
  });
}
