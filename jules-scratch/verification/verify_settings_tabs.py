import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set viewport and navigate in test mode.
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}?test=true')

    # 2. Wait for the app to be ready.
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=15000)

    # 3. Open settings panel.
    settings_modal = page.locator("#settings-modal")
    page.locator("#settings-button").click()
    expect(settings_modal).to_be_visible()

    # 4. Verify initial "Basic" tab is active and take screenshot.
    expect(page.locator("#basic-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-01-basic.png")

    # 5. Click and verify "Skills" tab.
    page.locator("#skills-tab").click()
    expect(page.locator("#skills-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-02-skills.png")

    # 6. Click and verify "Advanced" tab.
    page.locator("#advanced-tab").click()
    expect(page.locator("#advanced-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-03-advanced.png")

    # 7. Click and verify "Filter" tab.
    page.locator("#filter-tab").click()
    expect(page.locator("#filter-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-04-filter.png")

    # 8. Click and verify "Backup" tab.
    page.locator("#backup-tab").click()
    expect(page.locator("#backup-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-05-backup.png")

    # 9. Click and verify "Dangerous" tab.
    page.locator("#dangerous-tab").click()
    expect(page.locator("#dangerous-settings")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/settings-tab-06-dangerous.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()