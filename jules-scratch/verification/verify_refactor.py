from playwright.sync_api import sync_playwright, expect, Page

def run(page: Page):
    """
    This test verifies that the application loads correctly after the refactoring,
    that core UI elements are present, and that basic interactions work as expected.
    """
    # 1. Set a desktop-sized viewport.
    page.set_viewport_size({"width": 1280, "height": 720})

    # 2. Navigate to the application.
    page.goto("http://localhost:3000")

    # 3. Assert: Check that the main card container is visible.
    expect(page.locator("#card-container")).to_be_visible(timeout=10000)

    # 4. Screenshot: Capture the initial state of the application.
    page.screenshot(path="jules-scratch/verification/01_initial_load.png")

    # 5. Act: Click the settings button.
    settings_button = page.locator("#settings-button")
    settings_button.click()

    # 6. Assert: Check that the settings modal is visible.
    expect(page.locator("#settings-modal")).to_be_visible()

    # 7. Screenshot: Capture the settings modal.
    page.screenshot(path="jules-scratch/verification/02_settings_modal.png")

    # 8. Act: Click the "Skills" tab.
    skills_tab = page.locator("#skills-tab")
    skills_tab.click()

    # 9. Assert: Check that the skills list container is visible.
    expect(page.locator("#skills-list-container")).to_be_visible()

    # 10. Screenshot: Capture the skills tab in the settings.
    page.screenshot(path="jules-scratch/verification/03_skills_tab.png")

    # 11. Act: Close the settings modal.
    close_settings_button = page.locator("#close-settings-button")
    close_settings_button.click()

    # 12. Act: Flip the card.
    flip_button = page.locator("#flip-card")
    flip_button.click()

    # 13. Assert: Check that the card has the 'flipped' class.
    expect(page.locator("#card")).to_have_class("flipped", timeout=5000)

    # 14. Screenshot: Capture the flipped card.
    page.screenshot(path="jules-scratch/verification/04_flipped_card.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    run(page)
    browser.close()