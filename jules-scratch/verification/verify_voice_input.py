import os
from playwright.sync_api import sync_playwright, expect

def run_verification(page):
    # 1. Set a large, unambiguous desktop viewport to ensure the desktop layout is active.
    page.set_viewport_size({"width": 1920, "height": 1080})

    # Get the absolute path to index.html
    file_path = os.path.abspath('index.html')

    # 2. Navigate to the local index.html file
    page.goto(f'file://{file_path}')

    # 3. Wait for the application to be ready by checking for a card.
    expect(page.locator("#card-container")).to_be_visible(timeout=10000)

    # 4. Open settings. By asserting the desktop button is visible, we confirm the layout.
    settings_button = page.locator("#settings-button")
    expect(settings_button).to_be_visible()
    settings_button.click()

    settings_modal = page.locator("#settings-modal")
    expect(settings_modal).to_be_visible()

    # 5. Go to the skills tab and add a new skill.
    page.locator("#skills-tab").click()
    page.locator("#add-skill-button").click()
    skill_config_modal = page.locator("#skill-config-modal")
    expect(skill_config_modal).to_be_visible()

    # 6. Fill in the new skill form.
    page.locator("#skill-name-input").fill("Voice Test Skill")
    page.locator("#skill-verification-method").select_option("voice")

    # Set the validation column.
    expect(page.locator("#skill-validation-column")).to_be_enabled()
    page.locator("#skill-validation-column").select_option("TARGET_LANGUAGE")

    # Set the front of the card to show the base language.
    page.locator("#skill-front-columns input[value='BASE_LANGUAGE']").check()

    # Save the skill.
    page.locator("#save-skill-button").click()
    expect(skill_config_modal).to_be_hidden()

    # 7. Close settings to return to the flashcard view.
    page.locator("#close-settings-button").click()
    expect(settings_modal).to_be_hidden()

    # 8. Select the new skill for practice.
    page.get_by_label("Voice Test Skill").check()

    # 9. Assert that the voice input UI is now visible.
    voice_container = page.locator("#voice-input-container")
    expect(voice_container).to_be_visible()

    # 10. Take a screenshot for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant microphone permissions for voice recognition.
        context = browser.new_context(permissions=["microphone"])
        page = context.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()