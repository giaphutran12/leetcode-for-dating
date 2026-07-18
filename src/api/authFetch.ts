import { getSupabaseBrowserClient } from "../lib/auth";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_RIZZCODE_MOCK_AUTH === "1"
  ) {
    return fetch(input, init);
  }
  const client = getSupabaseBrowserClient();
  const {
    data: { session },
  } = client
    ? await client.auth.getSession()
    : { data: { session: null } };
  if (!session?.access_token) {
    throw new Error("authentication_required");
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}
