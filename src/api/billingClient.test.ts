import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBillingPortal,
  createCheckout,
  loadBillingStatus,
} from "./billingClient";
import { authenticatedFetch } from "./authFetch";

vi.mock("./authFetch", () => ({
  authenticatedFetch: vi.fn(),
}));

describe("billing client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts checkout with a fixed plan key rather than a client amount", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      Response.json({ ok: true, url: "https://checkout.stripe.com/test" }),
    );
    await expect(createCheckout("annual")).resolves.toEqual({
      ok: true,
      url: "https://checkout.stripe.com/test",
    });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/billing/checkout",
      expect.objectContaining({ body: JSON.stringify({ plan: "annual" }) }),
    );
  });

  it("opens the server-created customer portal", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      Response.json({ ok: true, url: "https://billing.stripe.com/test" }),
    );
    await expect(createBillingPortal()).resolves.toEqual({
      ok: true,
      url: "https://billing.stripe.com/test",
    });
  });

  it("validates billing status before exposing it to the UI", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      Response.json({
        ok: true,
        paid: false,
        subscriptionStatus: null,
        priceId: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        freeCreditsUsed: 2,
        freeCreditsRemaining: 1,
        plans: {
          monthly: {
            lookupKey: "rizzcode_pro_monthly",
            priceId: "price_monthly",
            currency: "usd",
            unitAmount: 1499,
            displayPrice: "$14.99",
          },
          annual: {
            lookupKey: "rizzcode_pro_annual",
            priceId: "price_annual",
            currency: "usd",
            unitAmount: 9999,
            displayPrice: "$99.99",
          },
        },
      }),
    );
    await expect(loadBillingStatus()).resolves.toMatchObject({
      ok: true,
      paid: false,
      freeCreditsRemaining: 1,
    });
  });
});
