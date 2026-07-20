import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type Stripe from "stripe";
import { FREE_PRACTICE_LIMIT } from "./config";

export const PAID_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type PracticeAccess = {
  allowed: boolean;
  paid: boolean;
  remaining: number | null;
  reason:
    | "admin"
    | "paid"
    | "free_credit"
    | "existing_attempt"
    | "limit_reached";
};

export type BillingStatus = {
  paid: boolean;
  accessLevel: "admin" | "subscription" | "free";
  subscriptionStatus: string | null;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  freeCreditsUsed: number;
  freeCreditsRemaining: number;
};

export function createBillingAdminClient(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = environment.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error("Billing storage is not configured.");
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function claimPracticeAccess(
  client: SupabaseClient,
  userId: string,
  attemptId: string,
  scenarioId: string,
): Promise<PracticeAccess> {
  const { data, error } = await client.rpc("claim_rizzcode_practice", {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_scenario_id: scenarioId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("Practice entitlement returned an invalid response.");
  }
  return {
    allowed: row.allowed,
    paid: row.paid,
    remaining: row.remaining_credits,
    reason: row.reason,
  };
}

export async function getBillingStatus(
  client: SupabaseClient,
  userId: string,
): Promise<BillingStatus> {
  const [
    { data: subscription, error: subscriptionError },
    usage,
    { data: accountState, error: accountStateError },
    { data: accessLevel, error: accessLevelError },
  ] =
    await Promise.all([
      client
        .from("rizzcode_subscriptions")
        .select(
          "status,stripe_price_id,cancel_at_period_end,current_period_end",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("rizzcode_practice_usage")
        .select("scenario_id")
        .eq("user_id", userId),
      client
        .from("rizzcode_user_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle(),
      client.rpc("get_rizzcode_access_level", {
        p_user_id: userId,
      }),
    ]);
  if (subscriptionError) throw subscriptionError;
  if (usage.error) throw usage.error;
  if (accountStateError) throw accountStateError;
  const grantedAccessLevel = accessLevelError ? "free" : accessLevel;
  const progress = accountState?.state as
    | { progress?: { completedScenarioIds?: unknown } }
    | undefined;
  const completedScenarioIds = Array.isArray(
    progress?.progress?.completedScenarioIds,
  )
    ? progress.progress.completedScenarioIds.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const usedScenarioIds = new Set([
    ...completedScenarioIds,
    ...(usage.data ?? []).map((row) => row.scenario_id),
  ]);
  const freeCreditsUsed = Math.min(FREE_PRACTICE_LIMIT, usedScenarioIds.size);
  const paid = Boolean(
    subscription &&
      PAID_SUBSCRIPTION_STATUSES.includes(
        subscription.status as (typeof PAID_SUBSCRIPTION_STATUSES)[number],
      ),
  );
  return {
    paid,
    accessLevel:
      grantedAccessLevel === "admin"
        ? "admin"
        : paid
          ? "subscription"
          : "free",
    subscriptionStatus: subscription?.status ?? null,
    priceId: subscription?.stripe_price_id ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    freeCreditsUsed,
    freeCreditsRemaining: Math.max(
      0,
      FREE_PRACTICE_LIMIT - freeCreditsUsed,
    ),
  };
}

export async function getOrCreateStripeCustomer({
  client,
  stripe,
  user,
}: {
  client: SupabaseClient;
  stripe: Stripe;
  user: User;
}): Promise<string> {
  const { data, error } = await client
    .from("rizzcode_billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe.customers.create(
    {
      email: user.email,
      metadata: { rizzcode_user_id: user.id },
    },
    { idempotencyKey: `rizzcode-customer-${user.id}` },
  );
  const { error: upsertError } = await client
    .from("rizzcode_billing_customers")
    .upsert(
      {
        user_id: user.id,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (upsertError) throw upsertError;
  return customer.id;
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function storeSubscription(
  client: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackUserId?: string,
): Promise<void> {
  const userId =
    subscription.metadata.rizzcode_user_id?.trim() || fallbackUserId;
  const customerId = stripeId(subscription.customer);
  if (!userId || !customerId) {
    throw new Error("Stripe subscription is missing its RizzCode owner.");
  }
  const firstItem = subscription.items.data[0];
  const currentPeriodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  const { error: customerError } = await client
    .from("rizzcode_billing_customers")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (customerError) throw customerError;

  const { error } = await client.from("rizzcode_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price.id ?? null,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
