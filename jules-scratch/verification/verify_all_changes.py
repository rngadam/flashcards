import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set viewport and navigate in test mode.
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}?test=true')

    # 2. Wait for the app to be ready. The 'debug-data-loaded' class is our signal.
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=15000)

    # 3. Open settings to perform verifications.
    settings_modal = page.locator("#settings-modal")
    page.locator("#settings-button").click()
    expect(settings_modal).to_be_visible()

    # 4. Load presets and verify skill selector format.
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()
    expect(page.get_by_label("(A) Reading & Listening")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/skill-selector.png")

    # 5. Verify "Export to SQLite" button.
    page.locator("#backup-tab").click()
    expect(page.locator("#export-sqlite-button")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/sqlite-button.png")

    # 6. Select "Writing Practice" skill for the next test.
    page.locator("#skills-tab").click()
    page.get_by_label("(A) Reading & Listening").uncheck()
    page.get_by_label("(C) Writing Practice").check()

    # 7. Close settings.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 8. Verify writing input attributes.
    writing_input = page.locator("#writing-input")
    expect(writing_input).to_be_visible()
    expect(writing_input).to_have_attribute("lang", "en")
    expect(writing_input).to_have_attribute("autocomplete", "off")
    page.screenshot(path="jules-scratch/verification/writing-input.png")

    # 9. Verify Dashboard and its tabs.
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

    # 10. Verify filter status indicator click.
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