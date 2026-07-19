import { authenticatedUserForRequest } from "../../../../../server/auth/verifyRequest";
import {
  createBillingAdminClient,
  getBillingStatus,
} from "../../../../../server/billing/store";

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
    return json(
      {
        ok: true,
        ...(await getBillingStatus(createBillingAdminClient(), user.id)),
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
