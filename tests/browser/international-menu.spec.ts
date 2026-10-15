import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function signup(page: Page, name: string) {
  await page.goto("/#/join/worker");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC global menu QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`global-${name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-global-private-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
}
async function visit(page: Page, label: string) {
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveAttribute("aria-hidden", "true");
}
test("desktop and mobile menu starts closed, traps focus when opened, closes by Escape, outside click and navigation", async ({
  page,
  baseURL,
}, info) => {
  test.skip(!baseURL?.includes("127.0.0.1:3108"), "Only isolated QA");
  await signup(page, info.project.name);
  const menu = page.locator(".sidebar"),
    open = page.getByRole("button", { name: "Open navigation", exact: true });
  await expect(open).toBeVisible();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".app-content")
      .evaluate((el) => el.getBoundingClientRect().left),
  ).toBe(0);
  await open.click();
  await expect(
    page.getByRole("dialog", { name: "Workspace menu" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".app-content")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Sign out", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(menu.locator("a").first()).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/international-menu-${info.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-hidden", "true");
  await expect(open).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open.click();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Close navigation backdrop", exact: true })
    .click({
      position: { x: info.project.name === "mobile" ? 350 : 800, y: 200 },
    });
  await expect(menu).toHaveAttribute("aria-hidden", "true");
  await visit(page, "Referrals");
  await expect(page.locator(".workspace-banner")).toContainText("100 Coins");
  await expect(page.locator("main")).not.toContainText(/₦|\bNGN\b|naira/i);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("international Coins-first copy, honest daily example and calculator agree without creating an earning balance", async ({
  page,
  baseURL,
}, info) => {
  test.skip(!baseURL?.includes("127.0.0.1:3108"), "Only isolated QA");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /1,000-Coin day/ }),
  ).toBeVisible();
  await expect(page.locator(".potential-example")).toContainText("50");
  await expect(page.locator(".potential-example")).toContainText(
    "Paid jobs and cashout are not open yet",
  );
  await expect(page.locator("main")).not.toContainText(
    /₦|\bNGN\b|naira|3D-style/i,
  );
  await signup(page, "potential-" + info.project.name);
  await visit(page, "Earning calculator");
  await page
    .getByRole("button", { name: "Try the 1,000-Coin daily example" })
    .click();
  await expect(page.getByLabel("Post type", { exact: true })).toHaveValue(
    "DOUBLE",
  );
  await expect(
    page.getByLabel("Hypothetical broadcasts in one day"),
  ).toHaveValue("10");
  await expect(page.locator(".earning-result-rows")).toContainText(
    "1,000.000 Coins",
  );
  await expect(page.locator("main")).not.toContainText(/₦|\bNGN\b|naira/i);
  const state = await (await page.request.get("/api/workspace")).json();
  expect(state.wallet.earned_milli).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/international-calculator-${info.project.name}.png`,
    fullPage: true,
  });
});
