import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [360, 393, 430, 768, 1440]) {
  test(`calculator has stacked readable controls, touch targets and no clipping at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#/calculator");
    await expect(page.locator(".calculator-input-panel")).toBeVisible();
    const issues = await page
      .locator(".calculator-input-panel")
      .evaluate((panel) => {
        const issues: string[] = [];
        for (const field of panel.querySelectorAll(".calculator-field")) {
          const nodes = Array.from(field.children).filter(
            (el) => el.getBoundingClientRect().height > 0,
          );
          for (let i = 1; i < nodes.length; i++)
            if (
              nodes[i].getBoundingClientRect().top <
              nodes[i - 1].getBoundingClientRect().bottom - 1
            )
              issues.push("overlapping field children");
          for (const input of field.querySelectorAll("textarea,select")) {
            const r = input.getBoundingClientRect(),
              f = field.getBoundingClientRect();
            if (Math.abs(r.width - f.width) > 2) issues.push("not full width");
            if (r.height < 48) issues.push("small control");
            if (parseFloat(getComputedStyle(input).fontSize) < 16)
              issues.push("tiny input font");
          }
        }
        for (const button of panel.querySelectorAll("button")) {
          if (button.getBoundingClientRect().height < 44)
            issues.push("small button");
          if (getComputedStyle(button).borderStyle === "none")
            issues.push("no button boundary");
          if (button.scrollWidth > button.clientWidth + 2)
            issues.push("clipped button text");
        }
        if (document.documentElement.scrollWidth > innerWidth)
          issues.push("page horizontal overflow");
        return issues;
      });
    expect(issues).toEqual([]);
    await page
      .getByLabel("Members in each unique qualifying group")
      .fill("100\n742\n1000\n99");
    await page.getByLabel("Post type").selectOption("DOUBLE");
    await expect(page.locator(".earning-result-amount")).toContainText("3.684");
    await page
      .getByRole("button", { name: "Try the 5,000-Coin daily example" })
      .click();
    await expect(page.locator(".earning-result-rows")).toContainText(
      "5,000.000 Coins",
    );
    await expect(page.locator(".coin-value-primary")).toContainText("USD 3.75");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (info.project.name === "mobile" && [360, 393, 430].includes(width)) {
      await page
        .locator(".calculator-input-panel")
        .screenshot({
          path: `docs/screenshots/mobile-polish-calculator-${width}.png`,
          scale: "css",
        });
      await page
        .locator(".earning-result")
        .screenshot({
          path: `docs/screenshots/mobile-polish-result-${width}.png`,
          scale: "css",
        });
    }
  });
}
