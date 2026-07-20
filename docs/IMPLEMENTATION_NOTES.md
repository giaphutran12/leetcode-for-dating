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
text bubble and optional allowlisted emoji reactions. Each turn must identify
one primary move: reveal, tease, challenge, callback, pivot, or close. It must
also return an exact non-question excerpt from its text that proves it added a
new conversational handle. The server rejects repeated primary moves,
question-only replies, more than one question, and a question immediately
after another persona question. Authored fallback selection observes the same
question limit and alternates its move label.

Persona state tracks bounded energy, the three most recent moves, whether the
last persona turn asked a question, and up to four exact callback seeds copied
from user text. Engagement remains the interest signal, boundary state remains
monotonic, and engagement moves at most one level. This short-horizon policy is
part of the signed canonical conversation. It does not add Mastra or
cross-session agent memory.
Server-owned stop gates intercept blatant directed sexual pressure, coercion,
threats, and continued solicitation before persona generation. Those turns
receive a firm explicit boundary, close immediately, and cannot be rewarded by
model-generated flirting or continued logistics.
Provider failure records an authored fallback so the attempt remains playable.
The UI does not expose internal provider or fallback details to the learner.

The browser calls `POST /api/judge` with one to six contiguous user responses.
Judgment is available after turn three, at the six-turn cap, or after a persona,
user, or boundary exit.

The judge server:

1. Parses a strict request schema and rejects extra authority fields.
2. Loads the canonical scenario.
3. Requires an exact match with the server-owned adaptive conversation.
4. Calls the separate `gpt-5.6-luna` judge through Vercel AI SDK v6.
5. Requires atomic structured output through `generateText()` and
   `Output.object()`.
6. Verifies five unique criteria and exact user-turn excerpts.
7. Rejects malformed output and outcome codes unavailable to the scenario.
8. Lets the judge model classify safety from the full canonical transcript,
   without keyword lists or regex phrase matching.
9. Validates safety-field consistency and derives the score cap from the
   structured severity. A stop is enforced only when the model reports high
   confidence; lower-confidence stop classifications are reduced to a cap.
10. Forces model-classified stop-level transcripts to the server-owned `boundary_crossed`
   outcome even if the model proposes a more favorable outcome.
11. Leaves normal-language outcome classification to the judge model using the
    full canonical transcript. No keyword list or phrase matcher reclassifies it.
12. Recalculates raw score, caps, final score, and verdict.
13. Leaves XP calculation to the application domain.

The result surface keeps those receipts and calculations unchanged while
presenting the coaching in RizzCode's own voice. Labels stay literal and easy
to scan, including `What worked`, `What to improve`, and `A better response`.
The judge prompt asks for short sentences, common words, restrained Gen Z
slang inside the feedback, realistic replacement messages, no corporate or
therapist filler, and no jokes around boundary violations.

Before the provider call, the server claims a transcript-bound attempt ID in
`public.rizzcode_judgments`. Concurrent duplicates return a typed in-progress state.
A completed duplicate reuses the persisted, revalidated result without another model
call. Invalid output and terminal provider failures release the claim so explicit
retry can recover. See [JUDGE_RELIABILITY.md](JUDGE_RELIABILITY.md) for the acceptance
matrix and rollout order.

Neither provider has tools, browsing, memory, or client credential access. A
logical judgment operation performs one request and at most one transient
retry. An explicit UI retry starts a new operation over immutable responses.

Every committed persona turn and judge operation is also appended to
`public.rizzcode_conversation_events`. The row contains the complete canonical
transcript, persona state, model metadata, fallback status, and parsed
result/error details. Signed-in requests attach the verified Supabase user ID;
guest attempts remain anonymous. The table is RLS-protected and grants no
browser-role access. Idle prepared drafts are excluded because they were never
sent.

`judge.reused` distinguishes a cached idempotent recovery from a new provider
operation. Provider errors are classified by typed SDK/Zod errors and status codes,
not message-text guessing.

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

Profile, progress, attempts, practice activity, and private milestones use versioned
local storage.
Active canonical persona conversations use a six-hour signed receipt returned
after every completed turn. The receipt is verified server-side and restores
the exact transcript on another serverless instance. A bounded process-local
cache still deduplicates same-instance requests and can reuse an unseen
prepared draft, but cache loss is no longer a correctness failure.

`RIZZCODE_SESSION_SECRET` can provide a dedicated signing secret. If omitted,
the server derives a domain-separated signing key from `OPENAI_API_KEY`.
Neither secret is returned to or referenced by client code.

Completed judgment activity uses a separate attempt-ID ledger grouped by the local
calendar date captured at completion. Guest entries merge into a dedicated
RLS-protected Supabase table without double-counting and remain available across
signed-in devices.
See [PRACTICE_ACTIVITY.md](PRACTICE_ACTIVITY.md).

## Test boundary

Vitest covers domain rules, all 67 adaptive scenarios, persona preparation and
idempotency, stale-draft rejection, preparation cost caps, delivery-state
monotonicity, model-classified safety gates, exact evidence, server-owned arithmetic, outcome
acceptance, XP anti-farming, open scenario access, corrupt storage, storage
failure, mode-specific UI, onboarding skip, provider failure, malformed output,
signed-receipt tamper rejection, process-memory loss between turns, and the
acceptance anchors.

Playwright runs the full UI against the real Next.js route handler with mock
providers selected only in a non-production server process. Production ignores
`RIZZCODE_MOCK_PERSONA` and `RIZZCODE_MOCK_JUDGE`, so both production paths
remain configured LLM providers.

## Billing and guided-practice access

Stripe billing is documented in [STRIPE_BILLING.md](STRIPE_BILLING.md).
Checkout, portal sessions, Price selection, webhook verification, subscription
storage, and practice-credit claims are server-owned. Guests can complete one
practice before login. Authenticated free use is counted atomically when the
first AI generation starts for a new attempt, so retries of the same attempt do
not consume another credit.
