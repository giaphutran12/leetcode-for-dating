# RizzCode Adaptive Persona Plan

Status: APPROVED by Edward on 2026-07-18

## Problem

The shipped comparison MVP used authored persona reactions. Those reactions were fast
and reproducible, but they did not follow conversational causality. A user could ask a
direct question and receive the next scenario line instead of an answer. That makes the
experience feel like an NPC dialogue tree rather than practice with a believable person.

## Product decision

Keep authored scenario openings, objectives, boundaries, and fallback lines. Replace
normal persona reactions with a server-side LLM persona that responds to the canonical
conversation so far.

A normal practice conversation is bounded:

- At least three user turns before the user may request judgment.
- At most six user turns.
- The persona can end earlier for an exit, refusal, or boundary.
- One persona turn may contain one to three short actions, such as text bubbles or an
  emoji reaction.
- The final judge remains a separate LLM operation and never grades the persona's hidden
  reasoning.

## Server authority

`POST /api/persona` accepts only:

- schema version
- attempt ID
- scenario ID
- contiguous user turn number
- bounded user text

The server owns a canonical conversation record keyed by attempt ID. It validates
scenario identity, turn order, duplicate submissions, persona state transitions, and
terminal state. Repeating the same attempt, turn, and body returns the same stored
reaction. Reusing a turn with different text is rejected.

Messaging mode also exposes `POST /api/persona/prepare`. After five seconds
without keyboard activity, the browser may send the current bounded draft for
reply preparation. Preparation never advances the canonical turn. An exact
later send reuses the prepared result; edited text cannot consume a stale
result. Preparation is capped at three generations per turn.
The preparation response contains no persona text.

The browser never authors authoritative persona replies or persona state for the
judge. After each completed persona turn, the server returns a six-hour signed
conversation receipt. `POST /api/persona` and `POST /api/judge` verify that
receipt before restoring or judging the canonical transcript. Tampering,
cross-attempt reuse, skipped turns, and expired receipts are rejected.

The bounded process-local store remains only as an idempotency and draft
preparation cache. Losing that cache can cause an unseen prepared draft to be
generated again, but it cannot erase or alter a completed signed conversation.

## Persona generation

Production generation uses Vercel AI SDK v6 with:

- `ai`
- `@ai-sdk/openai`
- Zod
- `generateText()`
- `Output.object()`
- the direct OpenAI provider

The default persona model is `gpt-5.4-nano` with minimal reasoning and low text
verbosity for the fastest supported structured reaction path. It is configurable with
`RIZZCODE_PERSONA_MODEL`. `OPENAI_API_KEY` remains server-only.

The model receives:

- fictional persona traits, goal, and constraints
- scenario premise, observable context, and boundaries
- canonical transcript
- current engagement and boundary state
- the new user message as delimited untrusted conversation data

It returns one structured reaction. The server validates and normalizes:

- one to three actions
- plain chat text only, with strict length limits
- allowed emoji reactions
- engagement changes of at most one level
- monotonic boundary state
- terminal reason

The model cannot award XP, choose a judge score, reveal prompts, add unsupported facts,
or force a successful outcome.

## Failure behavior

If the persona provider is missing, times out, rate limits, or returns invalid output,
the server records the authored scenario fallback as the canonical reaction and returns
`usedFallback: true`. The UI labels that specific reaction as a fallback. The attempt
remains playable.

Judge failure behavior is unchanged: the transcript remains visible and retryable, no
score is official, and no XP is awarded.

## Client experience

- Replace “Deterministic persona” with “Adaptive AI persona.”
- Show the user's message immediately while the persona is thinking.
- In Messaging mode, move sent user bubbles monotonically through Sent,
  Delivered, and Seen before revealing the reply.
- Show persona typing while an idle draft is being prepared and after the sent
  message is seen.
- Render one to three persona actions in order with bounded pacing.
- Support emoji-reaction actions without external media URLs.
- Show “End & get judgment” after turn three.
- Automatically judge after a persona exit or turn six.
- Keep submit disabled during the persona operation.
- Reset invalidates stale client operations and starts a new attempt ID.
- Preserve `aria-live`, keyboard behavior, visible errors, mobile containment, and
  reduced-motion behavior.

## Judge integrity

The judge:

- reads the server-owned persona transcript
- cites exact excerpts only from user turns
- preserves the five-part rubric and deterministic arithmetic
- keeps hard-gate detection server-side
- cannot accept client-supplied persona state, replies, scores, gates, outcomes, or XP

## Verification

Required automated coverage:

1. All 67 scenarios accept adaptive persona turns.
2. A direct user question produces an input-sensitive provider request and response.
3. A normal attempt can end at turns three through six.
4. A persona exit can end before turn three.
5. Duplicate persona requests are idempotent.
6. Conflicting duplicates and out-of-order turns are rejected.
7. Persona output schema and state transitions are validated.
8. Prompt injection remains conversation data.
9. Persona failure records and returns the authored fallback.
10. Judge requests fail without a matching canonical server conversation.
11. Judge evidence still cites only user-authored turns.
12. Reset ignores an in-flight persona result.
13. Desktop, tablet, and mobile browser flows remain usable.
14. Browser code, requests, logs, diffs, and committed files contain no provider key.
15. Five seconds of Messaging draft inactivity prepares without committing.
16. Edited drafts cannot consume stale prepared replies.
17. Sent, Delivered, and Seen states render on desktop, tablet, and mobile.
18. All 67 scenarios are available without completion gates.

## Deliberately not claimed

- Arbitrary web GIF or sticker search
- Generated images
- Voice, avatar, or live-human messaging
- Durable multi-region conversation storage
- Open-ended unbounded chat
