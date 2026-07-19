import { createClient, type User } from "@supabase/supabase-js";

export async function authenticatedUserForRequest(
  request: Request,
): Promise<User | null> {
  if (
    process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_RIZZCODE_MOCK_AUTH === "1")
  ) {
    return {
      id: "local-e2e-user",
      email: "local@rizzcode.test",
    } as User;
  }

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!publicUrl || !publishableKey || !token) return null;

  const client = createClient(publicUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  return error ? null : user;
}

export async function requestHasAuthenticatedUser(request: Request) {
  return Boolean(await authenticatedUserForRequest(request));
}
