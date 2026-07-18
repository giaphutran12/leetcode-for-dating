import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("first visit to judged in-person result, XP, and returning refresh", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /skip with smart defaults/i }).click();
  await expect(page.getByText("Good. Now we know what to train.")).toBeVisible();
  await page.getByRole("link", { name: /run the bus-stop opening/i }).click();
  await page.getByRole("button", { name: /start conversation/i }).click();
  await expect(page.getByText("0 / 6")).toBeVisible();
  await expect(page.getByLabel("What would you say?")).toBeVisible();

  const composer = page.getByLabel("What would you say?");
  await composer.fill(
    "That ramen tote is elite. Is it a recommendation or a warning?",
  );
  await page.getByRole("button", { name: /send response/i }).dblclick();
  await expect(page.getByText("1 / 6")).toBeVisible();
  await expect(page.getByText(/Maya says/i)).toHaveCount(2);
  await expect(page.getByText("Your turn")).toBeVisible();

  await composer.fill(
    "Spicy miso is my ruling. What is your extremely serious answer?",
  );
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByText("2 / 6")).toBeVisible();
  await expect(page.getByText("Your turn")).toBeVisible();

  await composer.fill(
    "This was fun. Want to swap numbers and continue the ramen tribunal sometime?",
  );
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByText("3 / 6")).toBeVisible();
  await expect(page.getByText("Your turn")).toBeVisible();
  await page.getByRole("button", { name: /end & get judgment/i }).click();
  await expect(page.getByText("Official LLM judgment")).toBeVisible();
  await expect(page.getByText("Five-part rubric")).toBeVisible();
  await expect(page.getByText("Contact exchanged")).toBeVisible();
  await expect(page.getByText(/\+\d+ practice XP/)).toBeVisible();

  await page.goto("/practice");
  await expect(page.getByText("1/10")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1/10")).toBeVisible();
});

test("messaging mode, unknown routes, and narrow-screen containment", async ({
  page,
}) => {
  await page.goto("/practice/connection-keep-thread");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await expect(
    page.getByText(/second bánh xèo was edible/i),
  ).toBeVisible();
  await expect(page.getByLabel("What would you text?")).toBeVisible();

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  await page.goto("/practice");
  await expect(page.getByText("Locked")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /enter scenario/i }),
  ).toHaveCount(10);

  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText("This route has no game.")).toBeVisible();

  await page.goto("/practice/not-a-real-scenario");
  await expect(
    page.getByText(/scenario does not exist/i),
  ).toBeVisible();
});

test("judge failure preserves the transcript and offers retry", async ({
  page,
}) => {
  await page.route("**/api/judge", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        retryable: true,
        code: "judge_unavailable",
        message: "Simulated provider outage.",
      }),
    });
  });
  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /start conversation/i }).click();
  const composer = page.getByLabel("What would you say?");
  for (const line of [
    "That ramen tote is elite.",
    "Spicy miso wins. What is yours?",
    "This was fun. Take care.",
  ]) {
    await composer.fill(line);
    await page.getByRole("button", { name: /send response/i }).click();
    if (line !== "This was fun. Take care.") {
      await expect(page.getByText("Your turn")).toBeVisible();
    }
  }
  await expect(page.getByText("Judgment did not land.")).toBeVisible();
  await expect(page.getByText("Simulated provider outage.")).toBeVisible();
  await expect(page.getByText("That ramen tote is elite.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /retry judgment/i }),
  ).toBeVisible();
  await expect(page.getByText(/no score or xp was awarded/i)).toBeVisible();
});

test("reset invalidates an in-flight persona reaction", async ({ page }) => {
  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await page
    .getByLabel("What would you say?")
    .fill("That ramen tote is elite.");
  await page.getByRole("button", { name: /send response/i }).click();
  await page.getByRole("button", { name: /reset attempt/i }).click();

  await expect(page.getByText("0 / 6")).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.getByText("That ramen tote is elite.")).toHaveCount(0);
  await expect(page.getByText(/Maya says/i)).toHaveCount(0);
});

test("non-retryable persona conflicts require a clean reset", async ({ page }) => {
  await page.route("**/api/persona", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        retryable: false,
        code: "persona_conflict",
        message: "This turn no longer matches the server conversation.",
      }),
    });
  });
  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await page.getByLabel("What would you say?").fill("Hello there.");
  await page.getByRole("button", { name: /send response/i }).click();

  await expect(page.getByText("Reaction did not land.")).toBeVisible();
  await expect(page.getByText(/fell out of sync/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /retry reaction/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /reset attempt/i }),
  ).toBeVisible();
});

test("idle messaging drafts prepare a reply and sent bubbles reach seen", async ({
  page,
}) => {
  await page.route("**/api/persona", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto("/practice/connection-keep-thread");
  await page.getByRole("button", { name: /start conversation/i }).click();
  const composer = page.getByLabel("What would you text?");
  await composer.fill(
    "my first omelette became abstract art. what fixed yours?",
  );

  await expect(page.getByText("Mai is typing…")).toBeVisible({
    timeout: 6_000,
  });
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByLabel("Message sent")).toBeVisible();
  await expect(page.getByLabel("Message delivered")).toBeVisible();
  await expect(page.getByLabel("Message seen")).toBeVisible();
  await expect(page.getByText(/caught me off guard/i)).toBeVisible();
});
