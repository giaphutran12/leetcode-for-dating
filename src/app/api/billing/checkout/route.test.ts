import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUserForRequest: vi.fn(),
  createBillingAdminClient: vi.fn(),
  getBillingStatus: vi.fn(),
  getOrCreateStripeCustomer: vi.fn(),
  checkoutCreate: vi.fn(),
  resolveStripePlan: vi.fn(),
}));

vi.mock("../../../../../server/auth/verifyRequest", () => ({
  authenticatedUserForRequest: mocks.authenticatedUserForRequest,
}));
vi.mock("../../../../../server/billing/config", () => ({
  siteUrl: () => "https://rizzcode.example",
  STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER: "rizzcode_testtest",
}));
vi.mock("../../../../../server/billing/store", () => ({
  createBillingAdminClient: mocks.createBillingAdminClient,
  getBillingStatus: mocks.getBillingStatus,
  getOrCreateStripeCustomer: mocks.getOrCreateStripeCustomer,
}));
vi.mock("../../../../../server/billing/stripeClient", () => ({
  createStripeClient: () => ({
    checkout: { sessions: { create: mocks.checkoutCreate } },
  }),
  resolveStripePlan: mocks.resolveStripePlan,
}));

import { POST } from "./route";

describe("billing checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUserForRequest.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
    });
    mocks.createBillingAdminClient.mockReturnValue({});
    mocks.getBillingStatus.mockResolvedValue({
      paid: false,
      accessLevel: "free",
    });
    mocks.getOrCreateStripeCustomer.mockResolvedValue("cus_test");
    mocks.resolveStripePlan.mockImplementation(
      async (_stripe: unknown, plan: string) => ({
        lookupKey: `rizzcode_pro_${plan}`,
        priceId: `price_${plan}`,
      }),
    );
    mocks.checkoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });
  });

  it("maps an allowlisted plan through its stable Stripe lookup key", async () => {
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "annual" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/test",
    });
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        integration_identifier: "rizzcode_testtest",
        customer: "cus_test",
        line_items: [{ price: "price_annual", quantity: 1 }],
        client_reference_id: "user-1",
      }),
    );
    expect(mocks.resolveStripePlan).toHaveBeenCalledWith(
      expect.anything(),
      "annual",
    );
  });

  it("rejects client-authored amounts and unknown plan names", async () => {
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "custom", amount: 1 }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it("does not create another checkout for an active subscriber", async () => {
    mocks.getBillingStatus.mockResolvedValue({
      paid: true,
      accessLevel: "subscription",
    });
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it("does not create a checkout for a database-granted admin", async () => {
    mocks.getBillingStatus.mockResolvedValue({
      paid: false,
      accessLevel: "admin",
    });
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "access_already_active",
    });
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });
});
