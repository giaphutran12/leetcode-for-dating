import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "./authFetch";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("../lib/auth", () => ({
  getSupabaseBrowserClient: () => ({ auth: { getSession } }),
}));

describe("authenticatedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response()));
  });

  it("adds the current Supabase access token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "user-access-token" } },
    });

    await authenticatedFetch("/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer user-access-token",
    );
  });

  it("allows a guest request without an authorization header", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await authenticatedFetch("/api/judge");

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });
});
