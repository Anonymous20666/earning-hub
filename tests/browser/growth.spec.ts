import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
async function register(page: Page, role = "advertiser") {
  const email = `growth-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.goto("/#/join/" + role);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("SYNTHETIC growth QA");
  await page.getByLabel("Email address", { exact: true }).fill(email);
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
  return email;
}
async function check(page: Page, name: string, project: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await fs.writeFile(
    `docs/testing/axe-growth-${name}-${project}.json`,
    JSON.stringify({ violations: axe.violations }, null, 2),
  );
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: `docs/screenshots/growth-${project}-${name}.png`,
    fullPage: true,
    scale: "css",
  });
}
test.beforeEach(async ({ baseURL }) => {
  test.skip(
    !baseURL?.includes("127.0.0.1:3108") || !process.env.GROWTH_QA_FOLDER,
    "Isolated gated QA only; no public test accounts or real provider work",
  );
});
test("advertiser saves and edits a real draft, accepts explicit terms and submits without a payment or send", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page);
  await page.goto("/#/app/growth");
  await expect(
    page.getByRole("heading", { name: "Grow your community. Keep control." }),
  ).toBeVisible();
  await check(page, "dashboard", info.project.name);
  await page
    .getByRole("button", { name: "Plan a growth campaign", exact: true })
    .first()
    .click();
  await check(page, "service", info.project.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("SYNTHETIC new community");
  await page
    .getByLabel("WhatsApp group invitation or destination link")
    .fill("https://chat.whatsapp.com/SyntheticInvite123");
  await expect(page.getByLabel("Message to promote your community")).toHaveCount(0);
  await page.getByLabel("Additional qualifying requests").fill("199");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Additional qualifying requests")).toBeVisible();
  await page.getByLabel("Additional qualifying requests").fill("201");
  await check(page, "campaign", info.project.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Nigeria", exact: true }).check();
  await check(page, "audience", info.project.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit for review", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".gx-terms")).toContainText(
    "Do not share or promote",
  );
  await check(page, "review", info.project.name);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".gx-notice")).toContainText("Draft saved");
  await expect(page.locator(".gx-order")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("SYNTHETIC updated community");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText("Sent for review");
  await expect(page.locator(".gx-order .status")).toHaveText("Review");
  await expect(page.locator(".gx-detail")).toContainText(
    "No charge or broadcast",
  );
  await check(page, "submitted", info.project.name);
  expect(errors).toEqual([]);
});
test("Telegram channel plans support 100000 net subscribers without country targeting or an instant checkout claim", async ({
  page,
}, info) => {
  await register(page);
  await page.goto("/#/app/growth");
  await page
    .getByRole("button", { name: "Plan a growth campaign", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Telegram channel/ }).click();
  await page.getByLabel("How would you like to work?").selectOption("MANAGED");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("SYNTHETIC Telegram channel");
  await page
    .getByLabel("Telegram channel invitation or destination link")
    .fill("https://t.me/SyntheticChannel");
  await expect(page.getByLabel("Message to promote your community")).toHaveCount(0);
  await page.getByLabel("Additional followers / subscribers").fill("100000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".gx-explain")).toContainText(
    "without country targeting",
  );
  await expect(
    page.getByRole("checkbox", { name: "Nigeria", exact: true }),
  ).toHaveCount(0);
  await check(page, "telegram", info.project.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".gx-review")).toContainText("100,000");
  await expect(page.locator(".gx-terms")).toContainText("net growth");
  await page.getByRole("checkbox", { name: /I have read and accept/ }).check();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText(
    "No payment or broadcast started",
  );
});
test("admin records unset-policy choices and staff contacts with no inventory, quote or spending fabricated", async ({
  page,
}, info) => {
  const email = await register(page);
  const db = new DatabaseSync(
    path.join(process.env.GROWTH_QA_FOLDER!, "pappy.sqlite"),
  );
  db.prepare("UPDATE users SET role='ADMIN' WHERE email=?").run(email);
  db.close();
  await page.goto("/#/app/growth-admin");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A clear desk for every campaign." }),
  ).toBeVisible();
  await page
    .getByText("Country audience evidence & review policy", { exact: true })
    .click();
  await page.getByLabel("Minimum permitted sample size").fill("30");
  await page.getByLabel("Minimum matching audience (%)").fill("80");
  await page.getByLabel("Maximum evidence age (hours)").fill("24");
  await page
    .getByRole("button", { name: "Save audience review policy", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText(
    "Audience review policy recorded",
  );
  await expect(
    page.getByRole("button", {
      name: "Record aggregate evidence",
      exact: true,
    }),
  ).toBeDisabled();
  await check(page, "admin-policy", info.project.name);
  await page
    .getByText("Dedicated service-admin contacts", { exact: true })
    .click();
  await page
    .getByLabel("Service label", { exact: true })
    .fill("SYNTHETIC primary contact");
  await page
    .getByLabel("International contact number", { exact: true })
    .fill("+234" + Date.now().toString().slice(-10));
  await page
    .getByRole("button", { name: "Add service contact", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText(
    "Service contact added",
  );
  await check(page, "admin-contacts", info.project.name);
});
test("worker can opt in and out of a voluntary planning shift without enabling live work", async ({
  page,
}, info) => {
  await register(page, "worker");
  await page.goto("/#/app/connections");
  await expect(
    page.getByRole("heading", { name: "Choose your growth-work availability" }),
  ).toBeVisible();
  await page.getByLabel("How long are you available?").selectOption("60");
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText("No post started");
  await check(page, "worker-shift", info.project.name);
  await page.getByLabel("How long are you available?").selectOption("0");
  await page
    .getByRole("button", { name: "Save availability", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText("availability is off");
});

test("shortfall extension is a real buyer decision: decline stays paused, acceptance changes only the deadline", async ({
  page,
}, info) => {
  await register(page);
  const session = await (await page.request.get("/api/auth/session")).json();
  const orders: any[] = [];
  for (const decision of ["decline", "accept"]) {
    const created = await page.request.post("/api/growth", {
      headers: {
        "X-Requested-With": "PappyWeb",
        "X-CSRF-Token": session.csrf,
        "Idempotency-Key": "browser-extension-" + crypto.randomUUID(),
      },
      data: {
        title: "SYNTHETIC extension " + decision,
        product: "WA_GROUP",
        destination: "https://chat.whatsapp.com/SyntheticInvite123",
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
    const order = await created.json();
    const db = new DatabaseSync(
      path.join(process.env.GROWTH_QA_FOLDER!, "pappy.sqlite"),
    );
    const old = new Date(Date.now() - 3600000).toISOString(),
      future = new Date(Date.now() + 86400000).toISOString(),
      extension = crypto.randomUUID();
    // Isolated synthetic shortfall state only. No production provider or funding proof is fabricated.
    db.prepare(
      "UPDATE growth_orders SET status='EXTENSION_REQUIRED',started_at=?,deadline_at=?,delivered=10 WHERE id=?",
    ).run(new Date(Date.now() - 2 * 3600000).toISOString(), old, order.id);
    db.prepare(
      "INSERT INTO growth_extensions(id,order_id,previous_deadline,proposed_deadline,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      extension,
      order.id,
      old,
      future,
      "SYNTHETIC optional more time, no extra spending.",
      session.user.id,
      new Date().toISOString(),
    );
    db.close();
    orders.push({ ...order, decision, future });
  }
  await page.goto("/#/app/growth");
  const declined = orders[0],
    accepted = orders[1];
  await page
    .locator(".gx-order")
    .filter({ hasText: declined.input.title })
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Accept extension", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page.locator(".gx-notice")).toContainText("work remains paused");
  await page
    .locator(".gx-order")
    .filter({ hasText: accepted.input.title })
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Accept extension", exact: true })
    .click();
  await expect(page.locator(".gx-notice")).toContainText("Extension accepted");
  const db = new DatabaseSync(
    path.join(process.env.GROWTH_QA_FOLDER!, "pappy.sqlite"),
  );
  expect(
    (
      db
        .prepare("SELECT status FROM growth_orders WHERE id=?")
        .get(declined.id) as any
    ).status,
  ).toBe("EXTENSION_REQUIRED");
  const r = db
    .prepare("SELECT * FROM growth_orders WHERE id=?")
    .get(accepted.id) as any;
  expect(r.status).toBe("RUNNING");
  expect(r.deadline_at).toBe(accepted.future);
  expect(r.delivered).toBe(10);
  expect(
    (db.prepare("SELECT COUNT(*) n FROM growth_payment_intents").get() as any)
      .n,
  ).toBe(0);
  db.close();
  await check(page, "extension-decision", info.project.name);
});
