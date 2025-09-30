import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set a large, unambiguous desktop viewport.
    page.set_viewport_size({"width": 1920, "height": 1080})

    # Get the absolute path to index.html
    file_path = os.path.abspath('index.html')

    # 2. Navigate to the local index.html file.
    page.goto(f'file://{file_path}')

    # 3. Wait for the application to be ready.
    expect(page.locator("#card-container")).to_be_visible(timeout=15000)

    # 4. Open settings to select the speaking skill.
    page.locator("#settings-button").click()
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()
    page.locator("#close-settings-button").click()

    # 5. Select the "Speaking Practice" skill and deselect others.
    page.get_by_label("Reading & Listening").uncheck()
    speaking_skill_checkbox = page.get_by_label("Speaking Practice")
    expect(speaking_skill_checkbox).to_be_visible()
    speaking_skill_checkbox.check()

    # 6. Verify voice recognition starts automatically on the first card.
    voice_button = page.locator("#voice-input-button")
    voice_feedback = page.locator("#voice-input-feedback")
    expect(voice_button).to_have_class("listening", timeout=5000)
    expect(voice_feedback).to_have_text("Listening...")

    # 7. Manually stop recognition to simulate a user action and dirty the UI state.
    voice_button.click()
    expect(voice_button).not_to_have_class("listening")
    voice_feedback.fill("Some old text from the previous card") # Simulate a stale UI

    # 8. Navigate to the next card.
    page.locator("#next-card").click()

    # 9. Assert that the UI on the new card is correctly reset and listening.
    # This is the core verification for the bug fix.
    expect(voice_button).to_have_class("listening", timeout=5000)
    expect(voice_feedback).to_have_text("Listening...")

    # 10. Take a screenshot for visual verification.
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