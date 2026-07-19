import Stripe from "stripe";
import {
  STRIPE_PLAN_LOOKUP_KEYS,
  type BillingPlan,
} from "./config";

export type ResolvedStripePlan = {
  lookupKey: string;
  priceId: string;
  currency: string;
  unitAmount: number;
  displayPrice: string;
};

export function createStripeClient(
  environment: NodeJS.ProcessEnv = process.env,
): Stripe {
  const secretKey = environment.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }
  return new Stripe(secretKey, {
    appInfo: {
      name: "RizzCode",
      version: "0.1.0",
    },
  });
}

function expectedInterval(plan: BillingPlan): "month" | "year" {
  return plan === "monthly" ? "month" : "year";
}

export async function resolveStripePlan(
  stripe: Stripe,
  plan: BillingPlan,
): Promise<ResolvedStripePlan> {
  const lookupKey = STRIPE_PLAN_LOOKUP_KEYS[plan];
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 1,
    type: "recurring",
  });
  const price = prices.data[0];
  if (
    !price ||
    price.lookup_key !== lookupKey ||
    price.recurring?.interval !== expectedInterval(plan) ||
    price.unit_amount === null
  ) {
    throw new Error(`Stripe ${plan} pricing is not configured.`);
  }
  return {
    lookupKey,
    priceId: price.id,
    currency: price.currency,
    unitAmount: price.unit_amount,
    displayPrice: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency.toUpperCase(),
    }).format(price.unit_amount / 100),
  };
}

export async function resolveStripePlans(stripe: Stripe) {
  const [monthly, annual] = await Promise.all([
    resolveStripePlan(stripe, "monthly"),
    resolveStripePlan(stripe, "annual"),
  ]);
  return { monthly, annual };
}
