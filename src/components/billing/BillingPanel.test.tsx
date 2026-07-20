import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBillingPortal,
  createCheckout,
  loadBillingStatus,
} from "../../api/billingClient";
import { BillingPanel } from "./BillingPanel";

vi.mock("../../api/billingClient", () => ({
  createBillingPortal: vi.fn(),
  createCheckout: vi.fn(),
  loadBillingStatus: vi.fn(),
}));

describe("billing panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadBillingStatus).mockResolvedValue({
      ok: true,
      paid: false,
      subscriptionStatus: null,
      priceId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      freeCreditsUsed: 1,
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
    });
  });

  it("uses canonical brand controls for the two launch plans", async () => {
    vi.mocked(createCheckout).mockResolvedValue({
      ok: false,
      message: "Test checkout stopped before redirect.",
    });
    render(<BillingPanel />);

    const monthly = await screen.findByRole("button", {
      name: "$14.99 monthly",
    });
    const annual = screen.getByRole("button", { name: "$99.99 yearly" });
    expect(monthly).toHaveClass("rc-button", "rc-button--lime");
    expect(annual).toHaveClass("rc-button", "rc-button--secondary");

    fireEvent.click(monthly);
    await waitFor(() => expect(createCheckout).toHaveBeenCalledWith("monthly"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Test checkout stopped before redirect.",
    );
  });

  it("shows the Stripe portal action to an active subscriber", async () => {
    vi.mocked(loadBillingStatus).mockResolvedValue({
      ok: true,
      paid: true,
      subscriptionStatus: "active",
      priceId: "price_monthly",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-08-19T00:00:00.000Z",
      freeCreditsUsed: 2,
      freeCreditsRemaining: 0,
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
    });
    vi.mocked(createBillingPortal).mockResolvedValue({
      ok: false,
      message: "Test portal stopped before redirect.",
    });
    render(<BillingPanel />);

    const manage = await screen.findByRole("button", {
      name: "Manage billing",
    });
    fireEvent.click(manage);
    await waitFor(() => expect(createBillingPortal).toHaveBeenCalledOnce());
  });

  it("tells a free user with zero credits to subscribe now", async () => {
    const current = await loadBillingStatus();
    if (!current || !current.ok) throw new Error("Expected free billing fixture.");
    vi.mocked(loadBillingStatus).mockResolvedValue({
      ...current,
      freeCreditsUsed: 2,
      freeCreditsRemaining: 0,
    });

    render(<BillingPanel />);

    expect(
      await screen.findByText(
        "0 free unique practices left. Subscribe to keep training.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/subscribe when the free reps are done/i),
    ).not.toBeInTheDocument();
  });
});
