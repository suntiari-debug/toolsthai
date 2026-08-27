import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}

NOW = 1787792400000
state = {"paid": "0.00", "status": "open", "payments": [], "events": [{"id": 601, "type": "created", "amount": "1000.00", "note": "เพิ่มจากใบแจ้งหนี้", "createdAt": NOW}]}
user = {"id": 41, "openId": "fixture-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
invoice = {"id": 8, "kind": "invoice", "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "payload": "{}", "createdAt": NOW, "updatedAt": NOW}


def receivable():
    return {"id": 101, "invoiceId": 8, "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "customerAddress": None, "issueDate": NOW, "dueDate": NOW + 7 * 86400000, "totalAmount": "1000.00", "paidAmount": state["paid"], "status": state["status"], "note": None, "createdAt": NOW, "updatedAt": NOW}


def response_for(procedure):
    if procedure == "auth.me":
        return user
    if procedure == "documents.list":
        return [invoice]
    if procedure == "receivables.list":
        paid = float(state["paid"])
        return {"items": [receivable()], "summary": {"total": "1000.00", "outstanding": f"{1000 - paid:.2f}", "overdue": "0.00", "dueSoon": f"{1000 - paid:.2f}", "collectedThisMonth": f"{paid:.2f}"}}
    if procedure in {"receivables.get", "receivables.createFromInvoice"}:
        return {**receivable(), "payments": state["payments"], "events": state["events"]}
    if procedure == "receivables.recordPayment":
        state["paid"] = "400.00"
        state["status"] = "partial"
        state["payments"] = [{"id": 501, "amount": "400.00", "paidAt": NOW, "method": "transfer", "reference": "TRX-FIXTURE", "note": None, "createdAt": NOW}]
        state["events"] = [{"id": 602, "type": "payment-recorded", "amount": "400.00", "note": None, "createdAt": NOW}, *state["events"]]
        return {"paidAmount": "400.00", "status": "partial"}
    return None


def mock_trpc(route):
    parsed = urlparse(route.request.url)
    procedures = parsed.path.removeprefix("/api/trpc/").split(",")
    body = [{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/receivables", wait_until="networkidle")
    page.get_by_role("heading", name="ติดตามรับชำระ").wait_for(state="visible", timeout=8000)
    page.get_by_label("เลือกใบแจ้งหนี้").select_option("8")
    page.get_by_role("button", name="เพิ่มเข้าลูกหนี้").click()
    page.get_by_role("dialog").wait_for(state="visible", timeout=5000)
    page.get_by_label("จำนวนรับชำระ").fill("400")
    page.get_by_role("button", name="บันทึกการรับชำระ").click()
    page.get_by_text("บันทึกการรับชำระแล้ว").wait_for(state="visible", timeout=5000)
    payment_dialog = page.get_by_role("dialog")
    payment_dialog.get_by_text("฿600.00").wait_for(state="visible", timeout=5000)
    payment_dialog.get_by_text("กิจกรรมล่าสุด").wait_for(state="visible", timeout=5000)
    payment_dialog.locator(".receivable-activity strong").filter(has_text="บันทึกการรับชำระ").wait_for(state="visible", timeout=5000)
    payment_dialog.locator(".receivable-activity strong").filter(has_text="เพิ่มรายการลูกหนี้").wait_for(state="visible", timeout=5000)
    payment_dialog.locator(".receivable-activity").scroll_into_view_if_needed()
    if os.environ.get("TOOLSTHAI_RECEIVABLES_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_RECEIVABLES_SCREENSHOT"])
    payment_dialog.get_by_role("button", name="ปิด", exact=True).last.click()
    page.get_by_role("table").get_by_text("ชำระบางส่วน").wait_for(state="visible", timeout=5000)
    page.get_by_label("ตั้งแต่วันครบกำหนด").fill("2026-09-01")
    page.get_by_role("table").get_by_text("IV-FIXTURE-001").wait_for(state="visible", timeout=5000)
    page.get_by_label("ถึงวันครบกำหนด").fill("2026-08-31")
    page.get_by_text("ไม่พบรายการที่ตรงกับตัวกรอง").wait_for(state="visible", timeout=5000)
    print(json.dumps({"createdFromInvoice": "IV-FIXTURE-001", "partialPayment": "400.00", "remaining": "600.00", "status": "partial"}))
    browser.close()
