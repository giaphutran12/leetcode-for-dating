import { expect, test } from "@playwright/test";

// Acceptance item 26: no provider credential is present in the browser bundle or
// in any browser-visible request/response during a full practice flow. We record
// every request body and text response the page sees, plus the served scripts and
// the final HTML, then assert nothing matches an OpenAI key pattern.
test("no OpenAI credential in the browser bundle or any browser-visible traffic", async ({
  page,
}) => {
  const captured: string[] = [];

  page.on("request", (request) => {
    const data = request.postData();
    if (data) captured.push(data);
  });

  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (
      type.includes("javascript") ||
      type.includes("json") ||
      type.includes("text/") ||
      type.includes("html")
    ) {
      try {
        captured.push(await response.text());
      } catch {
        // Some responses (redirects, 204s) have no readable body — ignore.
      }
    }
  });

  // Drive a full attempt so the judge request/response actually crosses the wire.
  await page.goto("/practice/spark-bus-stop");
  await page.getByRole("button", { name: /Begin/ }).click();
  const composer = page.getByRole("textbox");
  for (let i = 0; i < 3; i += 1) {
    await composer.fill("tell me a bit more about that");
    await page.getByRole("button", { name: /Send/ }).click();
  }
  await expect(page.getByText(/\/ 10/)).toBeVisible();

  captured.push(await page.content());

  const haystack = captured.join("\n");
  // An OpenAI secret key literal, or a leaked key value.
  expect(haystack).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
  // The server env var name must never appear in browser-visible material.
  expect(haystack).not.toContain("OPENAI_API_KEY");
});
