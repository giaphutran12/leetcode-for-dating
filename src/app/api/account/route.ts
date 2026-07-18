import { createClient } from "@supabase/supabase-js";
import { deleteAuthenticatedUser } from "../../../../server/auth/deleteAccount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: Request) {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!publicUrl || !publishableKey || !secretKey) {
    return json(
      { ok: false, message: "Account deletion is not configured." },
      503,
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) {
    return json({ ok: false, message: "Log in again and retry." }, 401);
  }

  const userClient = createClient(publicUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(publicUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await deleteAuthenticatedUser(
    token,
    userClient,
    adminClient,
  );
  if (!result.ok) {
    return json(
      {
        ok: false,
        message:
          result.code === "invalid_session"
            ? "Your session expired. Log in again and retry."
            : "Account deletion failed. Try again.",
      },
      result.status,
    );
  }

  return json({ ok: true }, 200);
}
