#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Page Utilities

Helper functions for page operations
"""

import asyncio
from typing import Dict, Any, List, Optional
from pycore.pyfoundations.color_print import ColorPrint


class PageWrapper:
    """
    Minimal Page Wrapper

    Provides a lightweight page interface compatible with ScreenshotManager.
    Wraps a Selenium WebDriver to provide screenshot() method.

    This wrapper is useful when you have a driver but not a full Page object,
    and need to take screenshots using ScreenshotManager.
    """

    def __init__(self, driver):
        """
        Initialize page wrapper

        Args:
            driver: Selenium WebDriver instance
        """
        if not driver:
            ColorPrint.red('[PageWrapper] Driver is required')
            raise ValueError('Driver is required')

        self.driver = driver

    def screenshot(self, options: Dict[str, Any] = None) -> Optional[bytes]:
        """
        Take screenshot

        Compatible with ScreenshotManager's expected interface.

        Args:
            options: Screenshot options
                - path: Save path (optional)

        Returns:
            Screenshot bytes, or None if failed

        Example:
            wrapper = PageWrapper(driver)
            screenshot_bytes = wrapper.screenshot({'path': '/tmp/screenshot.png'})
        """
        options = options or {}
        path = options.get('path')

        if not self.driver:
            ColorPrint.red('[PageWrapper] Driver is None')
            return None

        try:
            if path:
                # Save to file and read back
                self.driver.save_screenshot(path)
                with open(path, 'rb') as f:
                    return f.read()
            else:
                # Return bytes directly
                return self.driver.get_screenshot_as_png()
        except Exception as error:
            ColorPrint.red(f'[PageWrapper] Screenshot failed: {error}')
            return None


class PageUtils:
    """Utility functions for page operations"""

    @staticmethod
    async def wait_for_load(page: Any, timeout: int = 30):
        """
        Wait for page to fully load

        Args:
            page: Page instance
            timeout: Timeout in seconds
        """
        try:
            script = """
            return document.readyState === 'complete';
            """

            start_time = asyncio.get_event_loop().time()
            while True:
                ready = await page.evaluate(script)
                if ready:
                    break

                if asyncio.get_event_loop().time() - start_time > timeout:
                    raise TimeoutError('Page load timeout')

                await asyncio.sleep(0.1)

            ColorPrint.debug('Page fully loaded')
        except Exception as error:
            ColorPrint.red(f'Failed to wait for page load: {error}')
            raise

    @staticmethod
    async def inject_script(page: Any, script_url: str):
        """
        Inject external script into page

        Args:
            page: Page instance
            script_url: Script URL
        """
        try:
            inject_script = f"""
            const script = document.createElement('script');
            script.src = '{script_url}';
            document.head.appendChild(script);
            """
            await page.evaluate(inject_script)

            ColorPrint.debug(f"Script injected: {script_url}")
        except Exception as error:
            ColorPrint.red(f'Failed to inject script: {error}')
            raise

    @staticmethod
    async def get_cookies(page: Any) -> List[Dict[str, Any]]:
        """
        Get page cookies

        Args:
            page: Page instance

        Returns:
            List of cookie dictionaries
        """
        try:
            cookies = page.driver.get_cookies()
            return cookies
        except Exception as error:
            ColorPrint.red(f'Failed to get cookies: {error}')
            raise

    @staticmethod
    async def set_cookies(page: Any, cookies: List[Dict[str, Any]]):
        """
        Set page cookies

        Args:
            page: Page instance
            cookies: List of cookie dictionaries
        """
        try:
            for cookie in cookies:
                page.driver.add_cookie(cookie)

            ColorPrint.debug(f"Set {len(cookies)} cookies")
        except Exception as error:
            ColorPrint.red(f'Failed to set cookies: {error}')
            raise

    @staticmethod
    async def clear_cookies(page: Any):
        """
        Clear all cookies

        Args:
            page: Page instance
        """
        try:
            page.driver.delete_all_cookies()
            ColorPrint.debug('All cookies cleared')
        except Exception as error:
            ColorPrint.red(f'Failed to clear cookies: {error}')
            raise


__all__ = ['PageWrapper', 'PageUtils']
