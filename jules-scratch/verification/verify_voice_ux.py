import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set a large, unambiguous desktop viewport.
    page.set_viewport_size({"width": 1920, "height": 1080})

    # Get the absolute path to index.html
    file_path = os.path.abspath('index.html')

    # 2. Navigate to the local index.html file.
    page.goto(f'file://{file_path}')

    # 3. Wait for the application to be ready and data to be loaded.
    expect(page.locator("#card-container")).to_be_visible(timeout=15000)
    expect(page.locator('body')).to_have_class("debug-data-loaded", timeout=10000)

    # 4. Open settings to select the speaking skill.
    settings_button = page.locator("#settings-button")
    expect(settings_button).to_be_visible()
    settings_button.click()

    settings_modal = page.locator("#settings-modal")
    expect(settings_modal).to_be_visible()

    # 5. Click the "Load Preset Skills" button to ensure the new skills are present.
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()

    # 6. Close settings.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 7. Select the "Speaking Practice" skill.
    # Uncheck other skills first to ensure a clean state.
    page.get_by_label("Reading & Listening").uncheck()
    speaking_skill_checkbox = page.get_by_label("Speaking Practice")
    expect(speaking_skill_checkbox).to_be_visible()
    speaking_skill_checkbox.check()

    # 8. Verify the new UI is visible and listening.
    voice_container = page.locator("#voice-input-container")
    expect(voice_container).to_be_visible()

    # The container should now have a row layout.
    expect(voice_container).to_have_css("flex-direction", "row")

    voice_button = page.locator("#voice-input-button")
    expect(voice_button).to_have_class("listening", timeout=5000) # Wait for TTS to finish

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