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
    expect(page.locator("#card-container")).to_be_visible(timeout=10000)

    # 4. Open settings.
    settings_button = page.locator("#settings-button")
    expect(settings_button).to_be_visible()
    settings_button.click()

    settings_modal = page.locator("#settings-modal")
    expect(settings_modal).to_be_visible()

    # 5. Go to the skills tab and add the voice skill.
    page.locator("#skills-tab").click()
    page.locator("#add-skill-button").click()
    skill_config_modal = page.locator("#skill-config-modal")
    expect(skill_config_modal).to_be_visible()

    # 6. Fill in the new skill form.
    page.locator("#skill-name-input").fill("Voice Test Skill")
    page.locator("#skill-verification-method").select_option("voice")
    expect(page.locator("#skill-validation-column")).to_be_enabled()
    page.locator("#skill-validation-column").select_option("TARGET_LANGUAGE")
    page.locator("#skill-front-columns input[value='BASE_LANGUAGE']").check()
    page.locator("#save-skill-button").click()
    expect(skill_config_modal).to_be_hidden()

    # 7. Close settings.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 8. Select the new skill.
    page.get_by_label("Voice Test Skill").check()

    # 9. Verify the voice input UI is visible and listening automatically.
    voice_container = page.locator("#voice-input-container")
    expect(voice_container).to_be_visible()
    voice_button = page.locator("#voice-input-button")
    expect(voice_button).to_have_class("listening")

    # 10. Click the "I don't know" button.
    i_dont_know_button = page.locator("#i-dont-know")
    expect(i_dont_know_button).to_be_visible()
    i_dont_know_button.click()

    # 11. Verify the card has flipped and the controls are visible.
    expect(page.locator("#card")).to_have_class("flipped")
    expect(voice_button).not_to_have_class("listening")
    expect(page.locator("#i-know")).to_be_visible()
    expect(page.locator("#next-card")).to_be_visible()

    # 12. Take the final screenshot.
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