import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set viewport and navigate in test mode.
    page.set_viewport_size({"width": 1920, "height": 1080})
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}?test=true')

    # 2. Wait for the app to be ready.
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=15000)

    # 3. Wait for the first card to be visible.
    card_front_content = page.locator("#card-front-content")
    expect(card_front_content).to_contain_text("Man", timeout=5000)

    # 4. Flip to the back.
    page.locator("#flip-card").click()
    expect(card_front_content).not_to_be_visible()

    # 5. Flip back to the front.
    page.locator("#flip-card").click()

    # 6. Assert that the front content has been re-rendered correctly.
    expect(card_front_content).to_be_visible()
    expect(card_front_content).to_contain_text("Man") # Check for one of the possible front-of-card words.

    # 7. Take a screenshot for visual confirmation.
    page.screenshot(path="jules-scratch/verification/flip-cycle-verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()