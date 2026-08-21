import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const context = await browser.newContext({
  viewport: { width: 430, height: 850 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();

async function dispatchPinch(page, selector, startDistance, endDistance) {
  await page.evaluate(({ selector: targetSelector, startDistance: start, endDistance: end }) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error("Preview target is unavailable");
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + Math.min(120, rect.height / 2);
    const makeTouches = (distance) => [
      new Touch({ identifier: 1, target, clientX: centerX - distance / 2, clientY: centerY }),
      new Touch({ identifier: 2, target, clientX: centerX + distance / 2, clientY: centerY }),
    ];
    const fire = (type, touches) => target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touches,
    }));
    fire("touchstart", makeTouches(start));
    fire("touchmove", makeTouches(end));
    fire("touchend", []);
  }, { selector, startDistance, endDistance });
}

try {
  await page.goto("http://127.0.0.1:3000/quotation", { waitUntil: "networkidle" });
  const wrap = page.locator(".preview-paper-wrap");
  await wrap.waitFor();
  const box = await wrap.boundingBox();
  if (!box) throw new Error("Preview container did not render");

  const zoomOutput = page.locator(".preview-zoom-controls output");
  if (await zoomOutput.textContent() !== "100%") throw new Error("Preview did not begin at 100%");

  await dispatchPinch(page, ".preview-paper-wrap", 90, 124);
  await page.waitForTimeout(80);
  if (await zoomOutput.textContent() !== "110%") throw new Error("Pinch out did not increase the preview zoom");

  await dispatchPinch(page, ".preview-paper-wrap", 124, 90);
  await page.waitForTimeout(80);
  if (await zoomOutput.textContent() !== "100%") throw new Error("Pinch in did not reduce the preview zoom");

  const hasScroll = await wrap.evaluate((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
  if (hasScroll) throw new Error("Pinch gesture introduced an internal preview scrollbar");

  console.log("pinch zoom browser regression: PASS");
} finally {
  await context.close();
  await browser.close();
}
