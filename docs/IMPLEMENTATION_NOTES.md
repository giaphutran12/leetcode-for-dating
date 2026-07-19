# RizzCode MVP implementation notes

This document describes the Next.js migration of the GPT comparison build on
`codex/rizzcode-nextjs`. The canonical behavior remains
[RIZZCODE_MASTER_PLAN.md](RIZZCODE_MASTER_PLAN.md).

## Persona and judge integrity

The browser sends bounded scenario ID, attempt ID, turn, and user text to
`POST /api/persona`. The server owns the canonical transcript and rejects
changed duplicates, skipped turns, terminal mutations, and attempts that cross
scenario identities.

Production persona generation uses Vercel AI SDK v6, the direct OpenAI
provider, Zod, `generateText()`, and `Output.object()`. `gpt-5.4-nano` is the
default low-latency persona model. Structured actions require at least one short
text bubble and optional allowlisted emoji reactions. The prompt requests at
most one question. Boundary state is monotonic and engagement moves at most one
level.
Provider failure records a visible authored fallback instead of pretending the
model replied.

The browser calls `POST /api/judge` with one to six contiguous user responses.
Judgment is available after turn three, at the six-turn cap, or after a persona,
user, or boundary exit.

The judge server:

1. Parses a strict request schema and rejects extra authority fields.
2. Loads the canonical scenario.
3. Requires an exact match with the server-owned adaptive conversation.
4. Detects hard gates before the provider call.
5. Calls the separate `gpt-5.4` judge through Vercel AI SDK v6.
6. Requires atomic structured output through `generateText()` and
   `Output.object()`.
7. Verifies five unique criteria and exact user-turn excerpts.
8. Rejects unsupported outcome claims.
9. Confirms contact and date agreement match the persona's actual reply.
10. Recalculates raw score, caps, final score, and verdict.
11. Leaves XP calculation to the application domain.

Neither provider has tools, browsing, memory, or client credential access. A
logical judgment operation performs one request and at most one transient
retry. An explicit UI retry starts a new operation over immutable responses.

## Practice state and races

Normal practice repeats the middle loop from three through six turns:

```text
active
  -> awaiting_reply
  -> active
  -> awaiting_reply
  -> active
  -> end for judgment | continue to turn six
  -> awaiting_judgment
  -> complete | error
```

The first accepted response is turn one. Submit is guarded synchronously before
the network operation, so a double click cannot append twice. Persona requests
are idempotent by scenario, attempt, turn, and body. Reset changes both the
attempt ID and operation token, which discards stale persona or judge results.
A completed attempt rejects further submissions.

## Messaging realism

Messaging drafts use a five-second inactivity debounce. The server may prepare
one reply without committing the turn. An exact later send reuses that prepared
reply; an edited message generates from the edited body. Preparation is capped
at three generations per turn to bound provider cost. The preparation response
contains acknowledgment metadata only; persona text stays server-side until
Send.

Only an explicit send creates the user message. Its visible status then moves
forward monotonically through `sent`, `delivered`, and `seen`. The persona
typing indicator covers both idle preparation latency and the post-seen reply
delay. In-person scenarios do not display messaging delivery states.

## Progress authority

Mastery XP is:

```text
finalScore * 10 + difficultyBonus
```

Only improvement beyond the prior scenario mastery value is added. The first
valid completion adds ten XP. Stop-level results add zero XP. All 67 scenarios
are intentionally available from the first visit; completion still powers
progress, best scores, and the recommended next rep. Rewarded attempt IDs
prevent duplicate XP when judgment is retried.

Private milestones are stored in a separate record and never enter the XP or
demo leaderboard calculation.

## Persistence boundary

Profile, progress, attempts, and private milestones use versioned local storage.
Active canonical persona conversations use a six-hour signed receipt returned
after every completed turn. The receipt is verified server-side and restores
the exact transcript on another serverless instance. A bounded process-local
cache still deduplicates same-instance requests and can reuse an unseen
prepared draft, but cache loss is no longer a correctness failure.

`RIZZCODE_SESSION_SECRET` can provide a dedicated signing secret. If omitted,
the server derives a domain-separated signing key from `OPENAI_API_KEY`.
Neither secret is returned to or referenced by client code.

## Test boundary

Vitest covers domain rules, all 67 adaptive scenarios, persona preparation and
idempotency, stale-draft rejection, preparation cost caps, delivery-state
monotonicity, hard gates, exact evidence, server-owned arithmetic, outcome
acceptance, XP anti-farming, open scenario access, corrupt storage, storage
failure, mode-specific UI, onboarding skip, provider failure, malformed output,
signed-receipt tamper rejection, process-memory loss between turns, and the
acceptance anchors.

Playwright runs the full UI against the real Next.js route handler with mock
providers selected only in a non-production server process. Production ignores
`RIZZCODE_MOCK_PERSONA` and `RIZZCODE_MOCK_JUDGE`, so both production paths
remain configured LLM providers.
