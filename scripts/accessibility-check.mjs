import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const routes = ["/", "/quotation", "/tax-invoice", "/pricing-calculator", "/vat-calculator"];
let violations = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of routes) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "networkidle" });
    const report = await new AxeBuilder({ page }).analyze();
    if (report.violations.length === 0) {
      console.log(`${route}: no accessibility violations`);
    } else {
      violations += report.violations.length;
      console.log(`${route}: ${report.violations.length} violation group(s)`);
      for (const violation of report.violations) {
        console.log(`  - ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes.slice(0, 5)) {
          console.log(`    ${node.target.join(", ")}: ${node.failureSummary?.replace(/\n/g, " ") || "no detail"}`);
        }
      }
    }
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}

if (violations > 0) process.exitCode = 1;
