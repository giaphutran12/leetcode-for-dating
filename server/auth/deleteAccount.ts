type UserLookupClient = {
  auth: {
    getUser(token: string): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

type AdminClient = {
  auth: {
    admin: {
      deleteUser(userId: string): Promise<{
        error: { message: string } | null;
      }>;
    };
  };
};

export async function deleteAuthenticatedUser(
  token: string,
  userClient: UserLookupClient,
  adminClient: AdminClient,
) {
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return { ok: false as const, status: 401, code: "invalid_session" };
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { ok: false as const, status: 502, code: "delete_failed" };
  }

  return { ok: true as const, userId: user.id };
}
