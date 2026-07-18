"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  authConfigured,
  getSiteUrl,
  getSupabaseBrowserClient,
} from "../lib/auth";

type AuthResult = { error: string | null; needsConfirmation?: boolean };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  sendReset(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  exchangeCode(code: string): Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const mockAuth =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_RIZZCODE_MOCK_AUTH === "1";

const mockUser = {
  id: "local-e2e-user",
  email: "local@rizzcode.test",
} as User;

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!mockAuth);

  useEffect(() => {
    if (mockAuth) {
      setLoading(false);
      return;
    }
    if (!client) {
      setLoading(false);
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(() => {
    async function unavailable(): Promise<AuthResult> {
      return {
        error:
          "Authentication is not configured. Add the Supabase public URL and publishable key.",
      };
    }

    return {
      configured: authConfigured || mockAuth,
      loading,
      session,
      user: mockAuth ? mockUser : session?.user ?? null,
      signIn: client
        ? async (email, password) => {
            const { error } = await client.auth.signInWithPassword({
              email,
              password,
            });
            return { error: error?.message ?? null };
          }
        : unavailable,
      signUp: client
        ? async (email, password) => {
            const { data, error } = await client.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${getSiteUrl()}/auth/callback`,
              },
            });
            return {
              error: error?.message ?? null,
              needsConfirmation: !error && !data.session,
            };
          }
        : unavailable,
      signOut: client
        ? async () => {
            const { error } = await client.auth.signOut({ scope: "global" });
            return { error: error?.message ?? null };
          }
        : unavailable,
      sendReset: client
        ? async (email) => {
            const { error } = await client.auth.resetPasswordForEmail(email, {
              redirectTo: `${getSiteUrl()}/auth/reset`,
            });
            return { error: error?.message ?? null };
          }
        : unavailable,
      updatePassword: client
        ? async (password) => {
            const { error } = await client.auth.updateUser({ password });
            return { error: error?.message ?? null };
          }
        : unavailable,
      exchangeCode: client
        ? async (code) => {
            const { error } = await client.auth.exchangeCodeForSession(code);
            return { error: error?.message ?? null };
          }
        : unavailable,
    };
  }, [client, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
