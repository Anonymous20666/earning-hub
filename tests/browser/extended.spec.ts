import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
const password = "Local-isolated-QA-password-2026";
async function signup(page: Page, role = "worker") {
  const email = `extended-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.goto("/#/join/" + role);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Local review account");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  return email;
}
test("worker subpages: accessibility, no horizontal overflow, keyboard dialog dismissal", async ({
  page,
}, info) => {
  await signup(page);
  const results: any[] = [];
  for (const [route, title] of [
    ["wallet", "Every Coin, accounted for."],
    ["connections", "Your community connections."],
    ["support", "A little help goes a long way."],
    ["settings", "Make yourself at home."],
    ["status", "Built on clear expectations."],
  ]) {
    await page.goto("/#/app/" + route);
    await expect(
      page.getByRole("heading", { level: 1, name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({ route, violations: a.violations });
  }
  await page.goto("/#/app/support");
  await page.getByRole("button", { name: "New request" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New request" })).toBeFocused();
  await fs.writeFile(
    `docs/testing/axe-worker-pages-${info.project.name}.json`,
    JSON.stringify(results, null, 2),
  );
  expect(
    results.flatMap((x) =>
      x.violations.map((v: any) => ({
        route: x.route,
        id: v.id,
        nodes: v.nodes.map((n: any) => n.target),
      })),
    ),
  ).toEqual([]);
});
test("admin UI is only reached by server-provisioned role in isolated QA database", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Never provision admin in a remote or review database",
  );
  const email = await signup(page, "advertiser");
  const db = new DatabaseSync("data/qa.sqlite");
  db.prepare("UPDATE users SET role='ADMIN' WHERE email=?").run(email);
  db.close();
  await page.goto("/#/app/admin");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clear view of the platform." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent accounts", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (await page.getByLabel("Staff reply", { exact: true }).count()) {
    await page
      .getByLabel("Staff reply", { exact: true })
      .first()
      .fill("A real staff reply saved during an isolated QA check.");
    await page
      .getByRole("button", { name: "Save reply", exact: true })
      .first()
      .click();
    await expect(page.getByRole("status")).toContainText("Reply saved");
  }
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-admin-qa.png`,
    fullPage: false,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await fs.writeFile(
    `docs/testing/axe-admin-${info.project.name}.json`,
    JSON.stringify({ violations: axe.violations }, null, 2),
  );
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
