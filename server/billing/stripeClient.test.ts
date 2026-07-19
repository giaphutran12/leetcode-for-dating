import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { resolveStripePlan } from "./stripeClient";

function stripeWithPrice(
  price: Partial<Stripe.Price> | undefined,
): Stripe {
  return {
    prices: {
      list: vi.fn().mockResolvedValue({
        data: price ? [price] : [],
      }),
    },
  } as unknown as Stripe;
}

describe("Stripe price lookup", () => {
  it("resolves the current monthly Price through a stable lookup key", async () => {
    const stripe = stripeWithPrice({
      id: "price_current",
      lookup_key: "rizzcode_pro_monthly",
      currency: "usd",
      unit_amount: 1499,
      recurring: { interval: "month" } as Stripe.Price.Recurring,
    });

    await expect(resolveStripePlan(stripe, "monthly")).resolves.toEqual({
      lookupKey: "rizzcode_pro_monthly",
      priceId: "price_current",
      currency: "usd",
      unitAmount: 1499,
      displayPrice: "$14.99",
    });
    expect(stripe.prices.list).toHaveBeenCalledWith({
      active: true,
      lookup_keys: ["rizzcode_pro_monthly"],
      limit: 1,
      type: "recurring",
    });
  });

  it("rejects a missing or mismatched recurring price", async () => {
    await expect(
      resolveStripePlan(stripeWithPrice(undefined), "annual"),
    ).rejects.toThrow(/annual pricing is not configured/i);
    await expect(
      resolveStripePlan(
        stripeWithPrice({
          id: "price_wrong_interval",
          lookup_key: "rizzcode_pro_annual",
          currency: "usd",
          unit_amount: 9999,
          recurring: { interval: "month" } as Stripe.Price.Recurring,
        }),
        "annual",
      ),
    ).rejects.toThrow(/annual pricing is not configured/i);
  });
});
