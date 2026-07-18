import { describe, expect, it, vi } from "vitest";
import { deleteAuthenticatedUser } from "./deleteAccount";

describe("deleteAuthenticatedUser", () => {
  it("binds deletion to the user returned by the access token", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });

    const result = await deleteAuthenticatedUser(
      "access-token",
      { auth: { getUser } },
      { auth: { admin: { deleteUser } } },
    );

    expect(result).toEqual({ ok: true, userId: "verified-user" });
    expect(getUser).toHaveBeenCalledWith("access-token");
    expect(deleteUser).toHaveBeenCalledWith("verified-user");
  });

  it("never calls the admin API for an invalid session", async () => {
    const deleteUser = vi.fn();
    const result = await deleteAuthenticatedUser(
      "expired-token",
      {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "expired" },
          }),
        },
      },
      { auth: { admin: { deleteUser } } },
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "invalid_session",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not report success when Supabase rejects deletion", async () => {
    const result = await deleteAuthenticatedUser(
      "access-token",
      {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "verified-user" } },
            error: null,
          }),
        },
      },
      {
        auth: {
          admin: {
            deleteUser: vi
              .fn()
              .mockResolvedValue({ error: { message: "provider unavailable" } }),
          },
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 502,
      code: "delete_failed",
    });
  });
});
