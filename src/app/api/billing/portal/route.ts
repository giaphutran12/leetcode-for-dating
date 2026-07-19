import { authenticatedUserForRequest } from "../../../../../server/auth/verifyRequest";
import { siteUrl } from "../../../../../server/billing/config";
import { createBillingAdminClient } from "../../../../../server/billing/store";
import { createStripeClient } from "../../../../../server/billing/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await authenticatedUserForRequest(request);
  if (!user) return json({ ok: false, message: "Log in to manage billing." }, 401);

  try {
    const client = createBillingAdminClient();
    const { data, error } = await client
      .from("rizzcode_billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.stripe_customer_id) {
      return json(
        { ok: false, message: "This account has no billing profile yet." },
        404,
      );
    }
    const session = await createStripeClient().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl()}/account`,
    });
    return json({ ok: true, url: session.url }, 200);
  } catch {
    return json(
      {
        ok: false,
        message: "The billing portal is temporarily unavailable.",
      },
      503,
    );
  }
}
