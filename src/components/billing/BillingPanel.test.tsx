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
});
