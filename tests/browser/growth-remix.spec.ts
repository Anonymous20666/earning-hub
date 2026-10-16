import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, promises as fs } from "node:fs";
import sharp from "sharp";
import { renderGrowthRemix } from "../../shared/growthRemix";
import { growthStyleIndex } from "../../backend/growthCreative";
const url = "https://chat.whatsapp.com/SyntheticInvite123";
test("saved growth campaign previews fresh URL remixes, unchanged links, copying, readable fallback and honest missing thumbnails without sending", async ({
  page,
  baseURL,
}, info) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108") || !process.env.GROWTH_QA_FOLDER,
    "Gated local synthetic QA only",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let sends = 0,
    generations = 0;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      /\/(?:broadcasts|personal-posts|launch)(?:[/?]|$)/.test(req.url())
    )
      sends++;
  });
  await page.goto("/#/join/advertiser");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC remix QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`remix-${Date.now()}-${info.project.name}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("SYNTHETIC-local-only-password-2026!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Pappy." }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/auth/session")).json();
  const created = await page.request.post("/api/growth", {
    headers: {
      "X-Requested-With": "PappyWeb",
      "X-CSRF-Token": session.csrf,
      "Idempotency-Key": "remix-browser-" + crypto.randomUUID(),
    },
    data: {
      title: "PRIVATE QA campaign label",
      product: "WA_GROUP",
      destination: url,
      quantity: 200,
      countries: [],
      lane: "NORMAL",
      service: "SELF_SERVICE",
      expectedAt: new Date(Date.now() + 86400000).toISOString(),
      contactPhone: "",
      termsVersion: 1,
      acknowledged: true,
    },
  });
  expect(created.ok()).toBe(true);
  const image = (
    await sharp(readFileSync("public/social-card-v1.png"))
      .resize(640)
      .jpeg()
      .toBuffer()
  ).toString("base64");
  await page.route("**/api/growth/*/creative-preview", (r) => {
    generations++;
    const missing = generations >= 3;
    return r.fulfill({
      json: {
        assetId: "SYNTHETIC-browser-only",
        metadataRecordedAt: "2026-10-15T12:00:00.000Z",
        quality: missing ? "PARTIAL" : "COMPLETE",
        preview: {
          title: missing ? "" : "SYNTHETIC Community",
          description:
            "Synthetic browser-test image, not live destination metadata.",
          ...(missing ? {} : { thumbnailBase64: image }),
        },
        examples: Array.from({ length: 4 }, (_, i) =>
          renderGrowthRemix({
            product: "WA_GROUP",
            destination: url,
            destinationName: missing ? "" : "SYNTHETIC Community",
            styleIndex: growthStyleIndex(
              String(generations).repeat(64),
              i * 100003,
            ),
          }),
        ),
        warning: missing
          ? "Destination preview is incomplete/unavailable. No image or follower count is invented."
          : "SYNTHETIC browser fixture. This is not a real WhatsApp rendering or live destination image.",
        previewOnly: true,
        liveDispatch: false,
      },
    });
  });
  await page.goto("/#/app/growth");
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh look for every group." }),
  ).toBeVisible();
  expect(generations).toBe(0);
  await page
    .getByRole("button", { name: "Generate URL remixes", exact: true })
    .click();
  await expect(page.locator(".gx-remix-option")).toHaveCount(4);
  await expect(page.locator(".gx-remix-card img")).toHaveCount(4);
  for (const a of await page.locator(".gx-remix-text a").all()) {
    await expect(a).toHaveAttribute("href", url);
    await expect(a).toHaveText(url);
  }
  const before = await page.locator(".gx-remix-text").first().innerText();
  await page
    .getByRole("button", { name: "Generate more remixes", exact: true })
    .click();
  await expect(page.locator(".gx-remix-text").first()).not.toHaveText(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await fs.writeFile(
    `docs/testing/axe-growth-remix-${info.project.name}.json`,
    JSON.stringify({ violations: axe.violations }, null, 2),
  );
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/growth-remix-${info.project.name}.png`,
    scale: "css",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", { name: "Readable text fallback", exact: true })
    .check();
  await expect(page.locator(".gx-remix-text").first()).toHaveText(
    "SYNTHETIC Community" + url,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as any).__remixCopied = value;
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Copy generated URL text 1", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__remixCopied)).toBe(
    "SYNTHETIC Community\n" + url,
  );
  await page
    .getByRole("button", { name: "Generate more remixes", exact: true })
    .click();
  await expect(page.locator(".gx-remix-missing")).toHaveCount(4);
  await expect(page.locator(".gx-remix-card img")).toHaveCount(0);
  await expect(page.locator(".gx-remix")).toContainText(
    "No image or follower count is invented",
  );
  expect(sends).toBe(0);
  expect(errors).toEqual([]);
});
