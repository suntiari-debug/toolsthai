import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787852800000
USER = {"id": 61, "openId": "fixture-attachment-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
STATE = {"uploaded": False, "deleted": False, "viewed": False}


def attachment():
    return {"id": 901, "paymentId": 701, "originalFilename": "proof.png", "mimeType": "image/png", "sizeBytes": 5, "caption": None, "createdAt": NOW, "thumbnailUrl": None}


def detail():
    attachments = [attachment()] if STATE["uploaded"] and not STATE["deleted"] else []
    return {"id": 301, "invoiceId": 201, "customerId": None, "documentNumber": "IV-PROOF-001", "customerName": "ลูกค้าทดสอบ", "customerAddress": "", "issueDate": NOW, "dueDate": NOW + 86400000, "totalAmount": "1000.00", "paidAmount": "1000.00", "status": "paid", "note": None, "updatedAt": NOW, "payments": [{"id": 701, "amount": "1000.00", "paidAt": NOW, "method": "transfer", "reference": "TRX-PROOF", "note": None, "voidedAt": None, "voidReason": None, "createdAt": NOW, "attachments": attachments}], "events": []}


def receivables_list():
    return {"items": [{"id": 301, "invoiceId": 201, "customerId": None, "documentNumber": "IV-PROOF-001", "customerName": "ลูกค้าทดสอบ", "customerAddress": "", "issueDate": NOW, "dueDate": NOW + 86400000, "totalAmount": "1000.00", "paidAmount": "1000.00", "status": "paid", "note": None, "createdAt": NOW, "updatedAt": NOW}], "summary": {"total": "1000.00", "outstanding": "0.00", "overdue": "0.00", "dueSoon": "0.00", "overdueCount": 0, "dueSoonCount": 0, "collectedThisMonth": "1000.00"}}


def response_for(procedure):
    if procedure == "auth.me": return USER
    if procedure == "receivables.list": return receivables_list()
    if procedure == "documents.list": return []
    if procedure == "receivables.reminderInbox": return {"items": [], "counts": {"unread": 0, "dueSoon": 0, "overdue": 0}}
    if procedure == "receivables.reminderSettings": return {"enabled": False, "daysBeforeDue": [1, 3, 7], "timezone": "Asia/Bangkok", "scheduleCronTaskUid": None, "lastEvaluatedAt": None}
    if procedure == "receivables.get": return detail()
    if procedure == "receivables.uploadPaymentAttachment":
        STATE["uploaded"] = True
        return attachment()
    if procedure == "receivables.viewPaymentAttachment":
        STATE["viewed"] = True
        return {**attachment(), "url": f"{BASE_URL}/fixture-proof.png"}
    if procedure == "receivables.deletePaymentAttachment":
        STATE["deleted"] = True
        return {"deleted": True}
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    route.fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.route("**/fixture-proof.png", lambda route: route.fulfill(status=200, content_type="image/png", body=b"proof"))
    page.goto(f"{BASE_URL}/receivables", wait_until="networkidle")
    page.get_by_role("button", name="รับชำระ").click()
    page.get_by_role("heading", name="หลักฐานการรับชำระ").wait_for(state="visible")
    page.get_by_role("button", name="เลือกไฟล์หรือถ่ายรูป").click()
    page.locator("input[type=file]").set_input_files({"name": "proof.png", "mimeType": "image/png", "buffer": b"proof"})
    page.get_by_text("proof.png").wait_for(state="visible")
    page.get_by_role("button", name="ดูไฟล์", exact=True).click()
    page.wait_for_timeout(150)
    assert STATE["viewed"], "view action must use the protected signed-view procedure"
    page.get_by_role("button", name="ลบหลักฐาน proof.png").click()
    page.get_by_role("button", name="นำออก").click()
    page.get_by_text("ยังไม่มีไฟล์หลักฐานการรับชำระ").wait_for(state="visible")
    assert STATE["uploaded"] and STATE["deleted"], "fixture must traverse upload and soft-delete paths"
    print(json.dumps({"upload": STATE["uploaded"], "view": STATE["viewed"], "softDelete": STATE["deleted"], "viewport": VIEWPORT}))
    browser.close()
