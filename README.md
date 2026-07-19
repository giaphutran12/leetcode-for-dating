# RizzCode

RizzCode is LeetCode-style conversation practice for men who want respectful,
intentional relationships. Each of ten scenarios drops you into a realistic
social or messaging moment, gives you three turns to build a genuine
connection with a deterministic persona, and scores the attempt with a
server-side LLM judge — five rubric criteria, evidence-cited feedback, a
likely simulated outcome, and XP toward the next level. No hookup coaching,
no manipulation, no pressure tactics: honesty, self-control, and a
considerate next step are the standard the scoring is built on.

## Quickstart

```bash
npm install
cp .env.example .env.local   # then fill in OPENAI_API_KEY
npm run dev
```

Open the local URL Vite prints (`http://127.0.0.1:4173`). The judge route
(`/api/judge`) reads `OPENAI_API_KEY` server-side only — it is never bundled
or exposed to the browser. `RIZZCODE_JUDGE_MODEL` is optional and defaults to
`gpt-5.4-mini` when unset. See `.env.example` for both variables; never commit a
real key.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 4173, with the judge API plugin live |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Typecheck only |
| `npm run test` | Unit + integration tests (Vitest). Judge calls are mocked at the server boundary — never touches OpenAI |
| `npm run test:e2e` | Playwright against a dedicated dev server on port 4174 with the judge mocked (`RIZZCODE_JUDGE_MOCK=1`) |
| `npm run test:judge:live` | Opt-in live smoke test against the real provider (`RIZZCODE_LIVE_JUDGE=1`, requires `OPENAI_API_KEY`) |
| — | `RIZZCODE_LIVE_JUDGE=1 npx vitest run src/server/judge/live.acceptance.test.ts` — opt-in judge-quality acceptance bands (also real provider, not run by `test` or CI) |

## Architecture

- **`src/domain/`** — pure, framework-free rules: scoring, hard gates, XP,
  progression, leaderboard, onboarding. No I/O, no randomness.
- **`src/data/`** — the ten authored scenarios, achievements, side quests, and
  the seeded demo leaderboard.
- **`src/engine/deterministic/`** — the canonical persona conversation core
  (signal matching, state transitions, transcript replay). Shared verbatim by
  the client hook and the server judge so persona behavior never diverges
  between what the user sees and what gets judged.
- **`src/server/judge/`** + **`server/judgeApiPlugin.ts`** — the `/api/judge`
  route: builds the prompt, calls the model via the Vercel AI SDK
  (`ai` + `@ai-sdk/openai`), applies deterministic hard gates, validates the
  model's draft against the real transcript, and recomputes score/XP
  server-side so the client can never supply its own. The Vite plugin wires
  this route into `dev`/`preview` and swaps in a mock model under
  `RIZZCODE_JUDGE_MOCK=1` for e2e.
- **`src/hooks/`** — `usePracticeSession` (turn-by-turn session state,
  judging, retry) and `useProgress` (XP/level/streak/milestones over
  storage).
- **`src/storage/`** — versioned localStorage records (`rizzcode.v1.profile`,
  `rizzcode.v1.progress`, `rizzcode.v1.attempts`, `rizzcode.v1.milestones`),
  with safe fallback to in-memory storage when localStorage is unavailable.
- **`src/components/`** — the product views: onboarding, curriculum,
  scenario/practice flow, result, progress, and leaderboard.
- **Routes** (`src/App.tsx`): `/` landing, `/onboarding`, `/practice`
  (curriculum), `/practice/:scenarioId` (a scenario attempt), `/progress`,
  `/leaderboard`, plus `/control` and `/compare` — historical prototype
  screens kept for design reference, not part of the product flow.

## Notes

- The judge is the **only** LLM-backed path in the app. The persona you talk
  to during practice is fully deterministic by design — same input, same
  reply, every time — so practice is reproducible and free to run.
- The leaderboard is a local-only demo: your local practice XP merged with
  seeded fictional players, explicitly labeled `Demo`. There is no real
  global ranking.
- `/api/judge` is served by Vite middleware (`server/judgeApiPlugin.ts`) in
  `dev` and `preview`. Deploying `dist/` to static hosting alone would leave
  every attempt in a retryable `judge_unavailable` state — port the route to
  a serverless function (same handler, `src/server/judge/route.ts`) before
  any real deploy.
- `/control` and `/compare` are historical prototypes from the design
  comparison that shaped the current experience — not part of the supported
  product surface.
- [`docs/RIZZCODE_MASTER_PLAN.md`](docs/RIZZCODE_MASTER_PLAN.md) is the
  product source of truth. [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md) is the
  acceptance matrix mapping every required fixture to the test that verifies
  it.
