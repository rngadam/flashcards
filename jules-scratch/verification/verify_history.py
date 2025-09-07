from playwright.sync_api import sync_playwright, Page, expect
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(storage_state=None)
    page = context.new_page()

    page.goto("http://localhost:8000")

    # --- Load data and save config ---
    expect(page.locator("#settings-modal")).to_be_visible()
    page.locator("#config-name").fill("History Test")
    page.get_by_role("button", name="Load Data").click()
    expect(page.locator("#settings-modal")).to_be_hidden()

    page.get_by_role("button", name="⚙️").click()
    page.get_by_role("button", name="Save Configuration").click()
    page.locator("#close-settings-button").click()

    # --- Interact with some cards ---
    # View card 0, mark as known
    page.get_by_role("button", name="I know this (k)").click()
    # View card 1
    page.get_by_role("button", name="Next (→)").click()

    # --- Test Persistence ---
    page.reload()
    # The last config should be loaded automatically
    expect(page.locator("#config-title")).to_contain_text("History Test")

    # --- Test History UI ---
    page.get_by_role("button", name="📜").click()
    expect(page.locator("#history-modal")).to_be_visible()
    page.wait_for_timeout(500) # Wait for table to render

    # Check for a few key things in the table
    header_texts = page.locator("#history-table-container th").all_text_contents()
    assert "Retention Score" in header_texts

    # Check the stats for the first card ("αλλά") in the history table
    row = page.locator("td:has-text('αλλά')").locator("xpath=..")
    expect(row.locator("td").nth(4)).to_contain_text("1") # Retention score
    expect(row.locator("td").nth(5)).to_contain_text("2") # View count

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    # Clean up
    context.clear_cookies()
    page.evaluate("() => localStorage.clear()")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
