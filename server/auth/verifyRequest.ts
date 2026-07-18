import { createClient } from "@supabase/supabase-js";

export async function requestHasAuthenticatedUser(request: Request) {
  if (
    process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_RIZZCODE_MOCK_AUTH === "1")
  ) {
    return true;
  }

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!publicUrl || !publishableKey || !token) return false;

  const client = createClient(publicUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  return !error && Boolean(user);
}
