import { describe, expect, it } from "vitest";
import { demoLeaderboard } from "../data/demoLeaderboard";
import { defaultProgress } from "../storage/progressStore";
import { demoLeaderboardRows, LOCAL_PLAYER_ID } from "./leaderboard";
import type { Progress } from "./types";

describe("demoLeaderboardRows", () => {
  it("merges the player with seeded users and sorts by XP descending", () => {
    const progress: Progress = { ...defaultProgress(), publicXP: 900, level: 4 };
    const rows = demoLeaderboardRows(progress, "Ed");

    expect(rows).toHaveLength(demoLeaderboard.length + 1);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].xp).toBeGreaterThanOrEqual(rows[i].xp);
    }

    const player = rows.find((row) => row.isPlayer);
    expect(player).toBeDefined();
    expect(player?.id).toBe(LOCAL_PLAYER_ID);
    expect(player?.name).toBe("Ed");
    expect(player?.xp).toBe(900);
    // Player with 900 XP outranks the 860 and 620 seeds but not 1005+.
    const playerIndex = rows.findIndex((row) => row.isPlayer);
    expect(rows[playerIndex + 1].xp).toBe(860);
  });

  it("uses a friendly fallback name and derives level from XP", () => {
    const rows = demoLeaderboardRows({ ...defaultProgress(), publicXP: 250 }, "   ");
    const player = rows.find((row) => row.isPlayer);
    expect(player?.name).toBe("You");
    expect(player?.level).toBe(2); // floor(250/250)+1
  });

  it("shows a brand-new player at 0 XP without crashing", () => {
    const rows = demoLeaderboardRows(defaultProgress(), "Newbie");
    const player = rows.find((row) => row.isPlayer);
    expect(player?.xp).toBe(0);
    expect(player?.level).toBe(1);
  });
});
