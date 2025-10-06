from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        page.goto("http://localhost:3000")
        page.wait_for_load_state('networkidle')
        print("Page loaded.")
        page.screenshot(path="jules-scratch/verification/01_initial_view.png")

        # --- Adaptive Setup ---
        settings_modal = page.locator("#settings-modal")
        page.wait_for_timeout(1000)

        if not settings_modal.is_visible():
            print("Settings modal not visible. Clicking settings button.")
            page.locator("#settings-button").click()
            expect(settings_modal).to_be_visible()
        else:
            print("Settings modal is already visible (first run scenario).")

        # --- Configure the App (First Run Workflow) ---
        config_name = f"Test-Config-{int(time.time())}"
        config_name_input = page.locator("#config-name")
        expect(config_name_input).to_be_visible()
        config_name_input.fill(config_name)
        print(f"Filled in unique config name: {config_name}")

        page.locator("#load-data").click()
        expect(settings_modal).to_be_visible(timeout=10000)
        print("Data loaded, settings modal remains open for configuration.")

        target_language_selector = page.locator('select[data-column-index="0"]')
        expect(target_language_selector).to_be_visible()
        target_language_selector.select_option("TARGET_LANGUAGE")
        print("Assigned 'Target Language' role to the first column.")

        page.locator("#save-config").click()
        expect(page.locator("#top-notification.success")).to_be_visible(timeout=10000)
        expect(page.locator("#config-selector")).to_have_value(config_name)
        print("Configuration saved successfully.")

        page.locator("#skills-tab").click()
        page.on("dialog", lambda dialog: dialog.accept())
        page.locator("#preset-skills-button").click()

        expect(page.locator(".skill-item")).to_have_count(8, timeout=5000)
        print("Preset skills loaded successfully (8 skills found).")

        page.locator("#close-settings-button").click()
        expect(settings_modal).to_be_hidden()

        expect(page.locator("#card")).to_be_visible(timeout=10000)
        page.wait_for_timeout(1000)

        # --- Debugging Screenshot ---
        print("Taking a screenshot right before the final assertions.")
        page.screenshot(path="jules-scratch/verification/debug_final_view.png")

        # --- Final Verification ---
        active_skill_item = page.locator(".skill-mastery-item.active")
        expect(active_skill_item).to_be_visible()
        active_skill_id = active_skill_item.get_attribute("data-skill-id")
        highlighted_label = page.locator(f"#skill-selector-checkboxes label[for='skill-checkbox-{active_skill_id}']")
        expect(highlighted_label).to_have_class("current-skill-highlight")
        print("Color synchronization verified.")

        expect(page.locator("#success-rate")).to_be_visible()
        expect(page.locator("#success-rate")).not_to_be_empty()
        print("Success rate is visible and has content.")

        page.screenshot(path="jules-scratch/verification/02_final_card_view.png")
        print("Final verification screenshot captured.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as p:
    run(p)

print("Verification script finished.")