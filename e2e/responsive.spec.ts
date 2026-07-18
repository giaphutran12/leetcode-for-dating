import { expect, test, type Page } from "@playwright/test";

// No horizontal overflow at 375px across every key view, a full practice flow at
// mobile width, a >=44px submit tap target, and a 1440px desktop sanity render
// (plan: "Accessibility and responsive behavior").

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  // Allow a 1px rounding slack, per the plan's tolerance.
  expect(overflow).toBeLessThanOrEqual(1);
}

test("375px: no horizontal overflow across landing, curriculum, practice, result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Practice courage\./ }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/practice");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Full practice flow at mobile width.
  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /Begin/ }).click();
  await expectNoHorizontalOverflow(page);

  const composer = page.getByRole("textbox");
  await composer.fill("what are you reading over there?");

  // Tap-target spot check: the submit button is at least 44px tall.
  const submit = page.getByRole("button", { name: /Send/ });
  const box = await submit.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  for (let i = 0; i < 3; i += 1) {
    await composer.fill("tell me a bit more about that");
    await page.getByRole("button", { name: /Send/ }).click();
    if (i === 0) await expectNoHorizontalOverflow(page);
  }

  await expect(page.getByText(/\/ 10/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("1440px desktop sanity render", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Practice courage\./ }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
