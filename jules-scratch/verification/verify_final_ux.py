import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set a large, unambiguous desktop viewport.
    page.set_viewport_size({"width": 1920, "height": 1080})

    # Get the absolute path to index.html
    file_path = os.path.abspath('index.html')

    # 2. Navigate to the local index.html file.
    page.goto(f'file://{file_path}')

    # 3. Wait for the application to be ready by checking for a card.
    expect(page.locator("#card-container")).to_be_visible(timeout=15000)

    # 4. Open settings.
    page.locator("#settings-button").click()
    settings_modal = page.locator("#settings-modal")
    expect(settings_modal).to_be_visible()

    # 5. Load preset skills and set the new configurable delay.
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()
    page.locator("#advanced-tab").click()
    delay_input = page.locator("#voice-correct-delay")
    expect(delay_input).to_be_visible()
    delay_input.fill("500")

    # 6. Close settings.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 7. Select the "Speaking Practice" skill and deselect others.
    page.get_by_label("Reading & Listening").uncheck()
    speaking_skill_checkbox = page.get_by_label("Speaking Practice")
    expect(speaking_skill_checkbox).to_be_visible()
    speaking_skill_checkbox.check()

    # 8. Verify voice recognition starts automatically and the UI is correct.
    voice_container = page.locator("#voice-input-container")
    expect(voice_container).to_be_visible()

    voice_button = page.locator("#voice-input-button")
    voice_feedback = page.locator("#voice-input-feedback")

    # The `onstart` event should fire, making the button "listening" and updating the text.
    expect(voice_button).to_have_class("listening", timeout=5000)
    expect(voice_feedback).to_have_text("Listening...")

    # 9. Take a screenshot for visual verification.
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