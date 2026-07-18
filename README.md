# RizzCode

RizzCode is LeetCode-style practice for dating and grounded social fluency. This
GPT comparison build implements the approved MVP contract in
[docs/RIZZCODE_MASTER_PLAN.md](docs/RIZZCODE_MASTER_PLAN.md) while preserving
the Taste visual direction.

## What is implemented

- Four-question onboarding, skip path, personalized starting module, two skill
  priorities, Growth Direction, and one optional Side Quest
- Spark and Connection curriculum with all 67 scenarios available immediately
- Exactly 67 playable In Person and Messaging scenarios from the closed catalog
- Three to six user-authored turns, with earlier persona or boundary exits
- Server-side adaptive persona reactions using `gpt-5-nano` by default
- Messaging draft preparation after five idle seconds, plus Sent, Delivered,
  Seen, and persona typing states
- Server-only LLM judge using Vercel AI SDK v6, `@ai-sdk/openai`, Zod,
  `generateText()`, and `Output.object()`
- Five evidence-backed rubric criteria, deterministic gates and arithmetic, and
  FUMBLED, COOKED, or ATE verdicts
- Likely simulated outcomes, improved-response coaching, XP, levels, streaks,
  personal bests, achievements, and recommended next reps
- Demo leaderboard choice A using practice XP only
- Private self-reported real-world milestones that add zero public XP
- Versioned local persistence, isolated corrupt-record recovery, storage
  warnings, judge retry, unknown-route handling, and authored persona fallback
- Responsive and keyboard-usable product views at mobile, tablet, and desktop
  sizes, with reduced-motion support
- Supabase email/password accounts with signup, login, logout, password
  recovery, guarded product routes, and self-service account deletion

The historical `/control` and `/compare` prototype routes remain available as
visual references. They are not the production product path.

## Combined Next.js and 67-problem build

The `codex/rizzcode-nextjs-67` branch combines the shipped Next.js build with
the closed catalog supplied in `RIZZCODE_67_PROBLEMS_GITHUB_SPEC (1).md`.
`src/data/scenarios/catalog.ts` is an exact mechanical copy of that catalog. A
small adapter makes all 67 canonical `RC-001` through `RC-067` problems
available to the curriculum, briefing, adaptive persona, fallback, judge, and
progress flow. The list shows the global problem number and tested skills, and
the briefing shows the scenario-specific tips.

This catalog integration does not claim to implement the supplied document's
separate signed-session V2 API, per-turn coaching object, or seven server-only
interaction-profile prompts. Those are a distinct runtime migration, not part
of adding the closed catalog to the current product.

## Run locally

Install dependencies:

```bash
npm install
```

Create a private `.env.local` in this worktree:

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY` inside `.env.local`. Add the Supabase project URL,
publishable key, server-only secret key, and local site URL:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:4173
```

The publishable key is intentionally browser-visible. `SUPABASE_SECRET_KEY`
must remain server-only and is used only by `DELETE /api/account`. Never give
it a `NEXT_PUBLIC_` prefix.

In Supabase Auth URL Configuration, add the deployed and local recovery
destinations:

```text
https://rizzcode-nextjs.vercel.app/auth/callback
https://rizzcode-nextjs.vercel.app/auth/reset
http://127.0.0.1:4173/**
```

For production email delivery, configure custom SMTP in Supabase. The built-in
mailer is rate-limited and intended for initial testing.

The optional
`RIZZCODE_PERSONA_MODEL` defaults to `gpt-5-nano`; the separate
`RIZZCODE_JUDGE_MODEL` defaults to `gpt-5.4`.

Then run:

```bash
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

To use the existing ignored environment file in the original checkout without
copying it:

```bash
set -a
source /Users/edwardtran/side-projects/leetcode-for-dating/.env.local
set +a
npm run dev
```

The shell loads that file for the process only. It never prints or sends the key
to the browser. Without a server-side key, persona turns use labeled authored
fallbacks, while official judgment remains unscored and offers `Retry
judgment`.

## Verification

```bash
npm run test
npm run test:e2e
npm run check
npm run build
```

The Playwright suite starts the server with server-boundary mock persona and
judge providers. It checks the full first-visit flow, bounded adaptive turns,
double-submit prevention, open scenario access, idle draft preparation,
Sent/Delivered/Seen states, persistence after refresh, Messaging mode, unknown
routes, judge failure, and 375px, 768px, and 1440px layouts.

An opt-in live provider smoke test is available:

```bash
RIZZCODE_ENV_FILE=/absolute/path/to/.env.local npm run test:live-judge
```

It prints only pass or failure metadata, never the credential or transcript.

## Runtime architecture

- Next.js 16 App Router serves the product through
  `src/app/[[...slug]]/page.tsx`.
- `src/app/api/[...path]/route.ts` owns `POST /api/persona/prepare`,
  `POST /api/persona`, and `POST /api/judge` in one Node route module. Each
  endpoint verifies the caller's Supabase access token before invoking a model.
- `src/app/api/account/route.ts` verifies the caller's Supabase access token
  before deleting that exact user with the server-only secret key.
- `src/context/AuthContext.tsx` owns browser session restoration and auth
  actions. `/auth/callback` exchanges confirmation codes and `/auth/reset`
  exchanges recovery codes before accepting a new password.
- `server/persona/` owns prompt-safe adaptive generation, draft preparation,
  idempotency, authored fallback, and the bounded canonical conversation store.
- `server/runtime.ts` selects production or non-production test providers
  without exposing environment variables to the client.
- `server/judge/provider.ts` is the only production provider path.
- `server/judge/service.ts` requires the server-owned conversation, runs hard
  gates, invokes the separate judge provider, validates evidence and outcomes,
  recalculates scores, applies caps, and derives the verdict.
- `src/engine/conversationEngine.ts` owns client-visible attempt transitions,
  action rendering, delivery states, and authored fallback behavior.
- `src/domain/` owns pure scoring, XP, onboarding, validation, and next-rep
  logic.
- `src/storage/stores.ts` owns the four versioned local records.

Browser requests contain the scenario ID, attempt ID, contiguous turn, bounded
user text, and an opaque signed conversation receipt after the first turn. The
receipt lets any Vercel instance verify and restore the canonical transcript
without trusting client-authored state. In Messaging mode, a draft is sent for
reply preparation only after five seconds without keyboard input; it does not
advance the canonical turn. Client-supplied persona replies, scores, XP, gates,
outcomes, and leaderboard values are rejected.

## Local persistence

The MVP stores no secrets and uses only:

- `rizzcode.v1.profile`
- `rizzcode.v1.progress`
- `rizzcode.v1.attempts`
- `rizzcode.v1.milestones`

At most 100 attempts are retained. A malformed record resets only itself. If
storage is unavailable, practice continues in memory with a visible warning.
Canonical active conversation state travels in a six-hour, tamper-resistant
server-signed receipt. The process-local cache improves idempotency and draft
preparation latency, but it is not required for turn-to-turn correctness across
serverless instances.

## Deliberately outside this MVP

TinyFish, profile scraping, voice, avatars, video, live humans, automated
messages, Elo ratings, a real global leaderboard, course infrastructure,
attractiveness scoring, therapy, and attachment diagnosis are not included.
