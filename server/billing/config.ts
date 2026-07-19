export const FREE_AUTHENTICATED_PRACTICE_CREDITS = 2;

export type BillingPlan = "monthly" | "annual";

export function billingStorageConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SECRET_KEY?.trim(),
  );
}

export function stripePriceIdForPlan(
  plan: BillingPlan,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const value =
    plan === "monthly"
      ? environment.STRIPE_MONTHLY_PRICE_ID
      : environment.STRIPE_ANNUAL_PRICE_ID;
  if (!value?.trim()) {
    throw new Error(`Stripe ${plan} pricing is not configured.`);
  }
  return value.trim();
}

export function siteUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return (
    environment.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    "http://127.0.0.1:4173"
  );
}
