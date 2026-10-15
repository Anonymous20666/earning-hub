import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("earning is the primary story; exact rates and qualifying steps come before free broadcasting", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Get ready to earn.",
  );
  await expect(page.locator(".hero-description")).toContainText("Earn Coins");
  await expect(page.locator(".hero-copy")).not.toContainText(
    "Your own posts are free",
  );
  await expect(page.locator(".hero-availability")).toContainText(
    "Paid jobs and withdrawals are not open yet",
  );
  await expect(page.locator(".hero-availability")).toContainText(
    "Pairing your number does not earn Coins",
  );
  const ordered = await page.evaluate(() => {
    const selectors = [
      ".hero",
      "#earning-rates",
      "#how-it-works",
      ".earning-potential",
      "#the-rules",
      "#free-broadcasts",
    ];
    return selectors.every(
      (selector, i) =>
        i === 0 ||
        !!(
          document
            .querySelector(selectors[i - 1])!
            .compareDocumentPosition(document.querySelector(selector)!) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
    );
  });
  expect(ordered).toBe(true);
  for (const [members, amount] of [
    [100, "0.100"],
    [742, "0.742"],
    [1000, "1.000"],
  ] as const)
    await expect(
      page.locator(`.reward-rate-card[data-members="${members}"]`),
    ).toContainText(amount);
  await expect(page.locator(".reward-explainer")).toContainText("1.484 Coins");
  await expect(
    page
      .locator("#how-it-works")
      .getByRole("button", { name: "I want to earn", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#how-it-works")).toContainText(
    "Pair your own WhatsApp",
  );
  await expect(page.locator("#how-it-works")).toContainText(
    "Earn from confirmed paid posts",
  );
  await expect(page.locator("#free-broadcasts")).toContainText("free");
  await expect(page.locator("main")).not.toContainText(/₦|\bNGN\b|naira/i);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/earning-first-landing-${info.project.name}.png`,
    scale: "css",
    fullPage: true,
  });
  await page
    .locator(".hero-copy")
    .getByRole("link", { name: "Connect my WhatsApp", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/join\/worker$/);
  await expect(
    page.getByRole("heading", {
      name: "Get ready to earn with your groups.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".auth-form-wrap")).toContainText(
    "Paid jobs and cashout are not open yet",
  );
});
test("earning-first page has no overflow across phone, tablet and desktop widths and both extra tools remain usable", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Role provisioning stays in isolated QA",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Get ready to earn.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Free broadcasting", exact: true })
    .click();
  await expect(page.locator("#free-broadcasts")).toBeInViewport();
  await page
    .locator("#free-broadcasts")
    .getByRole("link", { name: "Start a free personal post", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/join\/worker$/);
  await page.goto("/");
  await page
    .locator("#how-it-works")
    .getByRole("button", { name: "I want to plan an ad", exact: true })
    .click();
  await expect(
    page
      .locator("#how-it-works")
      .getByRole("heading", { name: "Build your campaign", exact: true }),
  ).toBeVisible();
  await page
    .locator("#business-tools")
    .getByRole("link", { name: "Create an advertiser account", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/join\/advertiser$/);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Synthetic advertiser navigation QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(
      `earning-first-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-earning-navigation-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy.", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page
      .locator(".hero-copy")
      .getByRole("link", { name: "Open my workspace", exact: true }),
  ).toHaveAttribute("href", "#/app");
  await expect(
    page
      .locator("#earning-rates")
      .getByRole("link", { name: "Open my workspace", exact: true }),
  ).toHaveAttribute("href", "#/app");
  await expect(
    page
      .locator("#business-tools")
      .getByRole("link", { name: "Open my campaigns", exact: true }),
  ).toHaveAttribute("href", "#/app/campaigns");
});
