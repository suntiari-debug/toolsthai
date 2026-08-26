import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const targets = [
  { route: "invoice", buttonText: "ใบแจ้งหนี้", prefix: "IV" },
  { route: "receipt", buttonText: "ใบเสร็จรับเงิน", prefix: "RC" },
  { route: "delivery-note", buttonText: "ใบส่งของ", prefix: "DN" },
];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const target of targets) {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3000/quotation", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.getByLabel("ชื่อบริษัท / ร้านค้า").fill("บริษัท ตัวอย่าง ทดสอบ จำกัด");
    await page.getByLabel("ชื่อลูกค้า / บริษัทลูกค้า").fill("ลูกค้าทดสอบ จำกัด");
    await page.getByLabel("ชื่อสินค้า / บริการ").fill("บริการตรวจ flow");
    await page.locator(".convert-buttons button").filter({ hasText: target.buttonText }).click();
    await page.waitForURL(new RegExp(`/${target.route}$`));
    await page.waitForTimeout(500);
    const documentNumber = await page.getByLabel("เลขที่เอกสาร").inputValue();
    const company = await page.getByLabel("ชื่อบริษัท / ร้านค้า").inputValue();
    const customer = await page.getByLabel("ชื่อลูกค้า / บริษัทลูกค้า").inputValue();
    const item = await page.getByLabel("ชื่อสินค้า / บริการ").inputValue();
    if (!documentNumber.startsWith(`${target.prefix}-`) || company !== "บริษัท ตัวอย่าง ทดสอบ จำกัด" || customer !== "ลูกค้าทดสอบ จำกัด" || item !== "บริการตรวจ flow") {
      throw new Error(`${target.route}: restored document values are incorrect`);
    }
    console.log(`${target.route}: restored ${documentNumber} with company, customer, and item`);
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}
