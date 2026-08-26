import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = "http://127.0.0.1:3000";
const outputDir = "/home/ubuntu/Downloads/toolsthai-pdf-direct-check";
const routes = ["quotation", "invoice", "receipt", "delivery-note", "tax-invoice"];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.evaluate(async () => { await document.fonts.ready; });
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await page.getByRole("button", { name: "ดาวน์โหลด PDF" }).first().click();
    const download = await downloadPromise;
    const outputPath = path.join(outputDir, `${route}.pdf`);
    await download.saveAs(outputPath);
    const file = await stat(outputPath);
    if (file.size < 4_000) throw new Error(`${route}: generated PDF is unexpectedly small (${file.size} bytes)`);
    console.log(`${route}: ${file.size} bytes`);
    await page.close();
  }
} finally {
  await browser.close();
}
