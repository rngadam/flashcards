import os
from playwright.sync_api import sync_playwright, expect

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')
        page.set_viewport_size({"width": 1280, "height": 720})
        page.goto(f'file://{file_path}')

        # Give the app a moment to initialize its default state
        page.wait_for_timeout(1000)

        # Force the desktop layout and show the settings modal
        page.evaluate("() => document.body.classList.add('desktop')")
        page.evaluate("() => document.getElementById('settings-modal').classList.remove('hidden')")

        # Wait for the modal to be populated by the app's JS
        page.wait_for_timeout(500)

        # --- Verification Starts ---

        # 1. Verify Settings Modal
        settings_modal = page.locator("#settings-modal")
        expect(settings_modal).to_be_visible()

        # The default config isn't loaded on first launch, so we need to trigger it.
        page.locator("#load-data").click()
        # Wait for data to load, giving it more time
        expect(page.locator("#column-roles-container > div")).to_be_visible(timeout=15000)
        page.locator("#config-name").fill("Test Config")
        page.locator("#save-config").click()
        expect(page.locator("#top-notification.visible.success")).to_be_visible()

        # Now the default skill should be visible
        expect(page.locator('label:has-text("(A) Reading & Listening")')).to_be_visible()
        page.screenshot(path="jules-scratch/verification/1_settings_skills.png")

        page.locator("#backup-tab").click()
        expect(page.locator("#export-sqlite-button")).to_be_visible()
        page.screenshot(path="jules-scratch/verification/2_settings_backup.png")

        page.evaluate("() => document.getElementById('settings-modal').classList.add('hidden')")

        # 2. Verify Dashboard
        page.evaluate("() => document.getElementById('dashboard-modal').classList.remove('hidden')")
        dashboard_modal = page.locator("#dashboard-modal")
        expect(dashboard_modal).to_be_visible()

        page.screenshot(path="jules-scratch/verification/3_dashboard_planning.png")

        page.locator("#dashboard-learning-tab").click()
        expect(page.locator("#dashboard-learning")).to_be_visible()
        page.screenshot(path="jules-scratch/verification/4_dashboard_learning.png")

        page.locator("#dashboard-words-tab").click()
        expect(page.locator("#dashboard-words")).to_be_visible()
        page.screenshot(path="jules-scratch/verification/5_dashboard_words.png")

        browser.close()

if __name__ == "__main__":
    main()