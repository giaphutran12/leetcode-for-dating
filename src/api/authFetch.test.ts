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

  it("does not call a protected endpoint without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(authenticatedFetch("/api/judge")).rejects.toThrow(
      "authentication_required",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
