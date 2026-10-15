// Public-only, read-only verification. Never registers, pairs, scans owned groups or sends.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const origin = "https://pappy-earnig-hub.duckdns.org",
  checks = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    viewport: { width: 393, height: 851 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    (await (await page.request.get(origin + "/api/health")).json()).version,
    "0.10.0",
  );
  checks.push("HTTPS health v0.10.0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 393, 430]) {
    await page.setViewportSize({ width, height: 851 });
    await page.goto(origin + "/#/calculator");
    await page.locator(".calculator-input-panel").waitFor();
    assert.equal(
      await page.locator("#member-counts").getAttribute("placeholder"),
      "For example:\n100\n742\n1000",
    );
    const issues = await page
      .locator(".calculator-input-panel")
      .evaluate((panel) => {
        const issues = [];
        for (const field of panel.querySelectorAll(".calculator-field")) {
          const children = Array.from(field.children).filter(
            (el) => el.getBoundingClientRect().height > 0,
          );
          for (let n = 1; n < children.length; n++)
            if (
              children[n].getBoundingClientRect().top <
              children[n - 1].getBoundingClientRect().bottom - 1
            )
              issues.push("overlap");
          for (const el of field.querySelectorAll("select,textarea")) {
            if (
              Math.abs(
                el.getBoundingClientRect().width -
                  field.getBoundingClientRect().width,
              ) > 2
            )
              issues.push("not full width");
            if (
              parseFloat(getComputedStyle(el).fontSize) < 16 ||
              el.getBoundingClientRect().height < 48
            )
              issues.push("small control");
          }
        }
        for (const button of panel.querySelectorAll("button"))
          if (
            button.getBoundingClientRect().height < 44 ||
            getComputedStyle(button).borderStyle === "none"
          )
            issues.push("unclear button");
        if (document.documentElement.scrollWidth > innerWidth)
          issues.push("horizontal overflow");
        return issues;
      });
    assert.deepEqual(issues, []);
    checks.push(
      `${width}px: no overlapping fields, full-width 16px inputs, visible touch-friendly buttons, no overflow`,
    );
    await page.locator(".calculator-input-panel").screenshot({
      path: `docs/screenshots/posting-live-calculator-${width}.png`,
      scale: "css",
    });
    await page
      .getByRole("button", { name: "Try the 5,000-Coin daily example" })
      .click();
    assert.match(
      await page.locator(".earning-result-rows").innerText(),
      /5,000\.000 Coins/,
    );
    assert.match(
      await page.locator(".coin-value-primary").innerText(),
      /USD\s3\.75/,
    );
    checks.push(
      `${width}px: conditional 5,000 example and USD display unchanged`,
    );
    assert.deepEqual(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
      [],
    );
    checks.push(`${width}px: automated accessibility scan`);
  }
  assert.deepEqual(errors, []);
  checks.push("No browser runtime errors");
} finally {
  await fs.writeFile(
    "docs/testing/posting-mobile-domain-readonly.json",
    JSON.stringify(
      {
        origin,
        at: new Date().toISOString(),
        checks,
        accountsCreated: 0,
        whatsappActions: 0,
        notes:
          "Actual public production DOM/CSS and screenshots. Authenticated composer appearance verified in isolated QA, not by sending production messages. Browser emulation is not physical-device proof.",
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    passed: checks.length,
    accountsCreated: 0,
    whatsappActions: 0,
  }),
);
