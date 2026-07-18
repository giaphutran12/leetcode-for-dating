import { describe, expect, it } from "vitest";
import { safeReturnPath, validatePassword } from "./auth";

describe("auth helpers", () => {
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
});
