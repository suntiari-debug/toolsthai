import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")

NOW = 1787738400000
USER = {"id": 41, "openId": "fixture-owner", "email": "owner@example.com", "name": "Fixture Owner", "loginMethod": "manus", "role": "user", "createdAt": NOW, "updatedAt": NOW, "lastSignedIn": NOW}
DOCUMENT = {"id": 12, "kind": "quotation", "documentNumber": "QT-FIXTURE-001", "customerName": "ACME Thailand", "payload": "{}", "status": "sent", "archivedAt": None, "updatedAt": NOW, "createdAt": NOW, "exportCount": 2, "lastExportedAt": NOW}
EXPORTS = [{"id": 30, "filename": "ใบเสนอราคา ACME.pdf", "createdAt": NOW}, {"id": 29, "filename": "QT-FIXTURE-001.pdf", "createdAt": NOW - 86400000}]


def fixture_response(procedure, empty_exports=False):
    if procedure == "auth.me":
        return USER
    if procedure == "documents.list":
        return [DOCUMENT]
    if procedure == "documents.listExports":
        return [] if empty_exports else EXPORTS
    return None


def mock_trpc(route, empty_exports=False):
    parsed = urlparse(route.request.url)
    if not parsed.path.startswith("/api/trpc/"):
      route.continue_()
      return
    procedures = parsed.path.removeprefix("/api/trpc/").split(",")
    body = [{"result": {"data": {"json": fixture_response(procedure, empty_exports)}}} for procedure in procedures]
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.route("**/api/trpc/**", lambda route: mock_trpc(route, empty_exports=False))
    page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    page.get_by_role("button", name="PDF 2").wait_for(state="visible", timeout=8000)
    page.get_by_role("button", name="PDF 2").click()
    page.get_by_text("ประวัติการส่งออก QT-FIXTURE-001").wait_for(state="visible", timeout=5000)
    page.get_by_text("ใบเสนอราคา ACME.pdf").wait_for(state="visible", timeout=5000)
    timestamp = page.locator(".export-history-list span").first.text_content()
    if not timestamp or "2569" not in timestamp:
        raise AssertionError(f"Expected a Thai calendar timestamp, received: {timestamp}")
    if os.environ.get("TOOLSTHAI_DOCUMENT_HISTORY_SCREENSHOT"):
        page.screenshot(path=os.environ["TOOLSTHAI_DOCUMENT_HISTORY_SCREENSHOT"])
    empty_page = browser.new_page(viewport={"width": 1280, "height": 720})
    empty_page.route("**/api/trpc/**", lambda route: mock_trpc(route, empty_exports=True))
    empty_page.goto(f"{BASE_URL}/documents", wait_until="networkidle")
    empty_page.get_by_role("button", name="PDF 2").click()
    empty_page.get_by_text("ยังไม่พบประวัติการส่งออก PDF").wait_for(state="visible", timeout=5000)
    print(json.dumps({"historyCount": 2, "dialogFilename": "ใบเสนอราคา ACME.pdf", "timestamp": timestamp, "emptyState": True}, ensure_ascii=False))
    browser.close()
