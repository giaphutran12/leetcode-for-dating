import { expect, test } from "@playwright/test";

test("home page shows the RizzCode hero", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /Practice courage\./ }),
  ).toBeVisible();
});
