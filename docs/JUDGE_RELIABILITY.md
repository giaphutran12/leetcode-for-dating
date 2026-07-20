# Judge reliability and launch acceptance

## Reproduced failure

The recurring `Judgment did not land` report had a confirmed client trust-boundary
failure, not a failed model call:

1. The production browser completed RC-006 and showed the preserved-transcript
   judge error state.
2. Runtime receipts showed `POST /api/judge` returning HTTP 200.
3. The server and scenario catalog accepted `mutual_enjoyment`.
4. The browser validator still used an older hardcoded outcome enum and rejected
   that valid result as `judge_invalid_output`.
5. Commit `04abbf625d803f60b3a93143ba50d3596ab8f10b` derived browser outcome
   validation from `OUTCOME_LABELS` and added full-catalog coverage.

The current implementation keeps both browser and server model-output schemas
derived from the canonical outcome catalog. This investigation used repository
history, the prior production HTTP/log receipts, and mocked providers. It made no
uncontrolled live model call.

## Current request-to-result chain

1. `useRizzPracticeSession` freezes the canonical attempt and disables duplicate
   submission while judging.
2. `judgeClient` sends only the attempt ID, scenario ID, contiguous user responses,
   and signed conversation receipt.
3. The API verifies the signed receipt and rejects client-supplied authority.
4. The judge service requires an exact response match with the server-owned
   conversation and checks readiness.
5. A SHA-256 transcript binding claims the attempt in `rizzcode_judgments`.
   Completed duplicates reuse the validated result; concurrent duplicates do not
   start another provider call.
6. Vercel AI SDK calls the configured OpenAI judge with atomic structured output.
   The model classifies safety and outcomes from the full transcript without
   keyword or phrase matching.
7. Server validation requires five unique rubric criteria, exact transcript
   evidence, supported outcomes, internally consistent safety fields,
   deterministic arithmetic, safety caps, and the matching verdict. A stop is
   enforced only when model confidence is high.
8. The validated result is persisted before it is returned. Persistence failure
   remains unscored and retryable.
9. The browser repeats the trust-boundary validation before recording XP, the
    completed attempt, or practice activity.
10. Typed failures preserve the transcript, show the exact failure code, award no
    XP, and expose retry only when recovery is possible.

## Acceptance matrix

| Case | Expected result | Automated receipt |
| --- | --- | --- |
| Normal supported outcome | One validated result with five exact-evidence criteria | `server/judge/service.test.ts` complete in-person and messaging cases |
| Stop boundary crossed | High-confidence model stop, forced `boundary_crossed`, score at most 2, zero XP | judge service and progression gate tests |
| Cap boundary crossed | Model-classified cap and score at most 4 | judge service cap test |
| Ambiguous safety language | No hard stop without high confidence; lower-confidence stop becomes a cap | scoring confidence-downgrade test |
| Malformed or partial model output | `judge_invalid_output`, no result, no XP, claim released for explicit retry | judge service malformed-output and judge client partial-success tests |
| Timeout | One automatic transient retry, then `judge_timeout` with preserved transcript | provider error mapping test |
| Rate limit | One automatic transient retry, then `judge_rate_limited` | provider error mapping test |
| Provider authentication error | No automatic retry, typed `judge_unconfigured` | provider error mapping test |
| Other provider failure | At most one transient retry, then `judge_unavailable` | judge service provider-failure test |
| Concurrent duplicate | Second request returns `judge_in_progress`; provider runs once | in-flight duplicate test |
| Completed duplicate or lost response retry | Reuse persisted validated result; provider runs once | completed judgment reuse test |
| Attempt ID reused with changed transcript | Reject as non-retryable `judge_invalid_output` | judgment store conflict test |
| Browser network or non-JSON upstream error | `judge_unavailable`, preserved transcript, no fabricated result | judge client unreachable/non-JSON test |

## Observability

Filter runtime or server-only Supabase conversation events by `attemptId`.

- `judge.started` means the idempotency claim succeeded and provider work began.
- `judge.completed` includes the validated draft and final result.
- `judge.reused` means a retry returned the persisted result without another model
  call.
- `judge.failed` includes a typed classification, bounded provider/validation error,
  model, operation number, and canonical conversation.

Session receipts, authorization headers, provider keys, and Supabase secrets are not
logged. Conversation content is intentionally present for restricted operator
debugging.

## Production rollout order

1. Configure the GitHub `production` environment and required Supabase secrets
   described in `SUPABASE_MIGRATIONS.md`.
2. Merge only after `Supabase migration dry-run` passes. The main-branch
   `Supabase Migrations CD` workflow must apply
   `20260720065000_judgment_idempotency.sql`; do not apply it manually.
3. Confirm the server environment contains the documented variable names without
   printing their values.
4. Deploy and filter logs for one controlled attempt ID.
5. Complete one normal result and retry the identical signed request. Confirm one
   `judge.completed`, one `judge.reused`, and only one provider operation.
6. Exercise a controlled mocked/staging timeout or provider error. Confirm no score,
   no XP, preserved transcript, typed UI copy, and a working retry.
7. Confirm `rizzcode_judgments` and `rizzcode_conversation_events` are inaccessible
   to `anon` and `authenticated` browser roles.
