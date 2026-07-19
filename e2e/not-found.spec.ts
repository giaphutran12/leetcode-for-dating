import { expect, test } from "@playwright/test";

// Unknown route renders a real not-found state (plan: "Error and failure
// behavior" — Unknown route).
test("/nope renders the not-found view", async ({ page }) => {
  await page.goto("/nope");
  await expect(
    page.getByRole("heading", { level: 1, name: /This one didn.t land\./ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Back home/ })).toBeVisible();
});

// Unknown scenario id lands on the curriculum with a clear notice (plan: "Error
// and failure behavior" — Unknown scenario ID).
test("/practice/fake-id redirects to the curriculum with a notice", async ({
  page,
}) => {
  await page.goto("/practice/fake-id");
  // The curriculum heading is present...
  await expect(
    page.getByRole("heading", { name: /Ten reps/ }),
  ).toBeVisible();
  // ...and a warm notice explains the redirect.
  await expect(page.getByText(/couldn.t find that scenario/i)).toBeVisible();
});
