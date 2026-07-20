import type Stripe from "stripe";
import {
  createBillingAdminClient,
  storeSubscription,
} from "../../../../../server/billing/store";
import { createStripeClient } from "../../../../../server/billing/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.subscription
      : null;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !webhookSecret) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const stripe = createStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    const client = createBillingAdminClient();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        await storeSubscription(
          client,
          subscription,
          session.metadata?.rizzcode_user_id ??
            session.client_reference_id ??
            undefined,
        );
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      await storeSubscription(
        client,
        await stripe.subscriptions.retrieve(event.data.object.id),
      );
    } else if (event.type === "customer.subscription.deleted") {
      await storeSubscription(client, event.data.object);
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const subscriptionId = subscriptionIdFromInvoice(event.data.object);
      if (subscriptionId) {
        await storeSubscription(
          client,
          await stripe.subscriptions.retrieve(subscriptionId),
        );
      }
    }
    return Response.json({ received: true }, { status: 200 });
  } catch {
    console.error("Stripe webhook processing failed.", {
      eventId: event.id,
      eventType: event.type,
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
