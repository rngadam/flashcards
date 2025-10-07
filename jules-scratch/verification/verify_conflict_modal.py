from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3000")

    # Wait for the function to be available on the window object
    page.wait_for_function("!!window.showConflictResolutionModal")

    # Inject JavaScript to call the conflict resolution modal
    # with dummy data
    page.evaluate("""() => {
        const conflicts = [
            {
                key: 'card-A',
                client_version: 1,
                server_version: 2,
                client_data: { prompt: 'Hello', answer: 'Hola' },
                server_data: { prompt: 'Hello', answer: 'Bonjour' },
            },
            {
                key: 'config-1',
                client_version: 3,
                server_version: 4,
                client_data: { theme: 'dark' },
                server_data: { theme: 'light' },
            }
        ];
        window.showConflictResolutionModal(conflicts);
    }""")

    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
