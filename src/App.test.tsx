import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

vi.mock("@gsap/react", () => ({
  useGSAP: () => {},
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    matchMedia: vi.fn(() => ({ add: vi.fn(), revert: vi.fn() })),
    utils: { toArray: vi.fn(() => []) },
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
      to: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: { create: vi.fn() },
}));

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renders the RizzCode hero", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /Practice courage\./ }),
    ).toBeInTheDocument();
  });

  it("links the landing nav to practice, progress, and leaderboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const hasHref = (name: RegExp | string, href: string) =>
      screen
        .getAllByRole("link", { name })
        .some((link) => link.getAttribute("href") === href);

    expect(hasHref("Practice", "/practice")).toBe(true);
    expect(hasHref("Progress", "/progress")).toBe(true);
    expect(hasHref("Leaderboard", "/leaderboard")).toBe(true);
  });

  it("renders a real not-found state on an unknown route", () => {
    render(
      <MemoryRouter initialEntries={["/definitely-not-a-route"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /This one didn.t land\./ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back home/ })).toBeInTheDocument();
  });
});
