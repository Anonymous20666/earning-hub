import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3108",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /chrome-motion\.spec\.ts/,
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      testIgnore: /chrome-motion\.spec\.ts/,
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "android-motion",
      testMatch: /chrome-motion\.spec\.ts/,
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
});
