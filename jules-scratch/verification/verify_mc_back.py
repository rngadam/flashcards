import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set viewport and navigate in test mode.
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}?test=true')

    # 2. Wait for the app to be ready.
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=15000)

    # 3. Open settings and select a Multiple Choice skill.
    settings_modal = page.locator("#settings-modal")
    page.locator("#settings-button").click()
    expect(settings_modal).to_be_visible()

    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click() # Load presets to ensure skill is available

    # Select only the "Listening Comprehension (MC)" skill
    page.get_by_label("(A) Reading & Listening").uncheck()
    page.get_by_label("(D) Listening Comprehension (MC)").check()

    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 4. Answer a multiple choice question.
    # The first card should be "Man". The options will be shuffled.
    # We find the correct option by its text content.
    mc_option = page.locator("#multiple-choice-container button", has_text="Man")
    expect(mc_option).to_be_visible(timeout=5000)
    mc_option.click()

    # 5. Assert that the back of the card is now visible and contains all expected parts.
    card_back_content = page.locator("#card-back-content")
    expect(card_back_content).to_be_visible()
    expect(card_back_content).to_contain_text("Man") # Target Language
    expect(card_back_content).to_contain_text("Άντρας") # Base Language
    expect(card_back_content).to_contain_text("/ˈandras/") # Pronunciation Guide

    # 6. Take a screenshot for visual confirmation.
    page.screenshot(path="jules-scratch/verification/mc-back-verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()