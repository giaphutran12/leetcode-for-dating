// @vitest-environment node
//
// Acceptance item 25: no MVP path invokes voice, avatar, TinyFish, Supabase, or
// message sending. This is a scope guard, not a behavior test — it fails loudly if
// a deferred integration is ever pulled into the shipping surface (dependencies or
// application source), which is exactly the regression the plan wants blocked.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

// Runtime integrations the MVP explicitly defers. Matched case-insensitively.
const FORBIDDEN = [
  "supabase",
  "tinyfish",
  "twilio",
  "elevenlabs",
  "@11labs",
  "livekit",
  "ready-player-me",
  "readyplayerme",
];

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("MVP scope (acceptance 25)", () => {
  it("declares no deferred voice/avatar/backend/messaging runtime dependency", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const deps = Object.keys(pkg.dependencies ?? {}).join(" ").toLowerCase();
    for (const term of FORBIDDEN) {
      expect(deps).not.toContain(term);
    }
  });

  it("does not import a deferred integration anywhere in application source", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, "src"))) {
      const text = readFileSync(file, "utf-8").toLowerCase();
      for (const term of FORBIDDEN) {
        if (text.includes(term)) offenders.push(`${file} -> ${term}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
