// Seeded demo leaderboard (plan: "Gamification" — the leaderboard is seeded demo
// users plus the local player, and is visibly labeled "Demo"). These are
// fictional. XP values spread across levels 1-6 under level = floor(xp/250)+1.

export interface DemoLeaderboardUser {
  id: string;
  name: string;
  xp: number;
}

export const demoLeaderboard: DemoLeaderboardUser[] = [
  { id: "demo-smoothoperator", name: "SmoothOperator", xp: 1420 }, // level 6
  { id: "demo-textgame", name: "TextGameStrong", xp: 1180 }, // level 5
  { id: "demo-carlos", name: "Carlos the Calm", xp: 1005 }, // level 5
  { id: "demo-readtheroom", name: "ReadsTheRoom", xp: 860 }, // level 4
  { id: "demo-dev", name: "DevWhoTouchesGrass", xp: 620 }, // level 3
  { id: "demo-omar", name: "Omar, Actually Listening", xp: 540 }, // level 3
  { id: "demo-firsttry", name: "FirstTryFumble", xp: 330 }, // level 2
  { id: "demo-newhere", name: "NewHereBeNice", xp: 190 }, // level 1
  { id: "demo-justshowedup", name: "JustShowedUp", xp: 60 }, // level 1
];
