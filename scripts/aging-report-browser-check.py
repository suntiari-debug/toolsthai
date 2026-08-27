import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787792400000
user = {"id": 41, "openId": "fixture-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
report = {"asOf": "2026-08-31T00:00:00.000Z", "month": "2026-08", "buckets": [{"key": "current", "label": "ยังไม่ถึงกำหนด", "count": 1, "outstanding": "100.00"}, {"key": "1-30", "label": "1–30 วัน", "count": 1, "outstanding": "80.00"}, {"key": "31-60", "label": "31–60 วัน", "count": 1, "outstanding": "200.00"}, {"key": "61-90", "label": "61–90 วัน", "count": 1, "outstanding": "300.00"}, {"key": "90-plus", "label": "มากกว่า 90 วัน", "count": 1, "outstanding": "400.00"}], "items": [{"id": 5, "invoiceId": 5, "documentNumber": "IV-AGING-005", "customerName": "ACME Thailand", "issueDate": "2026-05-01T00:00:00.000Z", "dueDate": "2026-05-01T00:00:00.000Z", "totalAmount": "400.00", "paidAmount": "0.00", "outstanding": "400.00", "daysPastDue": 122, "bucket": "90-plus", "status": "overdue"}], "summary": {"outstanding": "1080.00", "invoiceCount": 5, "collectedThisMonth": "30.00", "paymentCount": 2, "collectedByMethod": {"cash": "5.00", "transfer": "25.00", "card": "0.00", "cheque": "0.00", "other": "0.00"}}}


def response_for(procedure):
    if procedure == "auth.me":
        return user
    if procedure == "receivables.agingReport":
        return report
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    body = [{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/receivables/report", wait_until="networkidle")
    page.get_by_role("heading", name="รายงานอายุลูกหนี้").wait_for(state="visible", timeout=10000)
    page.get_by_text("ยอดคงค้างทั้งหมด").wait_for(state="visible", timeout=5000)
    page.get_by_text("฿1,080.00").wait_for(state="visible", timeout=5000)
    page.get_by_text("มากกว่า 90 วัน").wait_for(state="visible", timeout=5000)
    page.get_by_text("IV-AGING-005").wait_for(state="visible", timeout=5000)
    page.get_by_text("โอนเงิน").wait_for(state="visible", timeout=5000)
    page.get_by_label("วันอ้างอิงรายงาน").fill("2026-08-31")
    page.get_by_label("เดือนรับชำระรายงาน").fill("2026-08")
    with page.expect_download(timeout=10000) as download_info:
        page.get_by_role("button", name="Export CSV").click()
    download = download_info.value
    if download.suggested_filename != "รายงานอายุลูกหนี้-2026-08-31.csv":
        raise AssertionError(f"Unexpected CSV filename: {download.suggested_filename}")
    page.get_by_text("ดาวน์โหลด รายงานอายุลูกหนี้-2026-08-31.csv แล้ว").wait_for(state="visible", timeout=5000)
    if os.environ.get("TOOLSTHAI_AGING_REPORT_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_AGING_REPORT_SCREENSHOT"], full_page=True)
    print(json.dumps({"agingReport": "buckets-and-outstanding", "monthlyCollections": "method-breakdown", "csvDownload": download.suggested_filename}, ensure_ascii=False))
    browser.close()
