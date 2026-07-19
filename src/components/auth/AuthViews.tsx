"use client";

import {
  ArrowRight,
  CheckCircle,
  GoogleLogo,
  LockKey,
  SignOut,
  Trash,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  localAccountKeys,
  safeReturnPath,
  validatePassword,
} from "../../lib/auth";
import { ProductShell } from "../product/ProductShell";

function AuthFrame({
  eyebrow,
  title,
  intro,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  intro: string;
}>) {
  return (
    <main className="rizz-auth">
      <a className="rizz-auth__brand" href="/" aria-label="RizzCode home">
        <span aria-hidden="true">RC</span>
        <strong>RizzCode</strong>
      </a>
      <section className="rizz-auth__panel">
        <p className="rizz-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="rizz-auth__intro">{intro}</p>
        {children}
      </section>
      <aside>
        <p>Build the reps.</p>
        <strong>Keep the receipts.</strong>
      </aside>
    </main>
  );
}

export function LoginView({
  returnTo,
  guestLimitReached = false,
}: {
  returnTo?: string;
  guestLimitReached?: boolean;
}) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result = await auth.signInWithGoogle(returnTo);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (mode === "signup") {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    } else if (mode === "login" && !password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    const result =
      mode === "forgot"
        ? await auth.sendReset(email.trim())
        : mode === "signup"
          ? await auth.signUp(email.trim(), password)
          : await auth.signIn(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      setError(
        mode === "forgot"
          ? "If that account exists, a reset link will arrive shortly."
          : result.error,
      );
      return;
    }
    if (mode === "forgot") {
      setNotice("If that account exists, a reset link will arrive shortly.");
      return;
    }
    if (result.needsConfirmation) {
      setNotice("Check your email to confirm the account, then come back.");
      return;
    }
    window.location.assign(safeReturnPath(returnTo));
  }

  return (
    <AuthFrame
      eyebrow={mode === "forgot" ? "Password recovery" : "Your account"}
      title={
        guestLimitReached
          ? "Three reps down."
          : mode === "signup"
          ? "Start training."
          : mode === "forgot"
            ? "Reset the lock."
            : "Welcome back."
      }
      intro={
        guestLimitReached
          ? "Log in to unlock the fourth exercise and keep your run going."
          : mode === "signup"
          ? "Create one account for your reps, rank, and progress."
          : mode === "forgot"
            ? "We will send a secure password reset link."
            : "Log in and pick up where you left off."
      }
    >
      {!auth.configured && (
        <p className="rizz-auth__error" role="alert">
          Authentication is not configured on this environment.
        </p>
      )}
      <button
        className="rizz-google-button"
        type="button"
        onClick={signInWithGoogle}
        disabled={submitting || !auth.configured}
      >
        <GoogleLogo size={20} weight="bold" />
        Continue with Google
      </button>
      <div className="rizz-auth__divider" aria-hidden="true">
        <span>or use email</span>
      </div>
      <form className="rizz-auth__form" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {mode !== "forgot" && (
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : 1}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
        )}
        {error && (
          <p className="rizz-auth__error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rizz-auth__notice" role="status">
            <CheckCircle size={18} weight="fill" />
            {notice}
          </p>
        )}
        <button
          className="rizz-primary-button"
          type="submit"
          disabled={submitting || !auth.configured}
        >
          {submitting
            ? "Working…"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : "Log in"}
          <ArrowRight size={18} />
        </button>
      </form>
      <div className="rizz-auth__switches">
        {mode !== "login" && (
          <button type="button" onClick={() => setMode("login")}>
            Back to login
          </button>
        )}
        {mode === "login" && (
          <>
            <button type="button" onClick={() => setMode("signup")}>
              Create account
            </button>
            <button type="button" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          </>
        )}
      </div>
    </AuthFrame>
  );
}

export function AuthCallbackView() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("This sign-in link is missing its one-time code.");
      return;
    }
    const returnTo = safeReturnPath(
      new URLSearchParams(window.location.search).get("returnTo"),
    );
    void auth.exchangeCode(code).then((result) => {
      if (result.error) {
        setError("This sign-in link is invalid or expired. Request a new one.");
        return;
      }
      window.location.replace(returnTo);
    });
  }, [auth]);

  return (
    <AuthFrame
      eyebrow="Secure sign-in"
      title={error ? "Link did not land." : "Opening your account…"}
      intro={
        error ??
        "RizzCode is exchanging the one-time code and restoring your session."
      }
    >
      {error && (
        <a className="rizz-primary-button" href="/login">
          Return to login <ArrowRight size={18} />
        </a>
      )}
    </AuthFrame>
  );
}

export function ResetPasswordView() {
  const auth = useAuth();
  const [ready, setReady] = useState(Boolean(auth.session));
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (auth.session) {
      setReady(true);
      return;
    }
    if (auth.loading) return;
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setLinkError("This reset link is invalid or expired. Request a new one.");
      return;
    }
    void auth.exchangeCode(code).then((result) => {
      if (result.error) {
        setLinkError("This reset link is invalid or expired. Request a new one.");
      } else {
        window.history.replaceState({}, "", "/auth/reset");
        setReady(true);
      }
    });
  }, [auth]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await auth.updatePassword(password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <AuthFrame
      eyebrow="Password recovery"
      title={done ? "Password updated." : "Choose a new password."}
      intro={
        done
          ? "Your new password is active. You can continue training."
          : "Use 8 to 72 characters. This link works once."
      }
    >
      {linkError ? (
        <>
          <p className="rizz-auth__error" role="alert">
            {linkError}
          </p>
          <a className="rizz-primary-button" href="/login">
            Request another link <ArrowRight size={18} />
          </a>
        </>
      ) : done ? (
        <a className="rizz-primary-button" href="/">
          Continue to RizzCode <ArrowRight size={18} />
        </a>
      ) : ready ? (
        <form className="rizz-auth__form" onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="rizz-auth__error" role="alert">
              {error}
            </p>
          )}
          <button
            className="rizz-primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Updating…" : "Update password"}
            <LockKey size={18} />
          </button>
        </form>
      ) : (
        <p role="status">Checking the reset link…</p>
      )}
    </AuthFrame>
  );
}

export function AccountView() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function signOut() {
    const result = await auth.signOut();
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.assign("/login");
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Delete your RizzCode account and local practice data? This cannot be undone.",
      )
    ) {
      return;
    }
    const token = auth.session?.access_token;
    if (!token) {
      setError("Your session expired. Log in again before deleting the account.");
      return;
    }
    setDeleting(true);
    setError(null);
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "Account deletion failed. Try again.");
      setDeleting(false);
      return;
    }
    await auth.signOut();
    for (const key of localAccountKeys) window.localStorage.removeItem(key);
    window.location.assign("/login");
  }

  return (
    <ProductShell eyebrow="Account" title="Your corner.">
      <section className="rizz-account">
        <div>
          <p className="rizz-kicker">Signed in as</p>
          <h2>{auth.user?.email}</h2>
          <p>
            Your reps, progress, and milestones sync to this account and stay
            available on your other devices.
          </p>
        </div>
        {error && (
          <p className="rizz-auth__error" role="alert">
            {error}
          </p>
        )}
        <div className="rizz-account__actions">
          <button className="rizz-secondary-button" type="button" onClick={signOut}>
            <SignOut size={18} /> Log out
          </button>
          <button
            className="rizz-danger-button"
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
          >
            <Trash size={18} /> {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </section>
    </ProductShell>
  );
}
