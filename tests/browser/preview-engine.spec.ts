import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
test("public share metadata serves a real local image, correct robots policy and no invented social identity", async ({
  page,
}) => {
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('property="og:image"');
  expect(html).toContain("1200");
  expect(html).toContain("noindex,nofollow");
  expect(html).not.toContain("twitter:creator");
  const image = await page.request.get("/social-card-v1.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://pappy-earnig-hub.duckdns.org/social-card-v1.png",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});
test("review displays a real thumbnail or an honest retry warning, with no fake thumbnail and no post sent", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Synthetic local UI test only; never register production accounts or send messages",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const image =
    "data:image/png;base64," +
    readFileSync(
      new URL("../../public/social-card-v1.png", import.meta.url),
    ).toString("base64");
  let full = false,
    posts = 0;
  const groups = [
    {
      account_id: "SYNTHETIC-preview-account",
      slot: 1,
      group_jid: "SYNTHETIC-preview@g.us",
      subject: "SYNTHETIC 1-member group",
      member_count: 1,
      status: "ONLINE",
    },
  ];
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        configured: true,
        accounts: [{ id: groups[0].account_id, slot: 1, status: "ONLINE" }],
        groups,
        ignoredGroups: [],
        runs: [],
        serverNow: new Date().toISOString(),
      },
    }),
  );
  await page.route("**/api/personal-posts/prepare", (r) => {
    const body = r.request().postDataJSON();
    return r.fulfill({
      json: {
        draftId: "SYNTHETIC-preview-only",
        mode: body.mode,
        text: body.payload,
        delaySeconds: 10,
        preview: {
          title: "SYNTHETIC channel",
          description: "Channel • 2 followers",
          image: full ? image : null,
        },
        plan: {
          targets: [
            {
              accountId: groups[0].account_id,
              groupJid: groups[0].group_jid,
              subject: groups[0].subject,
              members: 1,
              slot: 1,
            },
          ],
          skips: [],
          skippedSurfaces: [],
          sharedMemberships: 0,
        },
      },
    });
  });
  await page.route("**/api/personal-posts", (r) => {
    posts++;
    return r.fulfill({
      status: 500,
      json: { error: "No send permitted in this test" },
    });
  });
  await page.goto("/#/join/worker");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC preview QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`preview-${info.project.name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("SYNTHETIC-preview-private-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
  await page.goto("/#/app/broadcasts");
  await page
    .getByLabel("Your text or link")
    .fill("https://example.com/SYNTHETIC-no-network");
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(page.locator('.review-link-card [role="status"]')).toContainText(
    "thumbnail",
  );
  await expect(page.locator(".review-link-card img")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to edit" }).click();
  full = true;
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(page.locator(".review-link-card img")).toBeVisible();
  await expect(page.locator('.review-link-card [role="status"]')).toHaveCount(
    0,
  );
  expect(
    await page
      .locator(".review-link-card img")
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBe(1200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/preview-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .locator(".review-link-card")
    .screenshot({
      path: `docs/screenshots/preview-card-${info.project.name}.png`,
    });
  expect(posts).toBe(0);
  expect(errors).toEqual([]);
});
