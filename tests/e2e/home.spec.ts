import { expect, test } from "@playwright/test";

test("home page greets with Hola", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  const heading = page.getByRole("heading", { level: 1, name: "Hola" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveAttribute("lang", "es");
});
