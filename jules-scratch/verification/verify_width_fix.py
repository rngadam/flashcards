
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.set_viewport_size({"width": 1280, "height": 720})
        page.goto("http://localhost:3000/dictation.html")

        # --- Test with long text to force scrollbars ---

        long_text = " ".join(["longword"] * 200)

        # 1. Create a text entry with long content
        page.locator("#text-title-input").fill("Long Text Test")
        page.locator("#text-content-textarea").fill(long_text)
        page.get_by_role("button", name="Save").evaluate("el => el.click()")
        expect(page.locator("#text-select")).to_have_text("Long Text Test")

        # 2. Fill the input with the same long text
        writing_input = page.locator("#writing-input")
        writing_input.fill(long_text)

        # 3. Get the bounding boxes of the two elements
        text_display_bb = page.locator("#text-display-container").bounding_box()
        writing_input_bb = page.locator("#writing-input").bounding_box()

        # 4. Assert that their widths are identical
        print(f"Text display width: {text_display_bb['width']}")
        print(f"Writing input width: {writing_input_bb['width']}")
        assert abs(text_display_bb['width'] - writing_input_bb['width']) < 1, "Widths should be identical"


        # --- Screenshot for visual confirmation ---
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
