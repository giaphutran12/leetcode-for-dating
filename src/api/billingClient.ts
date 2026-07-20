import { z } from "zod";
import { authenticatedFetch } from "./authFetch";

export type BillingPlan = "monthly" | "annual";

const redirectSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), url: z.string().url() }),
  z.object({
    ok: z.literal(false),
    message: z.string(),
    code: z.string().optional(),
  }),
]);

const statusSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    paid: z.boolean(),
    accessLevel: z.enum(["admin", "subscription", "free"]),
    subscriptionStatus: z.string().nullable(),
    priceId: z.string().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    currentPeriodEnd: z.string().nullable(),
    freeCreditsUsed: z.number().int().nonnegative(),
    freeCreditsRemaining: z.number().int().nonnegative(),
    plans: z.object({
      monthly: z.object({
        lookupKey: z.literal("rizzcode_pro_monthly"),
        priceId: z.string(),
        currency: z.string(),
        unitAmount: z.number().int().nonnegative(),
        displayPrice: z.string(),
      }),
      annual: z.object({
        lookupKey: z.literal("rizzcode_pro_annual"),
        priceId: z.string(),
        currency: z.string(),
        unitAmount: z.number().int().nonnegative(),
        displayPrice: z.string(),
      }),
    }),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

async function redirectRequest(path: string, body?: unknown) {
  const response = await authenticatedFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = redirectSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { ok: false as const, message: "Billing returned an invalid response." };
  }
  return parsed.data;
}

export function createCheckout(plan: BillingPlan) {
  return redirectRequest("/api/billing/checkout", { plan });
}

export function createBillingPortal() {
  return redirectRequest("/api/billing/portal");
}

export async function loadBillingStatus() {
  const response = await authenticatedFetch("/api/billing/status");
  const parsed = statusSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { ok: false as const, message: "Billing returned an invalid response." };
  }
  return parsed.data;
}
