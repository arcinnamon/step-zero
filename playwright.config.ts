import { defineConfig, devices } from "@playwright/test";

// In the pipeline, BASE_URL is the Vercel preview. Locally it falls back to
// a production build on port 3000.
const baseURL = process.env.BASE_URL || "http://localhost:3000";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL,
    trace: "retain-on-failure",
    extraHTTPHeaders: bypass
      ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
