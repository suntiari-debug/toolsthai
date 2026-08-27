import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787856400000
USER = {"id": 71, "openId": "fixture-revision-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
LEGACY_PAYLOAD = {"kind": "quotation", "documentNumber": "QT-REV-001", "issueDate": "2026-08-27", "dueDate": "2026-09-26", "customer": {"name": "ลูกค้าเดิม", "address": "ถนนเดิม", "taxId": "", "contact": ""}, "company": {"name": "บริษัททดสอบ", "address": "", "taxId": "", "phone": "", "email": "", "logoUrl": ""}, "items": [{"id": "item-1", "name": "บริการ", "description": "", "quantity": 1, "unit": "รายการ", "unitPrice": 1000}], "discount": 0, "vatRate": 7, "vatMode": "excluded", "note": "", "watermark": False, "template": "modern", "accentColor": "#0d7a75", "fontFamily": "sarabun", "fontSize": "medium"}
UPDATED_PAYLOAD = {**LEGACY_PAYLOAD, "customer": {**LEGACY_PAYLOAD["customer"], "name": "ลูกค้าใหม่"}}
STATE = {"restored": False, "editorDrawer": False}


def document_list():
    return [{"id": 501, "customerId": None, "kind": "quotation", "documentNumber": "QT-REV-001", "customerName": "ลูกค้าเดิม", "payload": json.dumps(LEGACY_PAYLOAD), "status": "draft", "archivedAt": None, "updatedAt": NOW, "createdAt": NOW, "exportCount": 1, "lastExportAt": NOW}]


def revisions():
    return {"items": [{"id": 802, "revisionNumber": 2, "summary": "แก้ไขชื่อลูกค้า", "createdAt": NOW + 1000, "actorId": 71}, {"id": 801, "revisionNumber": 1, "summary": "เก็บ snapshot ก่อนเริ่มประวัติรุ่นเอกสาร", "createdAt": NOW, "actorId": 71}], "total": 2, "page": 1, "pageSize": 10}


def response_for(procedure):
    if procedure == "auth.me": return USER
    if procedure == "documents.list": return document_list()
    if procedure == "documents.listRevisions": return revisions()
    if procedure == "documents.getRevisionPreview": return {"id": 802, "documentId": 501, "revisionNumber": 2, "summary": "แก้ไขชื่อลูกค้า", "payload": json.dumps(UPDATED_PAYLOAD), "createdAt": NOW + 1000, "actorId": 71}
    if procedure == "documents.restoreRevision":
        STATE["restored"] = True
        return {"documentId": 501, "revisionNumber": 3, "payload": json.dumps(UPDATED_PAYLOAD), "kind": "quotation"}
    if procedure == "receivables.reminderInbox": return {"items": [], "counts": {"unread": 0, "dueSoon": 0, "overdue": 0}}
    if procedure == "companyProfile.get": return None
    if procedure == "customers.list": return {"items": [], "total": 0, "page": 1, "pageSize": 20}
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    route.fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    page.get_by_role("button", name="รุ่น").click()
    page.get_by_role("heading", name="QT-REV-001").wait_for(state="visible")
    page.locator(".revision-history-list li").first.locator("button").first.click()
    page.get_by_text("ลูกค้าใหม่").wait_for(state="visible")
    page.locator(".revision-history-list li").first.get_by_role("button", name="สร้างฉบับใหม่").click()
    page.get_by_role("button", name="สร้างฉบับใหม่จากรุ่นนี้").click()
    page.wait_for_timeout(120)
    assert STATE["restored"], "restore must call the owner-scoped restore-as-new procedure"
    page.get_by_role("button", name="ปิดประวัติรุ่นเอกสาร").click()
    page.get_by_role("button", name="แก้ไข").click()
    page.wait_for_url("**/quotation")
    page.get_by_role("button", name="รุ่นเอกสาร").wait_for(state="visible")
    page.get_by_role("button", name="รุ่นเอกสาร").click()
    page.get_by_text("เก็บประวัติแบบไม่ลบอัตโนมัติ").wait_for(state="visible")
    STATE["editorDrawer"] = True
    print(json.dumps({"centerPreview": True, "restoreAsNew": STATE["restored"], "editorDrawer": STATE["editorDrawer"], "viewport": VIEWPORT}))
    browser.close()
