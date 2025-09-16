import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            # Get the absolute path to the index.html file
            html_file_path = os.path.abspath('index.html')

            # 1. Open the local HTML file
            await page.goto(f'file://{html_file_path}')

            # Wait for the app to initialize by waiting for a known button
            await page.wait_for_selector("#settings-button", timeout=5000)
            await page.wait_for_timeout(500) # Extra delay for JS to attach listeners

            # 2. Click the help button and take a screenshot
            help_button = page.locator("#help-button")
            await expect(help_button).to_be_visible()
            await help_button.click(force=True) # Use force click
            await expect(page.locator("#help-modal")).to_be_visible(timeout=5000)
            await page.screenshot(path="jules-scratch/verification/01_help_modal.png")

            # 3. Close the help modal
            close_help_button = page.locator("#close-help-button")
            await close_help_button.click()
            await expect(page.locator("#help-modal")).to_be_hidden()

            # 4. Open settings
            await page.locator("#settings-button").click()
            await expect(page.locator("#settings-modal")).to_be_visible()

            # 5. Navigate to Skills > Writing
            await page.get_by_role("tab", name="Skills").click()

            await page.wait_for_selector("#skill-column-config-container .tab-button")

            skill_tabs = page.locator("#skill-column-config-container .tab-button")
            writing_tab = skill_tabs.filter(has_text="Validated Writing Practice")
            await writing_tab.click()

            # 6. Configure validation column for Writing skill
            validation_selector = page.locator("#validation-column-selector-WRITING")
            await validation_selector.select_option(label="Greek")

            # 7. Select only the "Writing" skill
            await page.get_by_label("Reading Comprehension").uncheck()
            await page.get_by_label("Listening Comprehension").uncheck()
            await page.get_by_label("Validated Writing Practice").check()
            await page.get_by_label("Spoken Production").uncheck()
            await page.get_by_label("Pronunciation Practice").uncheck()

            # 8. Save config
            await page.get_by_label("Configuration Name:").fill("Test Writing Config")
            await page.get_by_role("button", name="Save Configuration").click()

            # 9. Close settings
            await page.locator("#close-settings-button").click()
            await expect(page.locator("#settings-modal")).to_be_hidden()

            # 10. Wait for the card to be displayed and interact
            await expect(page.locator("#writing-practice-container")).to_be_visible(timeout=10000)

            # 11. Enter wrong answer and submit
            await page.locator("#writing-input").fill("a wrong answer")
            await page.get_by_role("button", name="Submit").click()

            # 12. Verify the diff view is shown
            await expect(page.locator("#comparison-container")).to_be_visible()
            await expect(page.locator("#comparison-container")).to_contain_text("Your Answer:")
            await expect(page.locator("#comparison-container")).to_contain_text("Correct Answer:")

            # 13. Take a screenshot of the diff
            await page.screenshot(path="jules-scratch/verification/02_writing_diff.png")

        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
