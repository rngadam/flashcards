from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the verification file
        file_path = os.path.abspath('jules-scratch/verification/final_verification.html')

        # Go to the local HTML file
        page.goto(f'file://{file_path}')

        # Wait for the card container to be visible
        card_container = page.locator('#card-container')
        card_container.wait_for(state='visible')

        # Take a screenshot
        page.screenshot(path='jules-scratch/verification/final_verification.png')

        browser.close()

if __name__ == "__main__":
    run()
