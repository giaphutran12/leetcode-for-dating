import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const authConfigured = Boolean(publicUrl && publishableKey);

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!authConfigured) return null;
  browserClient ??= createClient(publicUrl, publishableKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://127.0.0.1:4173";
}

export function getAuthCallbackUrl(returnTo?: string) {
  const callback = new URL(`${getSiteUrl()}/auth/callback`);
  callback.searchParams.set("returnTo", safeReturnPath(returnTo));
  return callback.toString();
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth/") || value === "/login") return "/";
  return value;
}

export function validatePassword(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 72) return "Use 72 characters or fewer.";
  return null;
}

export const localAccountKeys = [
  "rizzcode.v1.profile",
  "rizzcode.v1.progress",
  "rizzcode.v1.attempts",
  "rizzcode.v1.milestones",
] as const;
