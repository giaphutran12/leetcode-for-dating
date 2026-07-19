import { describe, expect, it } from "vitest";
import {
  billingStorageConfigured,
  siteUrl,
  stripePriceIdForPlan,
} from "./config";

describe("billing configuration", () => {
  it("maps plans to server-owned Stripe Price IDs", () => {
    const environment = {
      NODE_ENV: "test",
      STRIPE_MONTHLY_PRICE_ID: " price_monthly ",
      STRIPE_ANNUAL_PRICE_ID: "price_annual",
    } as NodeJS.ProcessEnv;
    expect(stripePriceIdForPlan("monthly", environment)).toBe("price_monthly");
    expect(stripePriceIdForPlan("annual", environment)).toBe("price_annual");
  });

  it("does not silently invent a missing Stripe price", () => {
    expect(() =>
      stripePriceIdForPlan("monthly", {} as NodeJS.ProcessEnv),
    ).toThrow(/monthly pricing is not configured/i);
  });

  it("normalizes the public site URL and detects storage configuration", () => {
    const environment = {
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: "https://rizzcode.example///",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "server-secret",
    } as NodeJS.ProcessEnv;
    expect(siteUrl(environment)).toBe("https://rizzcode.example");
    expect(billingStorageConfigured(environment)).toBe(true);
    expect(billingStorageConfigured({} as NodeJS.ProcessEnv)).toBe(false);
  });
});
