import asyncio
from playwright.sync_api import sync_playwright, expect

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})

        # Get the absolute path to the index.html file
        import os
        path = os.path.abspath('index.html')

        # Navigate to the local file
        page.goto(f'file://{path}')

        # Wait for the page to load by waiting for a specific element
        expect(page.locator("#card-container")).to_be_visible()

        # Load data first
        print("Loading data...")
        page.evaluate("document.body.classList.add('desktop')") # Ensure desktop view
        # Force the settings modal to be visible
        page.evaluate("document.getElementById('settings-modal').classList.remove('hidden')")
        expect(page.locator("#settings-modal")).to_be_visible()
        page.locator("#load-data").click()
        # Wait for the first card to be visible
        expect(page.locator("#card-front-content span")).to_be_visible()
        # Force the settings modal to be hidden
        page.evaluate("document.getElementById('settings-modal').classList.add('hidden')")
        expect(page.locator("#settings-modal")).to_be_hidden()
        print("Data loaded.")

        # 1. Test Dashboard
        print("Testing Dashboard...")
        # Force the desktop layout to be applied
        page.evaluate("document.body.classList.add('desktop')")

        dashboard_button = page.locator("#dashboard-button")
        expect(dashboard_button).to_be_visible()
        dashboard_button.click()

        dashboard_modal = page.locator("#dashboard-modal")
        expect(dashboard_modal).to_be_visible()

        print("Taking dashboard screenshot...")
        page.screenshot(path="jules-scratch/verification/dashboard.png")

        close_dashboard_button = page.locator("#close-dashboard-button")
        close_dashboard_button.click()
        expect(dashboard_modal).to_be_hidden()
        print("Dashboard test complete.")

        # 2. Test Centered Buttons
        print("Testing centered buttons...")
        controls_container = page.locator("#controls")

        # Check the CSS property
        expect(controls_container).to_have_css("justify-content", "center")

        print("Taking centered controls screenshot...")
        page.screenshot(path="jules-scratch/verification/centered_controls.png")
        print("Centered buttons test complete.")

        # 3. Test "I don't know" on empty input
        # To test this, we need a skill with text input. We can create one.
        print("Testing 'I don't know' on empty input...")

        # Open settings
        page.locator("#settings-button").click()
        expect(page.locator("#settings-modal")).to_be_visible()

        # Go to skills tab
        page.locator("#skills-tab").click()

        # Click "Add New Skill"
        page.locator("#add-skill-button").click()
        expect(page.locator("#skill-config-modal")).to_be_visible()

        # Configure a new skill for writing
        page.locator("#skill-name-input").fill("Writing Test Skill")
        page.locator("#skill-verification-method").select_option("text")

        # Select front and back columns
        page.locator("#skill-front-columns input[value='BASE_LANGUAGE']").check()
        page.locator("#skill-back-columns input[value='TARGET_LANGUAGE']").check()
        page.locator("#skill-validation-column").select_option("TARGET_LANGUAGE")

        # Save the skill
        page.locator("#save-skill-button").click()
        expect(page.locator("#skill-config-modal")).to_be_hidden()

        # Save the configuration
        page.locator("#save-config").click()

        # Close settings
        page.locator("#close-settings-button").click()
        expect(page.locator("#settings-modal")).to_be_hidden()

        # Select the new skill
        page.locator("label[title='Writing Test Skill']").click()

        # Wait for the writing input to appear
        writing_input = page.locator("#writing-input")
        expect(writing_input).to_be_visible()

        # Get the current card's front text to confirm it changes
        card_front_text = page.locator("#card-front-content").inner_text()

        # Submit with empty input
        page.locator("#writing-submit").click()

        # Wait for the next card to load. We can check that the front text has changed.
        expect(page.locator("#card-front-content")).not_to_have_text(card_front_text)

        print("'I don't know' test complete.")

        browser.close()

if __name__ == "__main__":
    main()
