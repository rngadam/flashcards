import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set viewport and navigate.
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}')

    # 2. Handle initial state: if settings modal is open, load data to close it.
    settings_modal = page.locator("#settings-modal")
    if settings_modal.is_visible():
        print("Settings modal is visible, loading data...")
        page.locator("#load-data").click()
        expect(settings_modal).to_be_hidden(timeout=15000)

    # 3. Wait for the data to be fully loaded before proceeding.
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=10000)

    # 4. Open settings to perform verifications within the modal.
    page.locator("#settings-button").click()
    expect(settings_modal).to_be_visible()

    # 5. Go to Skills tab and load presets. This is the key step to ensure selectors are populated.
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()
    # Now we can safely assert that the skill selectors are populated.
    expect(page.get_by_label("(A) Reading & Listening")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/skill-selector.png")

    # 6. Verify "Export to SQLite" button is present.
    page.locator("#backup-tab").click()
    expect(page.locator("#export-sqlite-button")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/sqlite-button.png")

    # 7. Go back to skills tab to select the "Writing Practice" skill for the next test.
    page.locator("#skills-tab").click()
    page.get_by_label("(A) Reading & Listening").uncheck()
    page.get_by_label("(C) Writing Practice").check()

    # 8. Close settings.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 9. Verify writing input attributes now that the correct skill is selected.
    writing_input = page.locator("#writing-input")
    expect(writing_input).to_be_visible()
    expect(writing_input).to_have_attribute("lang", "en")
    expect(writing_input).to_have_attribute("autocomplete", "off")
    page.screenshot(path="jules-scratch/verification/writing-input.png")

    # 10. Verify Dashboard and its tabs.
    page.locator("#dashboard-button").click()
    dashboard_modal = page.locator("#dashboard-modal")
    expect(dashboard_modal).to_be_visible()
    expect(page.locator("#dashboard-planning-tab")).to_have_class("tab-button active")
    page.screenshot(path="jules-scratch/verification/dashboard-planning.png")
    page.locator("#dashboard-learning-tab").click()
    expect(page.locator("#dashboard-learning-tab")).to_have_class("tab-button active")
    page.screenshot(path="jules-scratch/verification/dashboard-learning.png")
    page.locator("#dashboard-words-tab").click()
    expect(page.locator("#dashboard-words-tab")).to_have_class("tab-button active")
    page.screenshot(path="jules-scratch/verification/dashboard-words.png")
    page.locator("#close-dashboard-button").click()
    expect(dashboard_modal).to_be_hidden()

    # 11. Verify filter status indicator click opens the correct tab.
    page.locator("#filter-status-indicator").click()
    expect(settings_modal).to_be_visible()
    expect(page.locator("#filter-tab")).to_have_class("tab-button active")
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(permissions=["microphone"])
        page = context.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()