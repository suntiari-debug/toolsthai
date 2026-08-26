import { chromium } from "playwright-core";

const baseUrl = process.env.TOOLSTHAI_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.route("**/*", async (route) => {
    if (route.request().url().includes("html2canvas") || route.request().url().includes("jspdf")) {
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    await route.continue();
  });
  await page.goto(`${baseUrl}/quotation`, { waitUntil: "networkidle" });
  const download = page.waitForEvent("download").catch(() => null);
  await page.getByRole("button", { name: "ดาวน์โหลด PDF" }).click();
  const overlay = page.locator(".pdf-export-overlay");
  const continueButton = page.getByRole("button", { name: "ดาวน์โหลดต่อ" });
  const shouldContinue = await continueButton.waitFor({ state: "visible", timeout: 1000 }).then(() => true).catch(() => false);
  if (shouldContinue) await continueButton.click();
  await overlay.waitFor({ state: "visible", timeout: 8000 });

  const status = await page.locator(".pdf-export-dialog h2").textContent();
  if (status !== "กำลังเตรียมเอกสาร") throw new Error(`Expected preparing status, received: ${status}`);

  const completedDownload = await download;
  if (!completedDownload) throw new Error("PDF download did not start");
  await overlay.waitFor({ state: "hidden", timeout: 12000 });
  console.log(`PDF overlay verified: ${status}; download=${completedDownload.suggestedFilename()}; overlay closed`);
} finally {
  await browser.close();
}
