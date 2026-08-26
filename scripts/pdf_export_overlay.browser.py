import json
import os
import time

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TOOLSTHAI_BROWSER_BASE_URL")
if not BASE_URL:
    raise SystemExit("Set TOOLSTHAI_BROWSER_BASE_URL to a running Tools Thai URL before running this browser check.")


def delay_pdf_libraries(route):
    if "html2canvas" in route.request.url or "jspdf" in route.request.url:
        time.sleep(0.65)
    route.continue_()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
        args=["--no-sandbox"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.route("**/*", delay_pdf_libraries)
    page.goto(f"{BASE_URL}/quotation", wait_until="networkidle")
    printable_count = page.locator("#printable-document").count()
    if printable_count != 1:
        raise AssertionError(f"Expected one printable document, found: {printable_count}")
    export_button = page.locator(".document-top-actions .button-download")
    if export_button.count() != 1:
        raise AssertionError(f"Expected one primary export button, found: {export_button.count()}")

    with page.expect_download(timeout=20000) as download_info:
        export_button.click()
        page.wait_for_timeout(120)
        continue_button = page.get_by_role("button", name="ดาวน์โหลดต่อ")
        if continue_button.is_visible():
            continue_button.click()
        overlay = page.locator(".pdf-export-overlay")
        overlay.wait_for(state="visible", timeout=8000)
        status = page.locator(".pdf-export-dialog h2").text_content()
        if status != "กำลังเตรียมเอกสาร":
            raise AssertionError(f"Expected preparing status, received: {status}")

    download = download_info.value
    overlay.wait_for(state="hidden", timeout=12000)
    print(json.dumps({
        "status": status,
        "download": download.suggested_filename,
        "overlayClosed": True,
    }, ensure_ascii=False))
    browser.close()
