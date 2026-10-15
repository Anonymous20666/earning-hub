import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
async function fillSignup(page: Page) {
  const email = `funding-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Isolated funding QA");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-browser-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Welcome to Pappy.",
    }),
  ).toBeVisible();
  return email;
}
async function check(page: Page, route: string, project: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await fs.writeFile(
    `docs/testing/axe-funding-${route}-${project}.json`,
    JSON.stringify({ violations: axe.violations }, null, 2),
  );
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    scale: "css",
    path: `docs/screenshots/funding-${project}-${route}.png`,
    // Treasury drafts accumulate across isolated QA runs; an unbounded high-DPR
    // full-page bitmap can crash Chromium after all functional assertions pass.
    fullPage: route !== "treasury",
  });
}
test("earning pages show exact illustration, empty real inventory, and a real pending referral through the share link", async ({
  page,
  browser,
}, info) => {
  await page.goto("/#/join/worker");
  await fillSignup(page);
  await page.goto("/#/app/calculator");
  await expect(
    page.getByRole("heading", { name: "What would a broadcast earn?" }),
  ).toBeVisible();
  await expect(page.locator(".earning-result-amount strong")).toHaveText(
    "0.000",
  );
  await page
    .getByRole("button", { name: "Try the agreed four-group example" })
    .click();
  await expect(page.locator(".earning-result-amount strong")).toHaveText(
    "1.290",
  );
  await page
    .getByLabel("Hypothetical broadcasts in one day")
    .selectOption("10");
  await expect(page.locator(".earning-result-rows")).toContainText(
    "12.900 Coins",
  );
  await check(page, "calculator", info.project.name);
  await page.goto("/#/app/connections");
  await expect(
    page.getByRole("heading", { name: "No groups found yet." }),
  ).toBeVisible();
  await expect(page.locator(".number-slot")).toHaveCount(2);
  await check(page, "connections", info.project.name);
  await page.goto("/#/app/referrals");
  await expect(page.getByLabel("Your referral link")).toHaveValue(
    /ref=[a-f0-9]{20}$/,
  );
  const link = await page.getByLabel("Your referral link").inputValue();
  const friend = await browser.newContext({ viewport: page.viewportSize()! });
  const friendPage = await friend.newPage();
  await friendPage.goto(link);
  await expect(friendPage.getByLabel("Referral code (optional)")).toHaveValue(
    link.split("ref=")[1],
  );
  await fillSignup(friendPage);
  await friend.close();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".earning-stat").nth(0)).toContainText("1");
  await expect(page.locator(".earning-stat").nth(1)).toContainText("100.000");
  await expect(page.locator(".earning-stat").nth(2)).toContainText("0.000");
  await check(page, "referrals", info.project.name);
  await page.goto("/#/app/wallet");
  await expect(
    page.getByText("Payouts are not enabled.", { exact: true }),
  ).toBeVisible();
});
test("isolated admin can save a real house draft but cannot allocate imaginary funding", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Never provision roles in a public database",
  );
  await page.goto("/#/join/advertiser");
  const email = await fillSignup(page);
  const db = new DatabaseSync(process.env.QA_DATABASE_PATH || "data/qa.sqlite");
  db.prepare("UPDATE users SET role='ADMIN' WHERE email=?").run(email);
  db.close();
  const title = `Isolated zero-funding ${info.project.name}-${Date.now()}`;
  await page.goto("/#/app/treasury");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Funding control centre" }),
  ).toBeVisible();
  await page.getByLabel("Campaign title", { exact: true }).fill(title);
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill("https://example.test/consented");
  await page.getByLabel("Worker-reward budget in Coins").fill("30.000");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic approved content for browser testing only.");
  await page.getByRole("button", { name: "Save unfunded draft" }).click();
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Reserve verified funds" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Insufficient verified available cash",
  );
  await expect(
    row.getByRole("cell", { name: "DRAFT", exact: true }),
  ).toBeVisible();
  await check(page, "treasury", info.project.name);
});
