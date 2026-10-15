import { test, expect, type Page } from "@playwright/test";
const key = "pappy.scene-motion.v1";
async function inspectMotion(page: Page, wait = 1500) {
  await page.locator(".live-hero-scene").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  return page.locator(".scene-phone").evaluate(async (el, delay) => {
    const first = el.getBoundingClientRect(),
      matrix = getComputedStyle(el).transform;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const last = el.getBoundingClientRect(),
      style = getComputedStyle(el);
    return {
      matrix,
      nextMatrix: style.transform,
      displacement: Math.hypot(
        last.x + last.width / 2 - first.x - first.width / 2,
        last.y + last.height / 2 - first.y - first.height / 2,
      ),
      duration: style.animationDuration,
      iteration: style.animationIterationCount,
      state: style.animationPlayState,
    };
  }, wait);
}
async function dataSaving(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: {
        saveData: true,
        addEventListener() {},
        removeEventListener() {},
      },
    }),
  );
}
test("Chrome Android: data saving does not disable visible CSS movement, including beyond the old cutoff", async ({
  page,
}) => {
  await dataSaving(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".live-hero-scene")).toHaveAttribute(
    "data-motion-preference",
    "system",
  );
  const frames = await inspectMotion(page, 1800);
  expect(frames.state).toBe("running");
  expect(frames.duration).toBe("6s");
  expect(frames.iteration).toBe("infinite");
  expect(frames.matrix).not.toBe(frames.nextMatrix);
  expect(frames.displacement).toBeGreaterThan(4);
  const late = await inspectMotion(page, 5500);
  expect(late.matrix).not.toBe(late.nextMatrix);
  await expect(
    page.getByRole("button", { name: /Play movement|Pause movement|3D/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/3D-style illustration/i)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Chrome Android: explicit motion opt-in overrides reduced-motion CSS, survives restart and can return to system or off", async ({
  page,
}) => {
  await dataSaving(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-paused/);
  await page.goto("/?motion=on");
  await expect(page.locator(".live-hero-scene")).toHaveAttribute(
    "data-motion-preference",
    "on",
  );
  const first = await inspectMotion(page);
  expect(first.matrix).not.toBe(first.nextMatrix);
  expect(first.displacement).toBeGreaterThan(2);
  expect(first.duration).toBe("6s");
  expect(first.iteration).toBe("infinite");
  await page.goto("/");
  await expect(page.locator(".live-hero-scene")).toHaveAttribute(
    "data-motion-preference",
    "on",
  );
  const restarted = await inspectMotion(page);
  expect(restarted.matrix).not.toBe(restarted.nextMatrix);
  await page.goto("/?motion=system");
  await page.locator(".live-hero-scene").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveAttribute(
    "data-motion-preference",
    "system",
  );
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-paused/);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-playing/);
  await page.goto("/?motion=off");
  await page.locator(".live-hero-scene").scrollIntoViewIfNeeded();
  await expect(page.locator(".live-hero-scene")).toHaveClass(/is-paused/);
});
test("Chrome Android: explicit motion still works if browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Synthetic storage blocked", "SecurityError");
      },
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?motion=on");
  const frames = await inspectMotion(page);
  expect(frames.matrix).not.toBe(frames.nextMatrix);
  expect(frames.duration).toBe("6s");
  expect(errors).toEqual([]);
});
test("Chrome Android: scene starts without IntersectionObserver and supports legacy media-query listeners", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: undefined,
    });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const result = original(query);
      Object.defineProperty(result, "addEventListener", { value: undefined });
      Object.defineProperty(result, "removeEventListener", {
        value: undefined,
      });
      return result;
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const frames = await inspectMotion(page);
  expect(frames.matrix).not.toBe(frames.nextMatrix);
  expect(errors).toEqual([]);
});
