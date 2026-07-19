import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
  createBillingAdminClient: vi.fn(),
  storeSubscription: vi.fn(),
}));

vi.mock("../../../../../server/billing/store", () => ({
  createBillingAdminClient: mocks.createBillingAdminClient,
  storeSubscription: mocks.storeSubscription,
}));
vi.mock("../../../../../server/billing/stripeClient", () => ({
  createStripeClient: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.retrieveSubscription },
  }),
}));

import { POST } from "./route";

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "test-signing-secret";
    mocks.createBillingAdminClient.mockReturnValue({});
  });

  it("rejects a payload whose Stripe signature cannot be verified", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.storeSubscription).not.toHaveBeenCalled();
  });

  it("stores Stripe subscription updates only after verification", async () => {
    const subscription = { id: "sub_test" };
    mocks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: subscription },
    });
    const response = await POST(
      new Request("https://rizzcode.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "verified" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.storeSubscription).toHaveBeenCalledWith({}, subscription);
  });
});
