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
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
  await navigate(page, "My WhatsApp");
  await expect(
    page.getByRole("heading", { name: "My WhatsApp numbers." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Get my connection code" }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("textbox", { name: /Your connection code/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No groups found yet." }),
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
    scale: "css",
    path: `docs/screenshots/plogme-connections-${info.project.name}.png`,
    fullPage: true,
  });
  await navigate(page, "Send a post");
  await expect(
    page.getByRole("heading", { name: "Send a post to your groups." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "You have not sent a post yet." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Both 2x · Group status first, then group chat",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Both 2x · Group status first, then group chat",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Review & continue" }),
  ).toBeDisabled();
  await expect(page.getByText(/No groups found yet./)).toBeVisible();
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
    scale: "css",
    path: `docs/screenshots/plogme-broadcasts-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
