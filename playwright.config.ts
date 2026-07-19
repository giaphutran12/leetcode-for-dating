import { defineConfig, devices } from "@playwright/test";

// A dedicated e2e port (distinct from the default dev 4173) so a stale, non-mock
// dev server can never be reused for the browser suite. reuseExistingServer:false
// forces a fresh server, and the webServer command sets RIZZCODE_JUDGE_MOCK=1 so
// the judge route is faked at the model seam — the real OpenAI provider is never
// hit by `npm run test:e2e`.
const E2E_PORT = 4174;
const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `RIZZCODE_JUDGE_MOCK=1 npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
  },
});
