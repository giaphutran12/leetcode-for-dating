-- The postgres-owned ensure_rls event trigger still invokes this function.
-- It is not an application RPC and must not be callable through the Data API.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
