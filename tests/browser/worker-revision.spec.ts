import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public earning details, dollar-first conversion and both daily examples work without signup or earning money", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/coin-value");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your Coins, in your currency.",
  );
  await expect(page.locator(".coin-value-primary")).toContainText(
    "USD 0.000751",
  );
  await expect(page.locator(".coin-value-ngn")).toContainText("NGN 1.00");
  await page.getByLabel("See another currency").selectOption("GHS");
  await expect(page.locator(".coin-value-other output")).toContainText("GHS");
  await expect(page.locator(".coin-value")).toContainText("Not live rates");
  for (const [members, rate] of [
    [100, "0.100"],
    [742, "0.742"],
    [1000, "1.000"],
  ])
    await expect(page.locator(`[data-members="${members}"]`)).toContainText(
      String(rate),
    );
  await page
    .getByRole("navigation", { name: "Earning guide" })
    .getByRole("link", { name: "My group calculator" })
    .click();
  await page
    .getByLabel("Members in each unique qualifying group")
    .fill("100, 99, 1000");
  await expect(page.locator(".earning-result-amount")).toContainText("1.100");
  await page
    .getByRole("button", { name: "Try the 1,000-Coin daily example" })
    .click();
  await expect(page.locator(".earning-result-rows")).toContainText(
    "1,000.000 Coins",
  );
  await page
    .getByRole("button", { name: "Try the 5,000-Coin daily example" })
    .click();
  await expect(page.locator(".earning-result-rows")).toContainText(
    "5,000.000 Coins",
  );
  await expect(page.locator(".earning-formula")).toContainText(
    "250 such groups",
  );
  await expect(page.locator(".coin-value-primary")).toContainText("USD 3.75");
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
});
test("choose number two or both; searchable owned-group skip checkboxes persist and review stays explicit", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Isolated QA only; contract mocks, no WhatsApp connection or sends",
  );
  const groups = [
    {
      account_id: "SYNTHETIC-number-one",
      slot: 1,
      group_jid: "SYNTHETIC-shared@g.us",
      subject: "SYNTHETIC Alpha",
      member_count: 200,
      status: "ONLINE",
    },
    {
      account_id: "SYNTHETIC-number-two",
      slot: 2,
      group_jid: "SYNTHETIC-shared@g.us",
      subject: "SYNTHETIC Alpha",
      member_count: 200,
      status: "ONLINE",
    },
    {
      account_id: "SYNTHETIC-number-two",
      slot: 2,
      group_jid: "SYNTHETIC-two-only@g.us",
      subject: "SYNTHETIC Beta",
      member_count: 42,
      status: "ONLINE",
    },
  ];
  let ignored: any[] = [],
    prepared = 0,
    posts = 0;
  await page.route("**/api/broadcasts", (route) =>
    route.fulfill({
      json: {
        configured: true,
        accounts: [
          { id: "SYNTHETIC-number-one", slot: 1, status: "ONLINE" },
          { id: "SYNTHETIC-number-two", slot: 2, status: "ONLINE" },
        ],
        groups,
        ignoredGroups: ignored,
        runs: [],
      },
    }),
  );
  await page.route("**/api/personal-posts/ignores/select", async (route) => {
    const b = route.request().postDataJSON();
    expect(b).toEqual({ groupJid: groups[0].group_jid, ignored: true });
    ignored = [groups[0]];
    await route.fulfill({ json: { success: true } });
  });
  await page.route("**/api/personal-posts/prepare", async (route) => {
    const b = route.request().postDataJSON();
    expect(b.accountIds).toEqual(["SYNTHETIC-number-two"]);
    prepared++;
    await route.fulfill({
      json: {
        draftId: "SYNTHETIC-native-review",
        text: b.payload,
        mode: b.mode,
        plan: {
          accountIds: b.accountIds,
          targets: [
            {
              accountId: groups[2].account_id,
              slot: 2,
              groupJid: groups[2].group_jid,
              subject: groups[2].subject,
              members: 42,
            },
          ],
          skips: [
            {
              groupJid: groups[0].group_jid,
              subject: groups[0].subject,
              reason: "On your ignore list",
            },
          ],
          skippedSurfaces: [],
          sharedMemberships: 0,
        },
      },
    });
  });
  await page.route("**/api/personal-posts", (route) => {
    posts++;
    return route.fulfill({
      status: 400,
      json: { error: "Must not send in contract review test" },
    });
  });
  await page.goto("/#/join/worker");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC native revision QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`native-${info.project.name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("SYNTHETIC-strong-private-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
  await page.goto("/#/app/broadcasts");
  const one = page.getByRole("checkbox", { name: /Number 1/ }),
    two = page.getByRole("checkbox", { name: /Number 2/ });
  await expect(one).toBeChecked();
  await expect(two).toBeChecked();
  await one.uncheck();
  await expect(two).toBeChecked();
  await page.getByRole("button", { name: "Use both numbers" }).click();
  await expect(one).toBeChecked();
  await one.uncheck();
  await page.locator(".composer-ignore summary").click();
  await page.getByLabel("Search your groups").fill("Alpha");
  await expect(
    page.getByRole("checkbox", { name: "Skip SYNTHETIC Alpha" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Skip SYNTHETIC Beta" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Skip SYNTHETIC Alpha" }).check();
  await expect(
    page.getByRole("checkbox", { name: "Skip SYNTHETIC Alpha" }),
  ).toBeChecked();
  await page.getByLabel("Search your groups").fill("");
  await expect(
    page.getByRole("checkbox", { name: "Skip SYNTHETIC Beta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ask admin permission|Copy command/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Your text or link")
    .fill("SYNTHETIC personal test; never transmitted");
  const reviewButton = page.getByRole("button", { name: "Review & continue" });
  expect(
    await reviewButton.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        border: s.borderStyle,
        height: el.getBoundingClientRect().height,
      };
    }),
  ).toMatchObject({ background: "rgb(22, 62, 45)", border: "solid" });
  expect((await reviewButton.boundingBox())!.height).toBeGreaterThanOrEqual(52);
  await page.locator(".composer-panel").screenshot({
    path: `docs/screenshots/mobile-polish-write-${info.project.name}.png`,
    scale: "css",
  });
  await reviewButton.click();
  await expect(
    page.getByRole("heading", { name: "Is everything correct?" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Post to 1 group" }),
  ).toBeDisabled();
  await page
    .getByText("See the automatic group check", { exact: true })
    .click();
  await expect(
    page.getByText("Number 2 · 42 members · Ready · no earnings"),
  ).toBeVisible();
  const postButton = page.getByRole("button", { name: "Post to 1 group" });
  await page.getByRole("checkbox", { name: /I checked this post/ }).check();
  await expect(postButton).toBeEnabled();
  expect(
    await postButton.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(22, 62, 45)");
  expect((await postButton.boundingBox())!.height).toBeGreaterThanOrEqual(52);
  await expect(page.locator(".composer-limit-note")).toContainText(
    "No daily posting cap",
  );
  await expect(page.locator(".composer-limit-note")).not.toContainText(
    /3 posts|60 seconds|200 groups/,
  );
  await page.locator(".composer-panel").screenshot({
    path: `docs/screenshots/mobile-polish-review-${info.project.name}.png`,
    scale: "css",
  });
  expect(prepared).toBe(1);
  expect(posts).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/worker-native-review-${info.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
});
