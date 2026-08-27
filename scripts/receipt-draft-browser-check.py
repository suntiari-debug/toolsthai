import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787792400000
USER = {"id": 41, "openId": "fixture-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
STATE = {"paid": "400.00", "status": "partial", "draft": None, "create_calls": 0}


def payload():
    return json.dumps({"kind": "receipt", "documentNumber": "RC-202608-0101", "issueDate": "2026-08-27", "dueDate": "2026-08-27", "company": {"name": "Fixture Co.", "address": "Bangkok", "taxId": "0100000000000", "phone": "", "email": "", "logoUrl": ""}, "customer": {"name": "ACME Thailand", "address": "Bangkok", "taxId": "", "contact": ""}, "items": [{"id": "fixture-item", "name": "บริการตัวอย่าง", "description": "", "quantity": 1, "unit": "รายการ", "unitPrice": 1000}], "discount": 0, "vatRate": 7, "vatMode": "excluded", "note": "ขอบคุณ", "watermark": False, "receiptSource": {"sourceInvoiceId": 8, "sourceReceivableId": 101, "activePaymentIds": [501, 502], "paymentTotalAtCreation": "1070.00", "createdFrom": "receivable-paid", "sourceInvoiceNumber": "IV-FIXTURE-001"}})


def receivable():
    return {"id": 101, "invoiceId": 8, "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "customerAddress": None, "issueDate": NOW, "dueDate": NOW + 7 * 86400000, "totalAmount": "1070.00", "paidAmount": STATE["paid"], "status": STATE["status"], "note": None, "createdAt": NOW, "updatedAt": NOW}


def payments():
    result = [{"id": 501, "amount": "400.00", "paidAt": NOW, "method": "transfer", "reference": "TRX-401", "note": None, "voidedAt": None, "voidReason": None, "createdAt": NOW}]
    if STATE["status"] == "paid":
        result.append({"id": 502, "amount": "670.00", "paidAt": NOW, "method": "cash", "reference": "", "note": None, "voidedAt": None, "voidReason": None, "createdAt": NOW})
    return result


def eligibility():
    is_paid = STATE["status"] == "paid"
    return {"eligible": is_paid, "reason": None if is_paid else "ออกใบเสร็จได้เมื่อยอดคงเหลือเป็น ฿0.00", "receivable": {**receivable(), "paymentTotal": STATE["paid"], "outstanding": f"{1070 - float(STATE['paid']):.2f}"}, "invoice": {"id": 8, "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "payload": json.dumps({"kind": "invoice", "documentNumber": "IV-FIXTURE-001"})}, "payments": payments(), "receiptDraft": STATE["draft"], "sourceChanged": bool(STATE["draft"])}


def response_for(procedure):
    if procedure == "auth.me":
        return USER
    if procedure == "companyProfile.get":
        return None
    if procedure == "documents.list":
        return [{"id": 8, "kind": "invoice", "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "payload": json.dumps({"kind": "invoice"}), "status": "sent", "archivedAt": None, "exportCount": 0, "lastExportAt": None, "createdAt": NOW, "updatedAt": NOW}]
    if procedure == "receivables.list":
        return {"items": [receivable()], "summary": {"total": "1070.00", "outstanding": f"{1070 - float(STATE['paid']):.2f}", "overdue": "0.00", "dueSoon": "0.00", "collectedThisMonth": STATE["paid"]}}
    if procedure == "receivables.get":
        return {**receivable(), "payments": payments(), "events": [{"id": 601, "type": "payment-recorded", "paymentId": 501, "amount": "400.00", "note": None, "createdAt": NOW}]}
    if procedure == "receivables.recordPayment":
        STATE["paid"] = "1070.00"
        STATE["status"] = "paid"
        return {"paidAmount": "1070.00", "status": "paid"}
    if procedure == "receivables.receiptEligibility":
        return eligibility()
    if procedure == "receivables.createReceiptDraft":
        STATE["create_calls"] += 1
        if not STATE["draft"]:
            STATE["draft"] = {"id": 77, "documentNumber": "RC-202608-0101", "payload": payload(), "createdAt": NOW}
            return {**STATE["draft"], "created": True}
        return {**STATE["draft"], "created": False}
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
    row = page.get_by_role("row").filter(has_text="IV-FIXTURE-001")
    receipt_button = row.get_by_role("button", name="ใบเสร็จ")
    assert receipt_button.is_disabled(), "partial receivable must not open a receipt draft"
    row.get_by_text("ออกใบเสร็จได้เมื่อยอดคงเหลือเป็น ฿0.00").wait_for(state="visible")
    row.get_by_role("button", name="รับชำระ").click()
    payment_dialog = page.get_by_role("dialog")
    payment_dialog.get_by_label("จำนวนรับชำระ").fill("670")
    payment_dialog.get_by_role("button", name="บันทึกการรับชำระ").click()
    receipt_sheet = page.get_by_role("dialog", name="เตรียมออกใบเสร็จ")
    receipt_sheet.get_by_text("ชำระครบแล้ว").wait_for(state="visible", timeout=5000)
    receipt_sheet.get_by_text("IV-FIXTURE-001").wait_for(state="visible")
    receipt_sheet.get_by_role("button", name="เปิดฉบับร่างใบเสร็จ").click()
    page.wait_for_url("**/receipt", timeout=6000)
    page.get_by_text("สร้างจากใบแจ้งหนี้ IV-FIXTURE-001").wait_for(state="visible", timeout=6000)
    page.get_by_text("ข้อมูลการรับชำระเปลี่ยนแล้ว").wait_for(state="visible")
    page.goto(f"{BASE_URL}/receivables", wait_until="networkidle")
    row = page.get_by_role("row").filter(has_text="IV-FIXTURE-001")
    row.get_by_role("button", name="ใบเสร็จ").click()
    receipt_sheet = page.get_by_role("dialog", name="เตรียมออกใบเสร็จ")
    receipt_sheet.get_by_text("มีใบเสร็จฉบับร่างอยู่แล้ว").wait_for(state="visible")
    receipt_sheet.get_by_role("button", name="เปิดใบเสร็จฉบับร่าง").click()
    page.wait_for_url("**/receipt", timeout=6000)
    assert STATE["create_calls"] == 2, "second action must open existing draft instead of producing a new fixture draft"
    if os.environ.get("TOOLSTHAI_RECEIPT_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_RECEIPT_SCREENSHOT"], full_page=True)
    print(json.dumps({"partialBlocked": True, "paidReceiptDraft": "RC-202608-0101", "idempotentReopen": True, "sourcePaymentWarning": True, "createCalls": STATE["create_calls"]}))
    browser.close()
