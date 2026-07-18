import { expect, test } from "@playwright/test";

// The plan's End-to-end path, in a real browser against the mock-judge dev server:
// landing -> onboarding (completed with real interactions) -> recommended scenario
// -> author three responses -> input-sensitive result -> XP -> curriculum -> reload
// -> progress preserved.
test("first visit: onboarding, a scored attempt, XP, and progress that survives reload", async ({
  page,
}) => {
  await page.goto("/");

  // Landing: a first-timer's primary CTA is the four-question warm-up.
  await page.getByRole("link", { name: "Start with four questions" }).first().click();

  // Onboarding, completed step by step.
  await page.getByLabel("Your name (optional)").fill("Sam");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Talk naturally" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page
    .getByRole("textbox", { name: /catches your attention/ })
    .fill("funny, curious, into live music");
  await page.getByRole("button", { name: "Next" }).click();
  await page
    .getByRole("textbox", { name: /relationship or shared life/ })
    .fill("a real partner to build with");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "I freeze in person" }).click();
  await page.getByRole("button", { name: /See my starting line/ }).click();

  // Starting line -> straight into the recommended scenario.
  await page.getByRole("link", { name: /^Start:/ }).click();
  await page.getByRole("button", { name: /Begin/ }).click();

  // Author three responses. Neutral, signal-free text keeps the persona engaged
  // through all three turns.
  const composer = page.getByRole("textbox");
  for (let i = 0; i < 3; i += 1) {
    await composer.fill("tell me a bit more about that");
    await page.getByRole("button", { name: /Send/ }).click();
  }

  // Result: a score out of ten, a verdict, and exactly five rubric criteria.
  await expect(page.getByText(/\/ 10/)).toBeVisible();
  await expect(
    page.locator(".taste-chip--lg"),
  ).toHaveText(/ATE|COOKED|FUMBLED/);
  await expect(page.locator(".taste-rubric-row")).toHaveCount(5);
  // XP was awarded and is visible on the result.
  await expect(page.getByText(/practice XP/)).toBeVisible();

  // Back to the curriculum: XP is now non-zero and the scenario reads complete.
  await page.getByRole("link", { name: /Back to curriculum/ }).click();
  const xpValue = page
    .locator(".taste-stat-strip div", { hasText: "Practice XP" })
    .locator("strong");
  const earned = Number(await xpValue.textContent());
  expect(earned).toBeGreaterThan(0);
  await expect(page.getByText(/Best \d+\/10/).first()).toBeVisible();

  // Reload: progress is preserved.
  await page.reload();
  await expect(
    page
      .locator(".taste-stat-strip div", { hasText: "Practice XP" })
      .locator("strong"),
  ).toHaveText(String(earned));
  await expect(page.getByText(/Best \d+\/10/).first()).toBeVisible();
});
