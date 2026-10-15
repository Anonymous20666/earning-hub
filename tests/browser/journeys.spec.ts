import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
const password = "QA-local-only-unique-password!";
async function checkOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function nav(page: Page, label: string) {
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
async function register(page: Page, role: "worker" | "advertiser") {
  const email = `qa-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  await page.goto("/#/join/" + role);
  await page
    .getByLabel("Full name", { exact: true })
    .fill(role === "worker" ? "Review Worker" : "Review Advertiser");
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
test("landing, navigation, FAQs and honest service status", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good communities.",
  );
  await checkOverflow(page);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-landing.png`,
    fullPage: true,
  });
  await page
    .getByText("Can I earn or withdraw money right now?", { exact: true })
    .click();
  await expect(
    page.getByText(
      "Not yet. Messaging and payout integrations are not connected.",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "I’m an advertiser", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Build your campaign", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Service status", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What’s available today." }),
  ).toBeVisible();
  await expect(
    page.getByText("Payments & payouts", { exact: true }),
  ).toBeVisible();
  await checkOverflow(page);
  expect(errors).toEqual([]);
});
test("worker registration, persistence, wallet, support, settings, logout and login", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = await register(page, "worker");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Locked welcome bonus" })
      .getByText("200.000", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await checkOverflow(page);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-worker-overview.png`,
    fullPage: true,
  });
  await nav(page, "Wallet & rewards");
  await expect(
    page.getByRole("heading", { name: "Wallet ledger" }),
  ).toBeVisible();
  await expect(
    page.getByText("Payouts are not enabled.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-wallet.png`,
    fullPage: true,
  });
  await checkOverflow(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("pappy-wallet-ledger.csv");
  await nav(page, "Connections");
  await expect(
    page.getByRole("heading", { name: "Connections are not available yet." }),
  ).toBeVisible();
  await nav(page, "Support");
  await page.getByRole("button", { name: "New request" }).click();
  await page
    .getByLabel("Subject", { exact: true })
    .fill("Clarify bonus conditions");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please explain how the first withdrawal works.");
  await page.getByRole("button", { name: "Save support request" }).click();
  await expect(
    page.getByText("Clarify bonus conditions", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Clarify bonus conditions", { exact: true }),
  ).toBeVisible();
  await checkOverflow(page);
  await nav(page, "Account settings");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Review Worker Updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("updated");
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Review Worker Updated",
  );
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good communities.",
  );
  await page.goto("/#/app");
  await expect(
    page.getByRole("heading", { name: "A little closer to possibility." }),
  ).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little closer to possibility." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("advertiser creates, estimates, edits and deletes a persisted draft", async ({
  page,
}, info) => {
  await register(page, "advertiser");
  await nav(page, "Campaigns");
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Community launch plan");
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill("https://chat.whatsapp.com/review-only-destination");
  await page
    .getByLabel("Your campaign message", { exact: true })
    .fill("Review-only campaign draft. No messages will be sent.");
  await page
    .getByRole("button", { name: "Check estimate", exact: true })
    .click();
  await expect(
    page.getByText("PLANNING ESTIMATE · NOT A CHARGE", { exact: true }),
  ).toBeVisible();
  await checkOverflow(page);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-campaign-planning.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Community launch plan", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Community launch plan", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-campaigns.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit Community launch plan" })
    .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Updated community plan");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated community plan" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated community plan" })
    .click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your next campaign starts here." }),
  ).toBeVisible();
  await checkOverflow(page);
});
test("auth validation, password visibility and truthful reset state", async ({
  page,
}, info) => {
  await page.goto("/#/login");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-account-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No email has been sent",
  );
  await page
    .getByLabel("Email address", { exact: true })
    .fill("missing@example.test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await page.goto("/#/join/advertiser");
  await checkOverflow(page);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-registration.png`,
    fullPage: true,
  });
});
test("WCAG automated checks: landing, auth, workspace and campaign dialog", async ({
  page,
}, info) => {
  const all: any[] = [];
  async function audit(name: string) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    all.push({ name, violations: result.violations });
  }
  await page.goto("/");
  await audit("landing");
  await page.goto("/#/join/worker");
  await audit("auth");
  await register(page, "advertiser");
  await audit("workspace");
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await audit("campaign-dialog");
  await fs.mkdir("docs/testing", { recursive: true });
  await fs.writeFile(
    `docs/testing/axe-${info.project.name}.json`,
    JSON.stringify(all, null, 2),
  );
  const serious = all.flatMap((r) =>
    r.violations.map((v: any) => ({
      page: r.name,
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
    })),
  );
  expect(serious).toEqual([]);
});
