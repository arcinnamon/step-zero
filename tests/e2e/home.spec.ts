import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
