import { authenticatedUserForRequest } from "../../../../../server/auth/verifyRequest";
import {
  createBillingAdminClient,
  getBillingStatus,
} from "../../../../../server/billing/store";
import {
  createStripeClient,
  resolveStripePlans,
} from "../../../../../server/billing/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const user = await authenticatedUserForRequest(request);
  if (!user) return json({ ok: false, message: "Log in to view billing." }, 401);
  try {
    const [status, plans] = await Promise.all([
      getBillingStatus(createBillingAdminClient(), user.id),
      resolveStripePlans(createStripeClient()),
    ]);
    return json(
      {
        ok: true,
        ...status,
        plans,
      },
      200,
    );
  } catch {
    return json(
      { ok: false, message: "Billing status is temporarily unavailable." },
      503,
    );
  }
}
