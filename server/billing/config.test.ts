import { describe, expect, it } from "vitest";
import {
  billingStorageConfigured,
  siteUrl,
  STRIPE_PLAN_LOOKUP_KEYS,
} from "./config";

describe("billing configuration", () => {
  it("uses stable Stripe lookup keys instead of deploy-time Price IDs", () => {
    expect(STRIPE_PLAN_LOOKUP_KEYS).toEqual({
      monthly: "rizzcode_pro_monthly",
      annual: "rizzcode_pro_annual",
    });
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
