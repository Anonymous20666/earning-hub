import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("landing has no design/playback controls; motion keeps running beyond five seconds, pauses offscreen and respects reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Get ready to earn.",
  );
  await expect(
    page.getByRole("button", { name: /Play movement|Pause movement|3D/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/3D-style illustration/)).toHaveCount(0);
  expect(
    await page.locator(".scene-phone").evaluate((el) => {
      const s = getComputedStyle(el);
      return s.animationName === "none" || s.animationPlayState === "paused";
    }),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.locator(".live-hero-scene").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  // Deliberately observe past the removed 4.5-second cutoff, not just the initial class.
  const frames = await page.locator(".scene-phone").evaluate(async (el) => {
    await new Promise((resolve) => setTimeout(resolve, 5500));
    const style = getComputedStyle(el),
      first = style.transform;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      first,
      second: getComputedStyle(el).transform,
      playState: getComputedStyle(el).animationPlayState,
    };
  });
  expect(frames.playState).toBe("running");
  expect(frames.first).not.toBe(frames.second);
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  await page.locator(".public-footer").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-paused/);
  await page.locator(".live-hero-scene").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-paused/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    scale: "css",
    path: `docs/screenshots/international-landing-${info.project.name}.png`,
    fullPage: true,
  });
});
test("overview guides a connected owner forward and approved small groups use automatic targeting with no earnings", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Synthetic display fixture is only allowed on isolated local QA",
  );
  await page.route("**/api/whatsapp", (route) =>
    route.fulfill({
      json: {
        configured: true,
        slots: [
          {
            id: "synthetic-slot",
            slot: 1,
            status: "ONLINE",
            account_id: "synthetic-account",
          },
        ],
      },
    }),
  );
  await page.route("**/api/broadcasts", (route) =>
    route.fulfill({
      json: {
        configured: true,
        limits: { maxGroups: 200, dailyRuns: 3, minGapSeconds: 60 },
        assets: [],
        runs: [],
        groups: [42, 99].map((n) => ({
          account_id: "synthetic-account",
          group_jid: `1203630000000000${n}@g.us`,
          subject: `SYNTHETIC small group ${n}`,
          member_count: n,
          slot: 1,
          status: "ONLINE",
          status_allowed: 1,
          chat_allowed: 1,
          mentions_allowed: 1,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
          announce: 0,
          user_is_admin: 1,
          excluded: 0,
        })),
      },
    }),
  );
  await page.goto("/#/join/worker");
  await page.getByLabel("Full name", { exact: true }).fill("Easy use QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`easy-${Date.now()}-${info.project.name}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-private-long-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your WhatsApp is connected." }),
  ).toBeVisible();
  await expect(
    page
      .locator(".quick-start")
      .getByRole("link", { name: "Explore earning rates", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".quick-start")
      .getByRole("link", { name: "Connect my WhatsApp", exact: true }),
  ).toHaveCount(0);
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
    path: `docs/screenshots/easy-connected-overview-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/app/broadcasts");
  await expect(
    page.getByRole("heading", { name: "Send a post to your groups." }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Select SYNTHETIC/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Your text or link")
    .fill("SYNTHETIC personal text only");
  await expect(
    page.getByRole("button", { name: "Review & continue" }),
  ).toBeEnabled();
  await expect(
    page.getByText(/All connected groups with the right admin permission/),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const wallet = await (
    await page.request.get(baseURL + "/api/workspace")
  ).json();
  expect(wallet.wallet.earned_milli).toBe(0);
  await page.screenshot({
    scale: "css",
    path: `docs/screenshots/easy-small-groups-${info.project.name}.png`,
    fullPage: true,
  });
});
