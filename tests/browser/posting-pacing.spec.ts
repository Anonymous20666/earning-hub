import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("reviewed group delay, real-time countdown and next group survive refresh; successful posts say Sent without delivery boilerplate", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108"),
    "Isolated synthetic UI contract only; no WhatsApp sends",
  );
  await page.setViewportSize({ width: 393, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let prepared = 0,
    posts = 0,
    started = 0;
  const delays: number[] = [];
  const groups = [1, 2].map((n) => ({
    account_id: "SYNTHETIC-owner-account",
    slot: 1,
    group_jid: `SYNTHETIC-group-${n}@g.us`,
    subject: `SYNTHETIC Group ${n === 1 ? "One" : "Two"}`,
    member_count: 42,
    status: "ONLINE",
  }));
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        configured: true,
        accounts: [{ id: groups[0].account_id, slot: 1, status: "ONLINE" }],
        groups,
        ignoredGroups: [],
        runs: posts
          ? [
              {
                id: "SYNTHETIC-paced-run",
                status: "RUNNING",
                mode: "ALLSTATUS",
                created_at: new Date(started).toISOString(),
                placements: 2,
              },
            ]
          : [],
        serverNow: new Date().toISOString(),
      },
    }),
  );
  await page.route("**/api/personal-posts/prepare", (r) => {
    const body = r.request().postDataJSON();
    delays.push(body.delaySeconds);
    prepared++;
    return r.fulfill({
      json: {
        draftId: `SYNTHETIC-delay-${prepared}`,
        mode: body.mode,
        text: body.payload,
        delaySeconds: body.delaySeconds,
        plan: {
          targets: groups.map((g) => ({
            accountId: g.account_id,
            groupJid: g.group_jid,
            subject: g.subject,
            members: 42,
            slot: 1,
          })),
          skips: [],
          skippedSurfaces: [],
          sharedMemberships: 0,
        },
      },
    });
  });
  await page.route("**/api/personal-posts", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      draftId: "SYNTHETIC-delay-2",
      confirmed: true,
    });
    posts++;
    started = Date.now();
    return r.fulfill({ json: { id: "SYNTHETIC-paced-run" } });
  });
  await page.route(
    "**/api/personal-posts/SYNTHETIC-paced-run/events?*",
    (r) => {
      const now = Date.now(),
        done = now - started >= 10000,
        after = Number(new URL(r.request().url()).searchParams.get("after"));
      const events = [
        { id: 1, kind: "QUEUED", message: "2 groups queued." },
        {
          id: 2,
          kind: "SENDING",
          placement_id: "SYNTHETIC-one",
          group_name: groups[0].subject,
          group_jid: groups[0].group_jid,
          message: "Group status · attempting to send",
        },
        // An older successful stored event must also lose only the old boilerplate.
        {
          id: 3,
          kind: "ACCEPTED",
          placement_id: "SYNTHETIC-one",
          group_name: groups[0].subject,
          group_jid: groups[0].group_jid,
          message: "Group status · sent to WhatsApp. Delivery is not confirmed",
        },
        {
          id: 4,
          kind: "WAITING",
          group_name: groups[1].subject,
          group_jid: groups[1].group_jid,
          message: "Pausing 10 seconds before the next group.",
        },
        ...(done
          ? [
              {
                id: 5,
                kind: "SENDING",
                placement_id: "SYNTHETIC-two",
                group_name: groups[1].subject,
                group_jid: groups[1].group_jid,
                message: "Group status · attempting to send",
              },
              {
                id: 6,
                kind: "ACCEPTED",
                placement_id: "SYNTHETIC-two",
                group_name: groups[1].subject,
                group_jid: groups[1].group_jid,
                message: "Group status · Sent",
              },
              {
                id: 7,
                kind: "DONE",
                message: "Finished: 2 sent; 0 failed; 0 uncertain.",
              },
            ]
          : []),
      ].map((e) => ({
        ...e,
        created_at: new Date(started + e.id).toISOString(),
      }));
      return r.fulfill({
        json: {
          run: {
            id: "SYNTHETIC-paced-run",
            status: done ? "FINISHED" : "RUNNING",
          },
          summary: {
            total: 2,
            accepted: done ? 2 : 1,
            pending: done ? 0 : 1,
            uncertain: 0,
            failed: 0,
            cancelled: 0,
            skippedGroups: 0,
          },
          events: events.filter((e) => e.id > after),
          hasMore: false,
          serverNow: new Date(now).toISOString(),
          pacing: {
            delaySeconds: 10,
            readyAt: new Date(started + 10000).toISOString(),
            remainingSeconds: Math.max(
              0,
              Math.ceil((started + 10000 - now) / 1000),
            ),
            waitingForEarlierPost: false,
            nextGroup: done
              ? null
              : {
                  name: groups[1].subject,
                  groupJid: groups[1].group_jid,
                  surface: "GROUP_STATUS",
                  state: "RESERVED",
                },
          },
        },
      });
    },
  );
  await page.goto("/#/join/worker");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC pacing QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`pacing-${info.project.name}-${Date.now()}@example.test`);
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
  await page
    .getByLabel("Your text or link")
    .fill("SYNTHETIC paced test; never transmitted");
  const input = page.getByLabel("Pause between groups");
  await expect(input).toHaveValue("10");
  await input.fill("60");
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(page.locator(".review-delay")).toContainText("60 seconds");
  expect(delays).toEqual([60]);
  await page.getByRole("button", { name: "Back to edit" }).click();
  await input.fill("10");
  await page.getByRole("button", { name: "Review & continue" }).click();
  await expect(page.locator(".review-delay")).toContainText("10 seconds");
  await page.getByRole("checkbox", { name: /I checked this post/ }).check();
  await page.getByRole("button", { name: "Post to all 2 groups" }).click();
  const console = page.locator(".broadcast-console");
  await expect(console.locator(".console-next-name")).toHaveText(
    groups[1].subject,
  );
  await expect(console.getByRole("timer")).toHaveText(/(?:10|9)s/);
  await expect(console.locator(".console-summary")).toContainText("Sent");
  await expect(console).not.toContainText(
    /Delivery is not confirmed|Acceptance is not delivery proof|confirmed delivery or views/,
  );
  const before = parseInt(await console.getByRole("timer").innerText(), 10);
  await expect
    .poll(
      async () => parseInt(await console.getByRole("timer").innerText(), 10),
      { timeout: 5000 },
    )
    .toBeLessThan(before);
  const beforeRefresh = parseInt(
    await console.getByRole("timer").innerText(),
    10,
  );
  await page.reload();
  await expect(console.locator(".console-next-name")).toHaveText(
    groups[1].subject,
  );
  expect(
    parseInt(await console.getByRole("timer").innerText(), 10),
  ).toBeLessThanOrEqual(beforeRefresh);
  expect(posts).toBe(1);
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
  await page.setViewportSize({ width: 393, height: 1800 });
  await console.screenshot({
    path: `docs/screenshots/posting-pacing-countdown-${info.project.name}.png`,
    scale: "css",
  });
  await expect(console.getByText("Finished", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(console.locator(".console-next")).toHaveCount(0);
  await expect(console.locator(".console-summary>div").first()).toContainText(
    "2",
  );
  await expect(
    console
      .locator(".console-line .console-kind")
      .filter({ hasText: /^SENT$/ }),
  ).toHaveCount(2);
  expect(posts).toBe(1);
  expect(prepared).toBe(2);
  expect(errors).toEqual([]);
});
