from playwright.sync_api import sync_playwright, expect

def test_logging_toggle(page):
    """
    Verifies that the logging toggle exists and can be interacted with.
    """
    # 1. Arrange: Go to the alphabet.html page served by the local server.
    print("Navigating to http://localhost:8000/alphabet.html")
    page.goto("http://localhost:8000/alphabet.html", timeout=15000)

    # 2. Assert: Check that the logging toggle is present.
    print("Checking for logging toggle...")
    logging_toggle = page.locator("#logging-toggle")
    expect(logging_toggle).to_be_visible()
    print("Logging toggle is visible.")

    # 3. Act: Click the logging toggle.
    logging_toggle.check()
    expect(logging_toggle).to_be_checked()
    print("Logging toggle has been checked.")

    # 4. Screenshot: Capture the state for visual verification.
    page.screenshot(path="jules-scratch/verification/logging_toggle_enabled.png")
    print("Screenshot captured with logging toggle enabled.")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        test_logging_toggle(page)
        print("Verification script for logging toggle completed successfully.")
    except Exception as e:
        print(f"An error occurred during verification: {e}")
    finally:
        browser.close()
