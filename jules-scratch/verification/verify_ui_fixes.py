from playwright.sync_api import sync_playwright, expect, Page

def run(page: Page):
    """
    This test verifies that the UI regressions have been fixed.
    It checks for the correct layout of the 'Column Roles' section and
    the visibility of the 'Backup' tab and its content.
    """
    # 1. Set a desktop-sized viewport.
    page.set_viewport_size({"width": 1280, "height": 720})

    # 2. Navigate to the application.
    page.goto("http://localhost:3000")

    # 3. Assert: For a new user, the settings modal should be visible by default.
    expect(page.locator("#settings-modal")).to_be_visible(timeout=10000)

    # 4. Screenshot: Capture the 'Basic' tab to verify the column roles layout.
    page.screenshot(path="jules-scratch/verification/01_column_roles_layout.png")

    # 5. Act: Click the "Backup" tab.
    backup_tab = page.locator("#backup-tab")
    backup_tab.click()

    # 6. Assert: Check that the backup settings panel is visible.
    expect(page.locator("#backup-settings")).to_be_visible()

    # 7. Screenshot: Capture the 'Backup' tab to verify its content is displayed.
    page.screenshot(path="jules-scratch/verification/02_backup_tab.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    run(page)
    browser.close()