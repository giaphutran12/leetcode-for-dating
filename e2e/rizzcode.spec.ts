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
  await page.getByRole("link", { name: /run the delayed bus/i }).click();
  await page.getByRole("button", { name: /start conversation/i }).click();
  await expect(page.getByText("0 / 6")).toBeVisible();
  await expect(page.getByLabel("What would you say?")).toBeVisible();

  const composer = page.getByLabel("What would you say?");
  await composer.fill(
    "That arrival board has betrayed us twice. Does it ever tell the truth?",
  );
  await page.getByRole("button", { name: /send response/i }).dblclick();
  await expect(page.getByText("1 / 6")).toBeVisible();
  await expect(page.getByText(/Maya says/i)).toHaveCount(1);
  await expect(page.getByText("Your turn")).toBeVisible();

  await composer.fill(
    "I biked yesterday and somehow chose this chaos today. What about you?",
  );
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByText("2 / 6")).toBeVisible();
  await expect(page.getByText("Your turn")).toBeVisible();

  await composer.fill(
    "This was a good distraction. Looks like the bus is here, take care.",
  );
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByText("3 / 6")).toBeVisible();
  await expect(page.getByText("Official RizzCode verdict")).toBeVisible();
  await expect(page.getByText("Five-part rubric")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Graceful exit" }),
  ).toBeVisible();
  const scoreBox = await page.locator(".rizz-score-disc strong").boundingBox();
  const scoreLabelBox = await page
    .locator(".rizz-score-disc span")
    .boundingBox();
  expect(scoreBox).not.toBeNull();
  expect(scoreLabelBox).not.toBeNull();
  expect(scoreBox!.y + scoreBox!.height).toBeLessThan(scoreLabelBox!.y);
  await expect(page.getByText(/\+\d+ practice XP/)).toBeVisible();

  await page.goto("/practice");
  await expect(page.getByText("1/67")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1/67")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("1 completed rep shown")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset progress" }),
  ).toHaveCount(0);
  const activityRegion = page.getByRole("region", {
    name: /activity calendar/i,
  });
  await expect(activityRegion).toBeVisible();
  const completedDay = page.getByLabel(/1 completed practice attempt/i);
  await completedDay.hover();
  await expect(page.getByRole("tooltip")).toContainText("Nice work.");
  const scrollPosition = await activityRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  if (scrollPosition.scrollWidth > scrollPosition.clientWidth) {
    expect(scrollPosition.scrollLeft).toBeGreaterThan(0);
  }
});

test("messaging mode, unknown routes, and narrow-screen containment", async ({
  page,
}) => {
  await page.goto("/practice/RC-035");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await expect(
    page.getByText(/commute took ninety minutes/i),
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
  ).toHaveCount(67);

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
  await page.goto("/practice/RC-001");
  await page.getByRole("button", { name: /start conversation/i }).click();
  const composer = page.getByLabel("What would you say?");
  for (const line of [
    "That delay board is optimistic.",
    "I biked yesterday. What about you?",
    "This was fun. Take care.",
  ]) {
    await composer.fill(line);
    await page.getByRole("button", { name: /send response/i }).click();
    if (line !== "This was fun. Take care.") {
      await expect(page.getByText("Your turn")).toBeVisible();
    }
  }
  await expect(page.getByText("The judge is offline.")).toBeVisible();
  await expect(page.getByText("Simulated provider outage.")).toBeVisible();
  await expect(page.getByText("Error code: judge_unavailable")).toBeVisible();
  await expect(page.getByText("That delay board is optimistic.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /retry judgment/i }),
  ).toBeVisible();
  await expect(page.getByText(/no score or xp was awarded/i)).toBeVisible();
});

test("reset invalidates an in-flight persona reaction", async ({ page }) => {
  await page.goto("/practice/RC-001");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await page
    .getByLabel("What would you say?")
    .fill("That delay board is optimistic.");
  await page.getByRole("button", { name: /send response/i }).click();
  await page.getByRole("button", { name: /reset attempt/i }).click();

  await expect(page.getByText("0 / 6")).toBeVisible();
  await page.waitForTimeout(350);
  await expect(page.getByText("That delay board is optimistic.")).toHaveCount(0);
  await expect(page.getByText(/Maya says/i)).toHaveCount(0);
});

test("authored fallback stays playable without exposing provider internals", async ({
  page,
}) => {
  await page.route("**/api/persona", async (route) => {
    const request = route.request().postDataJSON() as {
      attemptId: string;
      scenarioId: string;
      turn: number;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        attemptId: request.attemptId,
        scenarioId: request.scenarioId,
        turn: request.turn,
        reply: {
          actions: [
            {
              kind: "text",
              body: "Yeah, I know the host from work.",
              delayMs: 180,
            },
          ],
          move: "reveal",
          state: {
            engagement: "neutral",
            boundary: "none",
            terminal: false,
            energy: "matched",
            recentMoves: ["reveal"],
            questionStreak: 0,
            callbackSeeds: [],
          },
          interestChange: "same",
          terminalReason: null,
        },
        usedFallback: true,
        sessionToken: "x".repeat(80),
      }),
    });
  });

  await page.goto("/practice/RC-005");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await page.getByLabel("What would you say?").fill("ayyo waht up");
  await page.getByRole("button", { name: /send response/i }).click();

  await expect(
    page.getByText("Yeah, I know the host from work."),
  ).toBeVisible();
  await expect(page.getByText(/AI reaction failed/i)).toHaveCount(0);
  await expect(page.getByLabel("What would you say?")).toBeVisible();
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
  await page.goto("/practice/RC-001");
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

test("practice limit uses a positive upgrade state without a sync error", async ({
  page,
}) => {
  await page.route("**/api/persona", async (route) => {
    await route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        retryable: false,
        code: "practice_limit_reached",
        message:
          "You used all your free training. Pick a plan to keep practicing.",
      }),
    });
  });
  await page.goto("/practice/RC-002");
  await page.getByRole("button", { name: /start conversation/i }).click();
  await page.getByLabel("What would you say?").fill("The left one looks cool.");
  await page.getByRole("button", { name: /send response/i }).click();

  await expect(page.getByText("Free training complete.")).toBeVisible();
  await expect(
    page.getByText(
      "You used all your free training. Pick a plan to keep practicing.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
  await expect(page.getByText("Reaction did not land.")).toHaveCount(0);
  await expect(page.getByText(/fell out of sync/i)).toHaveCount(0);
});

test("idle messaging drafts prepare a reply and sent bubbles reach seen", async ({
  page,
}) => {
  await page.route("**/api/persona", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto("/practice/RC-035");
  await page.getByRole("button", { name: /start conversation/i }).click();
  const composer = page.getByLabel("What would you text?");
  await composer.fill(
    "ninety minutes is brutal. my presentation survived somehow. how are you recovering?",
  );

  await expect(page.getByText("Maya is typing…")).toBeVisible({
    timeout: 6_000,
  });
  await page.getByRole("button", { name: /send response/i }).click();
  await expect(page.getByLabel("Message sent")).toBeVisible();
  await expect(page.getByLabel("Message delivered")).toBeVisible();
  await expect(page.getByLabel("Message seen")).toBeVisible();
  await expect(page.getByText(/caught me off guard/i)).toBeVisible();
});
