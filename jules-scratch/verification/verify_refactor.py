import os
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Get the absolute path to the index.html file
    file_path = os.path.abspath('index.html')

    # Navigate to the local HTML file with the test parameter
    page.goto(f'file://{file_path}?test=true')

    # Wait for the first card to be visible and have content
    card_front_content = page.locator("#card-front-content")
    expect(card_front_content).not_to_be_empty(timeout=10000) # Increased timeout for initial load

    # Take the final screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as p:
    run_verification(p)