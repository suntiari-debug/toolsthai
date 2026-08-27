import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787792400000
USER = {"id": 41, "openId": "fixture-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "admin", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
STATE = {"read": False, "saved": False, "evaluated": False}
INVOICE_PAYLOAD = {"kind": "invoice", "documentNumber": "IV-REMINDER-001", "issueDate": "2026-08-20", "dueDate": "2026-08-30", "company": {"name": "Fixture Co.", "address": "Bangkok"}, "customer": {"name": "ACME Thailand", "address": "Bangkok"}, "items": [{"id": "fixture-item", "name": "บริการทดสอบ", "description": "", "quantity": 1, "unit": "รายการ", "unitPrice": 1000}], "discount": 0, "vatRate": 0, "vatMode": "none", "note": "", "watermark": False}


def inbox():
    return {"items": [{"id": 701, "receivableId": 101, "invoiceId": 8, "reminderType": "overdue", "dueDate": NOW - 86400000, "dueDateBasis": "2026-08-26", "outstandingAmount": "1000.00", "documentNumber": "IV-REMINDER-001", "customerName": "ACME Thailand", "status": "read" if STATE["read"] else "unread", "readAt": NOW if STATE["read"] else None, "createdAt": NOW}], "counts": {"unread": 0 if STATE["read"] else 1, "dueSoon": 0, "overdue": 0 if STATE["read"] else 1}}


def response_for(procedure):
    if procedure == "auth.me":
        return USER
    if procedure == "companyProfile.get":
        return None
    if procedure == "documents.list":
        return [{"id": 8, "kind": "invoice", "documentNumber": "IV-REMINDER-001", "customerName": "ACME Thailand", "payload": json.dumps(INVOICE_PAYLOAD), "status": "sent", "archivedAt": None, "exportCount": 0, "lastExportAt": None, "createdAt": NOW, "updatedAt": NOW}]
    if procedure == "documents.get":
        return {"id": 8, "kind": "invoice", "documentNumber": "IV-REMINDER-001", "customerName": "ACME Thailand", "payload": json.dumps(INVOICE_PAYLOAD), "status": "sent", "archivedAt": None, "createdAt": NOW, "updatedAt": NOW}
    if procedure == "receivables.list":
        return {"items": [{"id": 101, "invoiceId": 8, "documentNumber": "IV-REMINDER-001", "customerName": "ACME Thailand", "customerAddress": None, "issueDate": NOW, "dueDate": NOW - 86400000, "totalAmount": "1000.00", "paidAmount": "0.00", "status": "overdue", "note": None, "createdAt": NOW, "updatedAt": NOW}], "summary": {"total": "1000.00", "outstanding": "1000.00", "overdue": "1000.00", "dueSoon": "0.00", "overdueCount": 1, "dueSoonCount": 0, "collectedThisMonth": "0.00"}}
    if procedure == "receivables.reminderSettings":
        return {"id": 1, "userId": 41, "enabled": True, "daysBeforeDue": [1, 3, 7], "timezone": "Asia/Bangkok", "scheduleCronTaskUid": "fixture-task", "lastEvaluatedAt": NOW}
    if procedure == "receivables.reminderInbox":
        return inbox()
    if procedure == "receivables.markReminderRead":
        STATE["read"] = True
        return {"updated": True}
    if procedure == "receivables.saveReminderSettings":
        STATE["saved"] = True
        return {"id": 1, "userId": 41, "enabled": True, "daysBeforeDue": [1, 3, 7], "timezone": "Asia/Bangkok", "scheduleCronTaskUid": "fixture-task", "lastEvaluatedAt": NOW}
    if procedure == "receivables.evaluateRemindersNow":
        STATE["evaluated"] = True
        return {"created": 0, "deduplicated": 1, "considered": 1, "skipped": None, "evaluationDate": "2026-08-27"}
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    route.fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/receivables", wait_until="networkidle")
    page.get_by_role("heading", name="ติดตามรับชำระ").wait_for(state="visible", timeout=8000)
    page.get_by_role("heading", name="รายการที่ควรติดตาม").wait_for(state="visible")
    page.get_by_text("1 ใหม่").wait_for(state="visible")
    page.get_by_text("เกินกำหนดชำระ").wait_for(state="visible")
    page.get_by_label("การเตือนติดตามลูกหนี้").get_by_text("IV-REMINDER-001 · ACME Thailand", exact=True).wait_for(state="visible")
    page.get_by_role("button", name="เปิดใบแจ้งหนี้").click()
    page.wait_for_url("**/invoice", timeout=6000)
    page.get_by_text("IV-REMINDER-001").first.wait_for(state="visible")
    page.goto(f"{BASE_URL}/receivables", wait_until="networkidle")
    page.get_by_text("ตั้งค่าการเตือนของฉัน").click()
    page.get_by_role("button", name="ตรวจรายการที่ควรเตือนตอนนี้").click()
    page.get_by_text("ตรวจแล้ว 1 รายการ · สร้างใหม่ 0 รายการ · กันซ้ำ 1 รายการ").wait_for(state="visible")
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    page.get_by_role("heading", name="รายการที่ควรติดตาม").wait_for(state="visible")
    page.get_by_role("button", name="เปิดใบแจ้งหนี้").click()
    page.wait_for_url("**/invoice", timeout=6000)
    assert STATE["read"], "opening a notification must mark it as read through the owner-scoped mutation"
    assert STATE["evaluated"], "admin manual evaluation must use the same dedupe-safe pathway"
    if os.environ.get("TOOLSTHAI_REMINDER_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_REMINDER_SCREENSHOT"], full_page=True)
    print(json.dumps({"inbox": "overdue", "markedRead": STATE["read"], "manualDedupe": STATE["evaluated"], "dashboardInvoiceCta": True, "documentCenterInvoiceCta": True, "viewport": VIEWPORT}))
    browser.close()
