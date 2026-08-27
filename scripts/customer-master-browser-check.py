import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")
VIEWPORT = {"width": int(os.environ.get("TOOLSTHAI_VIEWPORT_WIDTH", "1280")), "height": int(os.environ.get("TOOLSTHAI_VIEWPORT_HEIGHT", "720"))}
NOW = 1787846400000
USER = {"id": 51, "openId": "fixture-customer-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
STATE = {"created": False, "selected": False}


def customer(customer_id, name, tax_id, contact, **overrides):
    value = {"id": customer_id, "userId": 51, "customerType": "company", "name": name, "taxId": tax_id, "address": "99 ถนนสุขุมวิท กรุงเทพฯ", "contactName": contact, "phone": "021234567", "email": "contact@example.com", "note": "", "archivedAt": None, "createdAt": NOW, "updatedAt": NOW, "documentCount": 2, "receivableCount": 1, "outstandingAmount": "1500.00"}
    value.update(overrides)
    return value


def customers():
    values = [customer(81, "บริษัท เอซีเอ็มอี (ไทยแลนด์) จำกัด", "0105555555555", "คุณมานี")]
    if STATE["created"]:
        values.insert(0, customer(82, "บริษัท ลูกค้าใหม่ จำกัด", "0105555555556", "คุณสมใจ", documentCount=0, receivableCount=0, outstandingAmount="0.00"))
    return {"items": values, "total": len(values), "page": 1, "pageSize": 10}


def legacy_document():
    return {"kind": "invoice", "documentNumber": "IV-LEGACY-001", "issueDate": "2026-08-27", "dueDate": "2026-09-03", "company": {"name": "บริษัททดสอบ", "address": "กรุงเทพฯ", "taxId": "", "phone": "", "email": "", "logoUrl": ""}, "customer": {"name": "ลูกค้า Legacy", "address": "ที่อยู่เดิม", "taxId": "", "contact": "คุณเก่า"}, "items": [{"id": "legacy-item", "name": "บริการ", "description": "", "quantity": 1, "unit": "รายการ", "unitPrice": 1000}], "discount": 0, "vatRate": 7, "vatMode": "excluded", "note": "", "watermark": False}


def response_for(procedure):
    if procedure == "auth.me":
        return USER
    if procedure == "companyProfile.get":
        return None
    if procedure == "customers.list":
        return customers()
    if procedure == "customers.create":
        STATE["created"] = True
        return {"customer": customers()["items"][0], "duplicateMatches": []}
    if procedure == "customers.setArchived":
        return customer(81, "บริษัท เอซีเอ็มอี (ไทยแลนด์) จำกัด", "0105555555555", "คุณมานี", archivedAt=NOW)
    if procedure == "documents.save":
        return {"success": True}
    return None


def mock_trpc(route):
    procedures = urlparse(route.request.url).path.removeprefix("/api/trpc/").split(",")
    route.fulfill(status=200, content_type="application/json", body=json.dumps([{"result": {"data": {"json": response_for(procedure)}}} for procedure in procedures]))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport=VIEWPORT)
    page.route("**/api/trpc/**", mock_trpc)
    page.goto(f"{BASE_URL}/invoice", wait_until="networkidle")
    page.get_by_text("เลือกจากรายชื่อลูกค้า").wait_for(state="visible", timeout=8000)
    page.get_by_role("button", name="ค้นหาและเลือกลูกค้า").click()
    page.get_by_label("ค้นหาลูกค้า").fill("เอซีเอ็มอี")
    page.get_by_text("บริษัท เอซีเอ็มอี (ไทยแลนด์) จำกัด").click()
    page.get_by_label("ชื่อ", exact=True).wait_for(state="visible")
    assert page.get_by_label("ชื่อ", exact=True).input_value() == "บริษัท เอซีเอ็มอี (ไทยแลนด์) จำกัด"
    assert page.get_by_label("เลขผู้เสียภาษี", exact=True).input_value() == "0105555555555"
    assert page.get_by_label("ผู้ติดต่อ", exact=True).input_value() == "คุณมานี"
    page.get_by_label("ชื่อ", exact=True).fill("ชื่อแก้ไขเฉพาะใบแจ้งหนี้")
    assert page.get_by_label("ชื่อ", exact=True).input_value() == "ชื่อแก้ไขเฉพาะใบแจ้งหนี้"
    page.get_by_role("button", name="เลิกเชื่อม").click()
    page.get_by_role("button", name="เพิ่มลูกค้าใหม่").click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("ชื่อบริษัท / ชื่อลูกค้า").fill("บริษัท ลูกค้าใหม่ จำกัด")
    dialog.get_by_label("เลขประจำตัวผู้เสียภาษี").fill("0105555555556")
    dialog.get_by_role("button", name="บันทึกลูกค้า").click()
    dialog.wait_for(state="hidden", timeout=6000)
    page.get_by_label("ชื่อ", exact=True).wait_for(state="visible")
    assert page.get_by_label("ชื่อ", exact=True).input_value() == "บริษัท ลูกค้าใหม่ จำกัด"
    page.evaluate("payload => sessionStorage.setItem('toolsThai.convertedDocument', JSON.stringify(payload))", legacy_document())
    page.reload(wait_until="networkidle")
    page.get_by_label("ชื่อ", exact=True).wait_for(state="visible")
    assert page.get_by_label("ชื่อ", exact=True).input_value() == "ลูกค้า Legacy"
    assert not page.get_by_text("เชื่อมกับ Customer Master แล้ว").count(), "legacy payload without customerId must remain editable"
    page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    page.get_by_role("heading", name="รายชื่อลูกค้า").wait_for(state="visible")
    page.get_by_text("บริษัท เอซีเอ็มอี (ไทยแลนด์) จำกัด").wait_for(state="visible")
    page.get_by_role("button", name="เก็บ").first.click()
    assert STATE["created"], "compact dialog must create a customer before selecting it"
    if os.environ.get("TOOLSTHAI_CUSTOMER_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_CUSTOMER_SCREENSHOT"], full_page=True)
    print(json.dumps({"pickerFilled": True, "manualOverride": True, "compactCreate": STATE["created"], "legacyPayload": True, "customerPage": True, "viewport": VIEWPORT}))
    browser.close()
