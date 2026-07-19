import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// With vitest `globals: false`, React Testing Library cannot auto-register its
// afterEach cleanup, so DOM would accumulate across tests in a file. Register it
// once here for every suite.
afterEach(() => {
  cleanup();
});
