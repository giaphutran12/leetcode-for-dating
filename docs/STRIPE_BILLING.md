# Stripe billing setup

RizzCode uses Stripe-hosted Checkout for fixed-price subscriptions and the
Stripe-hosted customer portal for plan management. Stripe amounts live in
Stripe Price objects. The browser sends only `monthly` or `annual`; it never
sets an amount or a Price ID.

## Launch offer

- Three unique guided practices total, whether they are completed before or
  after account creation. Replaying a completed scenario does not consume
  another free practice.
- RizzCode Pro monthly: USD $14.99.
- RizzCode Pro annual founding price: USD $99.99.
- Paid coaching is presented as standard access subject to documented fair use,
  not as an impossible-to-enforce promise of literal unlimited usage.

The launch funnel and price are hypotheses. Compare three versus seven free
guided practices after enough traffic exists to measure paid conversion within
14 days of the first completed practice.

## Live account

The existing Smart Math BC Stripe account was confirmed as the intended legal
merchant for RizzCode on July 20, 2026. Its live `RizzCode Pro` product uses the
lookup keys documented below. Continue using a Stripe sandbox for development
and test payments; never use live credentials in local test fixtures.

## Dashboard setup

1. Switch Stripe to a sandbox. Do not use the live secret key during
   development.
2. Create one product named `RizzCode Pro`.
3. Add a recurring USD $14.99 monthly Price with lookup key
   `rizzcode_pro_monthly`.
4. Add a recurring USD $99.99 yearly Price with lookup key
   `rizzcode_pro_annual`.
5. Do not copy Price IDs into environment variables. RizzCode resolves the
   active Prices through those stable lookup keys.
6. Configure the Stripe customer portal so users can update payment methods and
   cancel subscriptions.
7. Add a webhook destination:
   `https://YOUR_DOMAIN/api/billing/webhook`.
8. Subscribe it to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, and `invoice.payment_failed`.

For local webhook testing:

```sh
stripe listen --forward-to http://127.0.0.1:4173/api/billing/webhook
```

Stripe prints a temporary `whsec_...` signing secret for that listener.

## Private environment

Store these values in `.env.local` locally and in the deployment provider's
encrypted environment settings:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The standard browser-key name is
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`, but this build does not use or
require it because the server redirects to Stripe-hosted Checkout. Add it only
if RizzCode later embeds Stripe.js or Elements. A value beginning with
`pk_live_` is never a secret key; `STRIPE_SECRET_KEY` must begin with
`sk_test_` in a sandbox or `sk_live_` in live mode.

Never paste `sk_...` or `whsec_...` into chat, source code, screenshots, logs,
or commits. RizzCode's hosted Checkout flow does not need a Stripe publishable
key in the browser.

## Database access grants

Owner and admin access is independent from Stripe. The migration
`20260720134907_database_access_grants.sql` creates a private grant table and
updates the server-only practice claim function. A grant is keyed to the stable
Supabase Auth user UUID:

```sql
insert into private.rizzcode_access_grants (
  user_id,
  access_level,
  reason
) values (
  'USER_UUID',
  'admin',
  'Approved admin access'
)
on conflict (user_id) do update
set
  access_level = excluded.access_level,
  reason = excluded.reason,
  expires_at = null,
  updated_at = now();
```

Remove access by deleting that user's row. Neither operation creates or updates
a Stripe customer, subscription, invoice, or revenue record. Run grant changes
only through a trusted database administration path; browser roles have no
access to the private table or its server-only lookup function.

## Changing the price

Stripe Price amounts are immutable. To change what new subscribers pay:

1. Create a new monthly or annual Price.
2. Transfer the existing `rizzcode_pro_monthly` or `rizzcode_pro_annual`
   lookup key to the new Price.
3. Archive the old Price when it should no longer accept new subscriptions.

No code, environment-variable, or deployment change is required. Existing
subscribers remain on their original Price until they are deliberately migrated.

## Data and entitlement flow

1. The authenticated server creates or reuses a Stripe Customer.
2. The server maps `monthly` or `annual` to a stable Stripe lookup key, resolves
   the current Price, and creates a Checkout Session.
3. A signed Stripe webhook writes the subscription status to Supabase.
4. The first AI generation for a new authenticated attempt atomically claims
   one of three unique free practices. Synced guest progress counts toward the
   same limit.
5. Active or trialing subscriptions bypass the free-credit limit.
6. A server-owned database access grant can unlock an admin account without
   creating a Stripe customer or subscription. Grants are keyed by the
   Supabase Auth user UUID and managed only through trusted database operations.
7. Cancelled or unpaid subscriptions stop bypassing the limit after Stripe
   updates the stored subscription status.

The billing tables are server-only. Browser clients receive no direct grants,
and the credit-claim function is executable only by the Supabase service role.
