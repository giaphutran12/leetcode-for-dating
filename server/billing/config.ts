export const FREE_PRACTICE_LIMIT = 3;

export const STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER = "rizzcode_rhdubcmf";

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
  const configured = environment.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercelUrl = environment.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return "http://127.0.0.1:4173";
}
