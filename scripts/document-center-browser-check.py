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
payload = json.dumps({"kind": "invoice", "documentNumber": "IV-FIXTURE-001", "issueDate": "2026-08-27", "dueDate": "2026-09-03", "company": {"name": "Tools Thai Demo", "address": "กรุงเทพฯ", "taxId": "", "phone": "", "email": "", "logoUrl": ""}, "customer": {"name": "ACME Thailand", "address": "กรุงเทพฯ", "taxId": "", "contact": ""}, "items": [{"id": "fixture-item", "name": "บริการรายเดือน", "description": "", "quantity": 1, "unit": "รายการ", "unitPrice": 1000}], "discount": 0, "vatRate": 7, "vatMode": "excluded", "note": "ขอบคุณที่ใช้บริการ", "watermark": False})
state = {"status": "draft", "archived": False, "duplicated": False, "exports": []}


def documents():
    if state["archived"]:
        return []
    rows = [{"id": 8, "kind": "invoice", "documentNumber": "IV-FIXTURE-001", "customerName": "ACME Thailand", "payload": payload, "status": state["status"], "archivedAt": None, "createdAt": NOW, "updatedAt": NOW, "exportCount": len(state["exports"]), "lastExportAt": state["exports"][-1]["createdAt"] if state["exports"] else None}]
    if state["duplicated"]:
        rows.append({"id": 9, "kind": "invoice", "documentNumber": "IV-FIXTURE-001-COPY", "customerName": "ACME Thailand", "payload": payload, "status": "draft", "archivedAt": None, "createdAt": NOW, "updatedAt": NOW, "exportCount": 0, "lastExportAt": None})
    return rows


def response_for(procedure):
    if procedure == "auth.me":
        return user
    if procedure == "documents.list":
        return documents()
    if procedure == "documents.updateStatus":
        state["status"] = "sent"
        return {**documents()[0]}
    if procedure == "documents.setArchived":
        state["archived"] = True
        return None
    if procedure == "documents.duplicate":
        state["duplicated"] = True
        return {"id": 9}
    if procedure == "documents.listExports":
        return state["exports"]
    if procedure == "documents.recordExportForDocument":
        state["exports"].append({"id": 30, "filename": "ใบแจ้งหนี้-ACME.pdf", "createdAt": NOW})
        return {"documentId": 8}
    if procedure == "receivables.getByInvoice":
        return {"id": 101, "invoiceId": 8, "documentNumber": "IV-FIXTURE-001", "totalAmount": "1000.00", "paidAmount": "400.00", "status": "partial", "events": [{"id": 602, "type": "payment-recorded", "paymentId": 501, "amount": "400.00", "note": "โอนแล้ว", "createdAt": NOW}, {"id": 601, "type": "created", "paymentId": None, "amount": "1000.00", "note": "เพิ่มจากใบแจ้งหนี้", "createdAt": NOW}]}
    if procedure == "companyProfile.get":
        return None
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    route.fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    page.get_by_role("heading", name="คลังเอกสารธุรกิจ").wait_for(state="visible", timeout=12000)
    page.get_by_text("IV-FIXTURE-001").wait_for(state="visible", timeout=5000)
    page.get_by_label("เปลี่ยนสถานะ").select_option("sent")
    page.locator(".document-row-title .document-status").filter(has_text="ส่งแล้ว").wait_for(state="visible", timeout=5000)
    page.get_by_role("button", name="ทำสำเนา").click()
    page.get_by_text("IV-FIXTURE-001-COPY").wait_for(state="visible", timeout=5000)
    with page.expect_response(lambda response: "documents.setArchived" in response.url, timeout=5000):
        page.get_by_role("button", name="เก็บถาวร", exact=True).first.click()
    page.reload(wait_until="networkidle")
    if os.environ.get("TOOLSTHAI_DOCUMENT_CENTER_ARCHIVE_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_DOCUMENT_CENTER_ARCHIVE_SCREENSHOT"])
    page.get_by_role("heading", name="ยังไม่มีเอกสารตามเงื่อนไขนี้").wait_for(state="visible", timeout=5000)
    page.get_by_role("button", name="ดูรายการเก็บถาวร").click()
    # The API fixture keeps the archived document out of the default result, so this toggle itself is verified by its active label.
    page.get_by_role("button", name="กำลังดูรายการเก็บถาวร").wait_for(state="visible", timeout=5000)
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    state["archived"] = False
    page.reload(wait_until="networkidle")
    page.get_by_role("button", name="รับชำระ", exact=True).first.click()
    receivable_dialog = page.get_by_role("dialog")
    receivable_dialog.get_by_text("ยอดคงเหลือ").wait_for(state="visible", timeout=5000)
    receivable_dialog.get_by_text("ชำระบางส่วน").wait_for(state="visible", timeout=5000)
    receivable_dialog.get_by_text("บันทึกการรับชำระ").wait_for(state="visible", timeout=5000)
    receivable_dialog.get_by_role("button", name="ปิดสถานะรับชำระ").click()
    page.get_by_role("button", name="แก้ไข").first.click()
    pdf_trigger = page.get_by_role("button", name="ดาวน์โหลด PDF").first
    pdf_trigger.wait_for(state="visible", timeout=8000)
    pdf_trigger.click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("ชื่อไฟล์ PDF").wait_for(state="visible", timeout=5000)
    dialog.get_by_label("ชื่อไฟล์ PDF").fill("ใบแจ้งหนี้: ACME/สิงหาคม")
    dialog.locator("#pdf-confirmation-preview").wait_for(state="visible", timeout=5000)
    if os.environ.get("TOOLSTHAI_DOCUMENT_CENTER_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_DOCUMENT_CENTER_SCREENSHOT"])
    with page.expect_download(timeout=30000) as download_info:
        dialog.get_by_role("button", name="ยืนยันและดาวน์โหลด").click()
    download = download_info.value
    if download.suggested_filename != "ใบแจ้งหนี้- ACME-สิงหาคม.pdf":
        raise AssertionError(f"Unexpected PDF filename: {download.suggested_filename}")
    page.get_by_text("เริ่มดาวน์โหลด PDF และบันทึกประวัติในคลังเอกสารแล้ว").wait_for(state="visible", timeout=8000)
    if not state["exports"]:
        raise AssertionError("PDF export history API was not called")
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    page.get_by_text("ส่งออก PDF 1 ครั้ง", exact=False).wait_for(state="visible", timeout=8000)
    page.get_by_role("button", name="PDF", exact=True).first.click()
    page.get_by_text("ใบแจ้งหนี้-ACME.pdf").wait_for(state="visible", timeout=5000)
    print(json.dumps({"documentCenter": "filter-status-duplicate-archive-resume", "receivableLinkage": "invoice-balance-and-timeline", "pdfConfirmation": "filename-and-live-preview", "pdfDownload": download.suggested_filename, "exportHistory": len(state["exports"])}, ensure_ascii=False))
    browser.close()
