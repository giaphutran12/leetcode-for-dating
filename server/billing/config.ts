export const FREE_AUTHENTICATED_PRACTICE_CREDITS = 2;

export type BillingPlan = "monthly" | "annual";

export const STRIPE_PLAN_LOOKUP_KEYS = {
  monthly: "rizzcode_pro_monthly",
  annual: "rizzcode_pro_annual",
} as const satisfies Record<BillingPlan, string>;

export function billingStorageConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.SUPABASE_SECRET_KEY?.trim(),
  );
}

export function siteUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return (
    environment.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    "http://127.0.0.1:4173"
  );
}
