import { z } from "zod";
import { authenticatedUserForRequest } from "../../../../../server/auth/verifyRequest";
import { siteUrl } from "../../../../../server/billing/config";
import {
  createBillingAdminClient,
  getBillingStatus,
  getOrCreateStripeCustomer,
} from "../../../../../server/billing/store";
import {
  createStripeClient,
  resolveStripePlan,
} from "../../../../../server/billing/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  plan: z.enum(["monthly", "annual"]),
});

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await authenticatedUserForRequest(request);
  if (!user) return json({ ok: false, message: "Log in to subscribe." }, 401);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ ok: false, message: "Choose a valid billing plan." }, 400);
  }

  try {
    const stripe = createStripeClient();
    const client = createBillingAdminClient();
    const status = await getBillingStatus(client, user.id);
    if (status.paid) {
      return json(
        {
          ok: false,
          code: "already_subscribed",
          message: "This account already has an active subscription.",
        },
        409,
      );
    }
    const customer = await getOrCreateStripeCustomer({
      client,
      stripe,
      user,
    });
    const resolvedPlan = await resolveStripePlan(stripe, parsed.data.plan);
    const baseUrl = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [
        {
          price: resolvedPlan.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        rizzcode_user_id: user.id,
        rizzcode_plan: parsed.data.plan,
      },
      subscription_data: {
        metadata: { rizzcode_user_id: user.id },
      },
      success_url: `${baseUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/account?checkout=cancelled`,
    });
    if (!session.url) {
      throw new Error("Stripe Checkout did not return a URL.");
    }
    return json({ ok: true, url: session.url }, 200);
  } catch {
    return json(
      {
        ok: false,
        message: "Checkout is temporarily unavailable. Try again shortly.",
      },
      503,
    );
  }
}
