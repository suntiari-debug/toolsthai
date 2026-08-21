import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const mockUser = {
  id: 991,
  openId: "company-profile-browser-test",
  name: "ผู้ใช้ทดสอบ",
  email: "browser-test@example.com",
  loginMethod: "test",
  role: "user",
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
  lastSignedIn: "2026-08-21T00:00:00.000Z",
};

const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.route("**/api/trpc/auth.me?**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ result: { data: { json: mockUser } } }]),
  }));
  await page.route("**/api/trpc/companyProfile.get?**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ result: { data: { json: null } } }]),
  }));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:3000/quotation", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const accountButton = page.getByRole("button", { name: "บันทึกเข้าบัญชี" });
  if (await accountButton.count() !== 1) throw new Error("Authenticated save control did not render");
  if (await page.getByRole("button", { name: "ใช้ template ที่บันทึก" }).count() !== 0) throw new Error("Template control rendered despite null company profile");
  if (errors.some((error) => /companyProfile|Query data cannot be undefined|data is undefined/i.test(error))) {
    throw new Error(`Unexpected profile query error: ${errors.join(" | ")}`);
  }
  console.log("company profile browser regression: PASS");
} finally {
  await context.close();
  await browser.close();
}
