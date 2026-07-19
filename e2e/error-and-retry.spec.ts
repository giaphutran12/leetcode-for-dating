import { expect, test } from "@playwright/test";

// Judge failure and recovery in a real browser: abort /api/judge, complete three
// turns, confirm the error state preserves the transcript and offers Retry
// judgment, then restore the route and confirm the retry produces a result and
// awards XP exactly once (the curriculum XP does not double on a reload).
test("judge outage: transcript preserved, retry succeeds, XP awarded once", async ({
  page,
}) => {
  // Block the judge before the attempt reaches it.
  await page.route("**/api/judge", (route) => route.abort());

  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /Begin/ }).click();

  const composer = page.getByRole("textbox");
  const turns = [
    "what are you reading over there?",
    "how long have you been waiting for the bus?",
    "which bus are you catching?",
  ];
  for (const text of turns) {
    await composer.fill(text);
    await page.getByRole("button", { name: /Send/ }).click();
  }

  // Error state: the transcript is intact and Retry judgment is offered.
  await expect(page.getByRole("button", { name: "Retry judgment" })).toBeVisible();
  await expect(page.getByText("what are you reading over there?")).toBeVisible();
  await expect(page.getByText(/No score, no XP lost/)).toBeVisible();

  // Restore the judge and retry -> a real (mock-backed) result appears.
  await page.unroute("**/api/judge");
  await page.getByRole("button", { name: "Retry judgment" }).click();
  await expect(page.getByText(/\/ 10/)).toBeVisible();
  await expect(page.locator(".taste-rubric-row")).toHaveCount(5);

  // XP was awarded once: read it on the curriculum, then confirm a reload does not
  // grow it (no double-award across the error -> retry).
  await page.getByRole("link", { name: /Back to curriculum/ }).click();
  const xp = page
    .locator(".taste-stat-strip div", { hasText: "Practice XP" })
    .locator("strong");
  const earned = Number(await xp.textContent());
  expect(earned).toBeGreaterThan(0);

  await page.reload();
  await expect(
    page
      .locator(".taste-stat-strip div", { hasText: "Practice XP" })
      .locator("strong"),
  ).toHaveText(String(earned));
});
