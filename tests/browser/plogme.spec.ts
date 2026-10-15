import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function navigate(page: Page, label: string) {
  const open = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await open.isVisible()) await open.click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
}
test("private pairing and personal composer are accessible, responsive and never simulate a number or delivery", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/join/worker");
  await page.getByLabel("Full name", { exact: true }).fill("Plogme QA owner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`plogme-${Date.now()}-${info.project.name}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-strong-private-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await navigate(page, "Connections");
  await expect(
    page.getByRole("heading", { name: "Room for two connections." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate private code" }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: /Private pairing code/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No groups scanned yet." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/plogme-connections-${info.project.name}.png`,
    fullPage: true,
  });
  await navigate(page, "Personal broadcasts");
  await expect(
    page.getByRole("heading", { name: "Choose where your message goes." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No personal broadcasts yet." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "2x Group status first, then group chat" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "2x Group status first, then group chat",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Queue personal 2x broadcast" }),
  ).toBeDisabled();
  await expect(
    page.getByText("No connected group inventory yet."),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/plogme-broadcasts-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
