import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            html_file_path = os.path.abspath('index.html')
            await page.goto(f'file://{html_file_path}')

            # Wait a generous amount of time for any async operations to complete
            await page.wait_for_timeout(5000)

            # Take a screenshot to see the final state of the page
            await page.screenshot(path="jules-scratch/verification/final_attempt_screenshot.png")

            # Save the final HTML content for inspection
            content = await page.content()
            with open("jules-scratch/verification/final_attempt_content.html", "w") as f:
                f.write(content)

        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
