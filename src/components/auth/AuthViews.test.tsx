import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RizzCodeProvider } from "../../context/RizzCodeContext";
import { AccountView, LoginView, ResetPasswordView } from "./AuthViews";

const authMock = vi.hoisted(() => ({
  configured: true,
  loading: false,
  session: null as { access_token: string } | null,
  user: null as { email: string } | null,
  signInWithGoogle: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  sendReset: vi.fn(),
  updatePassword: vi.fn(),
  exchangeCode: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authMock,
}));

vi.mock("../billing/BillingPanel", () => ({
  BillingPanel: () => <div>Billing plans</div>,
}));

describe("auth views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.configured = true;
    authMock.loading = false;
    authMock.session = null;
    authMock.user = null;
    authMock.signInWithGoogle.mockResolvedValue({ error: null });
  });

  it("starts Google OAuth with the gated scenario return path", async () => {
    render(
      <LoginView
        returnTo="/practice/RC-004"
        guestLimitReached
      />,
    );

    expect(
      screen.getByRole("heading", { name: "First rep down." }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(authMock.signInWithGoogle).toHaveBeenCalledWith(
        "/practice/RC-004",
      ),
    );
  });

  it("requests password recovery without revealing account existence", async () => {
    authMock.sendReset.mockResolvedValue({ error: null });
    render(<LoginView />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(authMock.sendReset).toHaveBeenCalledWith("person@example.com"),
    );
    expect(
      screen.getByText(/if that account exists, a reset link will arrive/i),
    ).toBeInTheDocument();
  });

  it("requires a password before calling Supabase", () => {
    render(<LoginView />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Log in" }).closest("form")!,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/enter your password/i);
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("requires matching new passwords", () => {
    authMock.session = { access_token: "recovery-token" };
    render(<ResetPasswordView />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass88" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different88" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/do not match/i);
    expect(authMock.updatePassword).not.toHaveBeenCalled();
  });

  it("keeps account actions focused on signing out", () => {
    authMock.user = { email: "person@example.com" };
    render(
      <RizzCodeProvider>
        <AccountView />
      </RizzCodeProvider>,
    );

    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete account" }),
    ).not.toBeInTheDocument();
  });
});
