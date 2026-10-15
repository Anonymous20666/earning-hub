import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
async function register(page: Page, name: string) {
  await page.goto("/#/join/worker");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC composer QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`composer-${name}-${Date.now()}@example.test`);
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
  await page.goto("/#/app/broadcasts");
  await expect(
    page.getByRole("heading", { name: "Send a post to your groups." }),
  ).toBeVisible();
}
const groups = [42, 99, 120].map((n, i) => ({
  account_id: "SYNTHETIC-account",
  group_jid: `SYNTHETIC-${n}@g.us`,
  subject: `SYNTHETIC group ${n}`,
  member_count: n,
  slot: 1,
  status: "ONLINE",
  status_allowed: 1,
  chat_allowed: 1,
  mentions_allowed: 1,
  expires_at: "2099-01-01",
  revoked_at: null,
  announce: 0,
  user_is_admin: 1,
  excluded: 0,
}));
async function axe(page: Page) {
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
}
test("Text/link -> many ignore links -> immutable review -> confirm -> real-event contract console, with reload but no resend", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Only isolated QA; synthetic network contract, never WhatsApp",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const img = (
    await sharp({
      create: { width: 640, height: 320, channels: 3, background: "#45633e" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
  let ignored: any[] = [],
    prepared: any,
    submits = 0,
    done = false;
  const run = "SYNTHETIC-personal-run",
    at = "2026-10-15T10:15:30.000Z";
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        configured: true,
        serverNow: at,
        limits: { dailyRuns: null, minGapSeconds: 0, maxGroups: null },
        groups,
        ignoredGroups: ignored,
        runs: submits
          ? [
              {
                id: run,
                mode: "ALLSTATUS",
                status: done ? "FINISHED" : "RUNNING",
                created_at: at,
                placements: 2,
                submitted: done ? 1 : 0,
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/personal-posts/ignores", async (r) => {
    expect(r.request().postDataJSON().links).toHaveLength(2);
    ignored = [{ group_jid: groups[2].group_jid, subject: groups[2].subject }];
    await r.fulfill({ json: { ignored } });
  });
  await page.route("**/api/personal-posts/prepare", async (r) => {
    prepared = r.request().postDataJSON();
    expect(prepared.targets).toBeUndefined();
    await r.fulfill({
      json: {
        draftId: "SYNTHETIC-review",
        kind: "TEXT",
        mode: prepared.mode,
        text: "SYNTHETIC extracted title\n\n" + prepared.payload,
        preview: {
          title: "SYNTHETIC extracted title",
          description: "SYNTHETIC website description",
          image: `data:image/jpeg;base64,${img}`,
        },
        plan: {
          targets: groups.slice(0, 2).map((g) => ({
            groupJid: g.group_jid,
            subject: g.subject,
            members: g.member_count,
          })),
          skips: [
            {
              groupJid: groups[2].group_jid,
              subject: groups[2].subject,
              reason: "On your ignore list",
            },
          ],
          totalGroups: 3,
          sharedMemberships: 1,
        },
      },
    });
  });
  await page.route("**/api/personal-posts", async (r) => {
    expect(r.request().postDataJSON()).toEqual({
      draftId: "SYNTHETIC-review",
      confirmed: true,
    });
    submits++;
    await r.fulfill({ json: { id: run } });
  });
  const events = [
    {
      id: 1,
      kind: "CHECKING",
      group_name: groups[0].subject,
      placement_id: "p1",
      message: "Group status · checking current membership and permission",
      created_at: at,
    },
    {
      id: 2,
      kind: "SENDING",
      group_name: groups[0].subject,
      placement_id: "p1",
      message: "Group status · attempting to send",
      created_at: at,
    },
    {
      id: 3,
      kind: "ACCEPTED",
      group_name: groups[0].subject,
      placement_id: "p1",
      message: "Group status · sent to WhatsApp. Delivery is not confirmed",
      created_at: at,
    },
    {
      id: 4,
      kind: "SENDING",
      group_name: groups[1].subject,
      placement_id: "p2",
      message: "Group status · attempting to send",
      created_at: at,
    },
    {
      id: 5,
      kind: "UNCERTAIN",
      group_name: groups[1].subject,
      placement_id: "p2",
      message:
        "Sending began but the outcome is uncertain. Check WhatsApp before starting another post.",
      created_at: at,
    },
    {
      id: 6,
      kind: "DONE",
      message: "Finished. Acceptance is not delivery proof.",
      created_at: at,
    },
  ];
  await page.route("**/api/personal-posts/*/events?*", (r) => {
    const cursor = Number(new URL(r.request().url()).searchParams.get("after"));
    const batch = done
      ? events.filter((e) => e.id > cursor)
      : cursor === 0
        ? events.slice(0, 2)
        : events.filter((e) => e.id > cursor);
    if (cursor >= 2) done = true;
    return r.fulfill({
      json: {
        run: {
          id: run,
          mode: "ALLSTATUS",
          status: done ? "FINISHED" : "RUNNING",
        },
        summary: {
          total: 2,
          pending: done ? 0 : 2,
          accepted: done ? 1 : 0,
          failed: 0,
          uncertain: done ? 1 : 0,
          cancelled: 0,
          skippedGroups: 1,
        },
        events: batch,
        hasMore: false,
        serverNow: at,
      },
    });
  });
  await register(page, info.project.name);
  await expect(
    page.getByRole("button", { name: /Text Write a message/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: /Select/ })).toHaveCount(0);
  await page
    .getByLabel("Your text or link")
    .fill("Text before\nhttps://example.com\nKeep my attached text 🎉");
  await page.locator(".composer-ignore summary").click();
  await page
    .getByLabel("Ignore group invite link 1", { exact: true })
    .fill("https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV");
  await page.getByRole("button", { name: "Add another group link" }).click();
  await page
    .getByLabel("Ignore group invite link 2", { exact: true })
    .fill("https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUW");
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Is everything correct?" }),
  ).toBeFocused();
  const post = page.getByRole("button", { name: "Post to all 2 groups" });
  await expect(post).toBeDisabled();
  await expect(page.locator(".review-message")).toContainText(
    "Keep my attached text 🎉",
  );
  await expect(page.locator(".review-link-card img")).toBeVisible();
  await page
    .getByText("See the automatic group check", { exact: true })
    .click();
  await expect(
    page.getByText("Number — · 42 members · Ready · no earnings"),
  ).toBeVisible();
  await expect(page.getByText("Skipped — On your ignore list")).toBeVisible();
  expect(submits).toBe(0);
  await axe(page);
  await page.screenshot({
    scale: "css",
    path: `docs/screenshots/composer-review-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("checkbox", {
      name: "I checked this post and have permission to share it with these groups.",
    })
    .check();
  await post.click();
  const console = page.locator(".broadcast-console");
  await expect(
    console.getByText("Finished — please check results", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(console.getByText("SENT TO WA", { exact: true })).toBeVisible();
  await expect(console.getByText("UNCERTAIN", { exact: true })).toBeVisible();
  await expect(console.locator(".broadcast-clock")).toContainText(
    "Lagos · UTC+1",
  );
  await expect(console.locator(".broadcast-clock time")).toContainText(
    "11:15:",
  );
  expect(submits).toBe(1);
  await axe(page);
  await page.screenshot({
    scale: "css",
    path: `docs/screenshots/composer-console-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    console.getByText("Finished — please check results", { exact: true }),
  ).toBeVisible();
  expect(submits).toBe(1);
  expect(errors).toEqual([]);
});
test("Media upload contract retains its caption; invalid ignore link blocks review without sending", async ({
  page,
  baseURL,
}, info) => {
  test.skip(!baseURL?.includes("127.0.0.1:3108"), "Only isolated QA");
  let prepares = 0,
    posts = 0;
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        configured: true,
        limits: { dailyRuns: null, minGapSeconds: 0, maxGroups: null },
        groups,
        ignoredGroups: [],
        runs: [],
      },
    }),
  );
  await page.route("**/api/personal-posts/ignores", (r) =>
    r.fulfill({
      status: 400,
      json: {
        error: "Use a group invite link beginning https://chat.whatsapp.com/",
      },
    }),
  );
  await page.route("**/api/personal-posts/prepare", (r) => {
    prepares++;
    return r.fulfill({
      status: 400,
      json: { error: "Synthetic test does not queue" },
    });
  });
  await page.route("**/api/personal-posts", (r) => {
    posts++;
    return r.fulfill({ status: 400, json: { error: "Must not send" } });
  });
  await register(page, "media-" + info.project.name);
  await page
    .getByRole("button", { name: "Media Upload a photo or video", exact: true })
    .click();
  const file = await sharp({
    create: { width: 300, height: 150, channels: 3, background: "#506242" },
  })
    .png()
    .toBuffer();
  await page.route("**/api/broadcast-assets", (r) =>
    r.fulfill({
      json: {
        id: "SYNTHETIC-private-asset",
        mime: "image/png",
        bytes: file.length,
      },
    }),
  );
  await page.route("**/api/broadcast-assets/SYNTHETIC-private-asset", (r) =>
    r.fulfill({ contentType: "image/png", body: file }),
  );
  await page.getByLabel("Upload your photo or video").setInputFiles({
    name: "SYNTHETIC-qa-only.png",
    mimeType: "image/png",
    buffer: file,
  });
  await expect(page.getByAltText("Your uploaded post")).toBeVisible();
  await page.getByLabel("Caption (optional)").fill("SYNTHETIC media caption");
  await page.locator(".composer-ignore summary").click();
  await page
    .getByLabel("Ignore group invite link 1", { exact: true })
    .fill("https://evil.example/not-whatsapp");
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Use a group invite link",
  );
  expect(prepares).toBe(0);
  expect(posts).toBe(0);
  await axe(page);
});
