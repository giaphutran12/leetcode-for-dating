import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { claimPracticeAccess, getBillingStatus } from "./store";

function billingClient(
  accessLevel: "admin" | "free",
  accessError: unknown = null,
): SupabaseClient {
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq:
        table === "rizzcode_practice_usage"
          ? vi.fn().mockResolvedValue({ data: [], error: null })
          : vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
    })),
  }));
  const rpc = vi.fn((name: string) => {
    if (name === "get_rizzcode_access_level") {
      return Promise.resolve({ data: accessLevel, error: accessError });
    }
    return Promise.resolve({
      data: [
        {
          allowed: true,
          paid: false,
          remaining_credits: null,
          reason: "admin",
        },
      ],
      error: null,
    });
  });
  return { from, rpc } as unknown as SupabaseClient;
}

describe("database-owned admin billing access", () => {
  it("maps the database practice grant without consuming a credit", async () => {
    const client = billingClient("admin");

    await expect(
      claimPracticeAccess(client, "admin-user", "attempt-1", "RC-001"),
    ).resolves.toEqual({
      allowed: true,
      paid: false,
      remaining: null,
      reason: "admin",
    });
    expect(client.rpc).toHaveBeenCalledWith("claim_rizzcode_practice", {
      p_user_id: "admin-user",
      p_attempt_id: "attempt-1",
      p_scenario_id: "RC-001",
    });
  });

  it("reports admin access without inventing a Stripe subscription", async () => {
    await expect(
      getBillingStatus(billingClient("admin"), "admin-user"),
    ).resolves.toEqual({
      paid: false,
      accessLevel: "admin",
      subscriptionStatus: null,
      priceId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      freeCreditsUsed: 0,
      freeCreditsRemaining: 3,
    });
  });

  it("fails closed while the access-grant migration is still landing", async () => {
    await expect(
      getBillingStatus(
        billingClient("free", { code: "PGRST202" }),
        "free-user",
      ),
    ).resolves.toMatchObject({
      paid: false,
      accessLevel: "free",
    });
  });
});
