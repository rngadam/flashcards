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

    # 4. Open settings to select the speaking skill.
    page.locator("#settings-button").click()
    page.locator("#skills-tab").click()
    page.locator("#preset-skills-button").click()
    page.locator("#close-settings-button").click()

    # 5. Select the "Speaking Practice" skill and deselect others.
    page.get_by_label("Reading & Listening").uncheck()
    page.get_by_label("Speaking Practice").check()

    # 6. Verify voice recognition starts automatically.
    voice_button = page.locator("#voice-input-button")
    expect(voice_button).to_have_class("listening", timeout=5000)

    # 7. Press 'f' to trigger slow replay, which should pause recognition.
    page.keyboard.press('f')
    expect(voice_button).not_to_have_class("listening")

    # 8. Verify that recognition restarts automatically after the slow replay TTS finishes.
    # We give it a generous timeout to account for any TTS delay.
    expect(voice_button).to_have_class("listening", timeout=5000)

    # 9. Navigate away and back to test if the state is correctly managed.
    page.locator("#next-card").click()
    expect(voice_button).to_have_class("listening") # Should be listening on the new card.

    page.locator("#prev-card").click()
    expect(voice_button).to_have_class("listening") # Should be listening again on the first card.

    # 10. Take a screenshot for visual verification of the final state.
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