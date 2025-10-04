from playwright.sync_api import sync_playwright, expect, Page

def run(page: Page):
    """
    This test provides a comprehensive verification of all recent UI fixes:
    1. The layout of the 'Column Roles' section.
    2. The visibility of the 'Backup' tab and its content.
    3. The data-dependent rendering of the History and Dashboard modals.
    """
    # 1. Set a desktop-sized viewport.
    page.set_viewport_size({"width": 1280, "height": 800})

    # 2. Navigate to the application.
    page.goto("http://localhost:3000")

    # 3. Assert: For a new user, the settings modal should be visible by default.
    settings_modal = page.locator("#settings-modal")
    expect(settings_modal).to_be_visible(timeout=10000)

    # 4. Screenshot: Capture the 'Basic' tab to verify the column roles layout.
    # We expect to see a two-column grid.
    page.screenshot(path="jules-scratch/verification/01_column_roles_layout.png")

    # 5. Act: Click the "Backup" tab.
    backup_tab = page.locator("#backup-tab")
    backup_tab.click()

    # 6. Assert: Check that the backup settings panel is visible.
    backup_panel = page.locator("#backup-settings")
    expect(backup_panel).to_be_visible()

    # 7. Screenshot: Capture the 'Backup' tab to verify its content is displayed.
    page.screenshot(path="jules-scratch/verification/02_backup_tab.png")

    # 8. Act: Load the default data to enable the other features.
    load_data_button = page.locator("#load-data")
    load_data_button.click()

    # 9. Assert: Wait for the settings modal to close after loading data.
    expect(settings_modal).to_be_hidden(timeout=10000)

    # 10. Act: Click the "History" button.
    history_button = page.locator("#history-button")
    history_button.click()

    # 11. Assert: The history modal should be visible and contain a table.
    history_modal = page.locator("#history-modal")
    expect(history_modal).to_be_visible()
    expect(history_modal.locator("table")).to_be_visible()

    # 12. Screenshot: Capture the populated History modal.
    page.screenshot(path="jules-scratch/verification/03_history_modal.png")

    # 13. Act: Close the history modal.
    close_history_button = page.locator("#close-history-button")
    close_history_button.click()
    expect(history_modal).to_be_hidden()

    # 14. Act: Click the "Dashboard" button.
    dashboard_button = page.locator("#dashboard-button")
    dashboard_button.click()

    # 15. Assert: The dashboard modal should be visible and contain content.
    dashboard_modal = page.locator("#dashboard-modal")
    expect(dashboard_modal).to_be_visible()
    expect(dashboard_modal.locator("#planning-buckets")).not_to_be_empty()

    # 16. Screenshot: Capture the populated Dashboard modal.
    page.screenshot(path="jules-scratch/verification/04_dashboard_modal.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    run(page)
    browser.close()