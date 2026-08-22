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

async function dispatchPan(page, selector, startX, startY, endX, endY) {
  await page.evaluate(({ selector: targetSelector, startX: fromX, startY: fromY, endX: toX, endY: toY }) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error("Preview target is unavailable");
    const makeTouch = (x, y) => [new Touch({ identifier: 1, target, clientX: x, clientY: y })];
    const fire = (type, touches) => target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touches,
    }));
    fire("touchstart", makeTouch(fromX, fromY));
    fire("touchmove", makeTouch(toX, toY));
    fire("touchend", []);
  }, { selector, startX, startY, endX, endY });
}

async function dispatchTap(page, selector, x, y) {
  await page.evaluate(({ selector: targetSelector, x: clientX, y: clientY }) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error("Preview target is unavailable");
    const touch = [new Touch({ identifier: 1, target, clientX, clientY })];
    const fire = (type, touches) => target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touch,
    }));
    fire("touchstart", touch);
    fire("touchend", []);
  }, { selector, x, y });
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

  await dispatchPan(page, ".preview-paper-wrap", box.x + box.width / 2, box.y + 260, box.x + box.width / 2 - 55, box.y + 175);
  await page.waitForTimeout(80);
  const panOffset = await page.locator(".document-preview").evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue("--preview-pan-x")),
    y: Number.parseFloat(element.style.getPropertyValue("--preview-pan-y")),
  }));
  if (!(panOffset.x < 0 && panOffset.y < 0 && panOffset.x >= -72 && panOffset.y >= -188)) {
    throw new Error(`One-finger pan did not move the zoomed document within bounds: ${JSON.stringify(panOffset)}`);
  }
  const indicator = page.locator(".document-scroll-indicator");
  if (await indicator.count() !== 1) throw new Error("Scroll indicator did not appear while the preview was zoomed in");
  if (await indicator.locator("strong").textContent() !== "ส่วนกลาง") throw new Error("Scroll indicator did not label the current A4 area as the middle section");
  if (await indicator.locator("i").evaluate((element) => element.style.left) !== "45%") {
    throw new Error("Scroll indicator thumb did not move with the document pan position");
  }

  const tapX = box.x + box.width / 2;
  const tapY = box.y + 210;
  await dispatchTap(page, ".preview-paper-wrap", tapX, tapY);
  await page.waitForTimeout(60);
  await dispatchTap(page, ".preview-paper-wrap", tapX + 4, tapY + 3);
  await page.waitForTimeout(80);
  if (await zoomOutput.textContent() !== "100%") throw new Error("Double tap did not reset the preview zoom");
  const resetPan = await page.locator(".document-preview").evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue("--preview-pan-x")),
    y: Number.parseFloat(element.style.getPropertyValue("--preview-pan-y")),
  }));
  if (resetPan.x !== 0 || resetPan.y !== 0) throw new Error("Preview pan did not reset after double tap");
  if (await indicator.count() !== 0) throw new Error("Scroll indicator did not hide after double-tap reset");

  await page.locator('button[aria-label="ซูมเข้า"]').evaluate((button) => button.click());
  await page.waitForTimeout(80);
  if (await zoomOutput.textContent() !== "110%") throw new Error("Zoom control did not update the current preview before persistence check");
  if (await page.evaluate(() => window.localStorage.getItem("toolsthai.preview-zoom.quotation.mobile")) !== "1") {
    throw new Error("Mobile quotation preview zoom was not stored under its own key");
  }
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator(".preview-zoom-controls output").textContent() !== "110%") {
    throw new Error("Stored quotation preview zoom was not restored after opening the document again");
  }

  await page.goto("http://127.0.0.1:3000/invoice", { waitUntil: "networkidle" });
  const invoiceZoomOutput = page.locator(".preview-zoom-controls output");
  if (await invoiceZoomOutput.textContent() !== "100%") throw new Error("Invoice incorrectly inherited quotation preview zoom");
  await page.locator('button[aria-label="ซูมออก"]').evaluate((button) => button.click());
  await page.waitForTimeout(80);
  if (await invoiceZoomOutput.textContent() !== "90%") throw new Error("Invoice zoom control did not update the current preview");
  if (await page.evaluate(() => window.localStorage.getItem("toolsthai.preview-zoom.invoice.mobile")) !== "-1") {
    throw new Error("Mobile invoice preview zoom was not stored under its own key");
  }
  await page.goto("http://127.0.0.1:3000/quotation", { waitUntil: "networkidle" });
  if (await page.locator(".preview-zoom-controls output").textContent() !== "110%") {
    throw new Error("Quotation did not retain its own preview zoom after opening invoice");
  }
  await page.goto("http://127.0.0.1:3000/invoice", { waitUntil: "networkidle" });
  if (await page.locator(".preview-zoom-controls output").textContent() !== "90%") {
    throw new Error("Invoice did not restore its own preview zoom after returning to the page");
  }

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto("http://127.0.0.1:3000/quotation", { waitUntil: "networkidle" });
  const desktopZoomOutput = desktopPage.locator(".preview-zoom-controls output");
  if (await desktopZoomOutput.textContent() !== "100%") throw new Error("Desktop quotation incorrectly inherited mobile preview zoom");
  await desktopPage.locator('button[aria-label="ซูมออก"]').evaluate((button) => button.click());
  await desktopPage.waitForTimeout(80);
  if (await desktopZoomOutput.textContent() !== "90%") throw new Error("Desktop zoom control did not update the current preview");
  if (await desktopPage.evaluate(() => window.localStorage.getItem("toolsthai.preview-zoom.quotation.desktop")) !== "-1") {
    throw new Error("Desktop quotation preview zoom was not stored under its own key");
  }
  await desktopPage.reload({ waitUntil: "networkidle" });
  if (await desktopPage.locator(".preview-zoom-controls output").textContent() !== "90%") throw new Error("Desktop quotation preview zoom was not restored");
  await page.goto("http://127.0.0.1:3000/quotation", { waitUntil: "networkidle" });
  if (await page.locator(".preview-zoom-controls output").textContent() !== "110%") throw new Error("Mobile quotation did not retain its own preview zoom after desktop update");
  const resetTrigger = page.locator('button[aria-label="ล้างค่าซูมที่จำไว้สำหรับอุปกรณ์นี้"]');
  await resetTrigger.evaluate((button) => button.click());
  const confirmDialog = page.locator('[data-slot="alert-dialog-content"]');
  await confirmDialog.waitFor();
  if (!(await confirmDialog.textContent())?.includes("ล้างค่าซูมที่จำไว้?")) throw new Error("Zoom reset confirmation dialog did not describe the action");
  await confirmDialog.getByRole("button", { name: "ยกเลิก" }).click();
  await page.waitForTimeout(80);
  if (await page.locator(".preview-zoom-controls output").textContent() !== "110%") throw new Error("Cancelling zoom reset incorrectly changed the preview zoom");
  if (await page.evaluate(() => window.localStorage.getItem("toolsthai.preview-zoom.quotation.mobile")) !== "1") {
    throw new Error("Cancelling zoom reset incorrectly removed the stored preference");
  }
  await resetTrigger.evaluate((button) => button.click());
  await confirmDialog.waitFor();
  await confirmDialog.getByRole("button", { name: "ล้างค่าซูม", exact: true }).click();
  await page.waitForTimeout(80);
  if (await page.locator(".preview-zoom-controls output").textContent() !== "100%") throw new Error("Current device reset did not return the preview to 100%");
  if (await page.evaluate(() => window.localStorage.getItem("toolsthai.preview-zoom.quotation.mobile")) !== null) {
    throw new Error("Current device reset did not remove the mobile quotation zoom preference");
  }
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator(".preview-zoom-controls output").textContent() !== "100%") throw new Error("Mobile quotation did not use default zoom after clearing its preference");
  if (await desktopPage.locator(".preview-zoom-controls output").textContent() !== "90%") {
    throw new Error("Current device reset incorrectly changed the desktop quotation zoom preference");
  }
  await desktopContext.close();

  const hasScroll = await wrap.evaluate((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
  if (hasScroll) throw new Error("Pinch gesture introduced an internal preview scrollbar");

  console.log("pinch zoom browser regression: PASS");
} finally {
  await context.close();
  await browser.close();
}
