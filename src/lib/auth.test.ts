import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthCallbackUrl,
  safeReturnPath,
  validatePassword,
} from "./auth";

describe("auth helpers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only local non-auth return paths", () => {
    expect(safeReturnPath("/practice/RC-001")).toBe("/practice/RC-001");
    expect(safeReturnPath("https://attacker.example")).toBe("/");
    expect(safeReturnPath("//attacker.example")).toBe("/");
    expect(safeReturnPath("/auth/reset")).toBe("/");
    expect(safeReturnPath("/login")).toBe("/");
  });

  it("enforces the supported password length", () => {
    expect(validatePassword("short")).toMatch(/at least 8/i);
    expect(validatePassword("eight888")).toBeNull();
    expect(validatePassword("x".repeat(73))).toMatch(/72 characters/i);
  });

  it("keeps OAuth callbacks on the configured site with a safe return path", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://rizzcode-nextjs.vercel.app/",
    );
    expect(getAuthCallbackUrl("/practice/RC-004")).toBe(
      "https://rizzcode-nextjs.vercel.app/auth/callback?returnTo=%2Fpractice%2FRC-004",
    );
    expect(getAuthCallbackUrl("https://attacker.example")).toBe(
      "https://rizzcode-nextjs.vercel.app/auth/callback?returnTo=%2F",
    );
  });
});
