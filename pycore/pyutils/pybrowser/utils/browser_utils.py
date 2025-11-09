#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Browser Utilities

Helper functions for browser operations
"""

from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint


class BrowserUtils:
    """Utility functions for browser operations"""

    @staticmethod
    async def set_viewport(page: Any, width: int, height: int):
        """
        Set browser viewport size

        Args:
            page: Page instance
            width: Viewport width
            height: Viewport height
        """
        try:
            page.driver.set_window_size(width, height)
            ColorPrint.debug(f"Viewport set to {width}x{height}")
        except Exception as error:
            ColorPrint.red(f'Failed to set viewport: {error}')
            raise

    @staticmethod
    async def set_user_agent(page: Any, user_agent: str):
        """
        Set user agent

        Args:
            page: Page instance
            user_agent: User agent string
        """
        try:
            page.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                'userAgent': user_agent
            })
            ColorPrint.debug(f"User agent set: {user_agent[:50]}...")
        except Exception as error:
            ColorPrint.debug(f'CDP not supported, user agent not set: {error}')

    @staticmethod
    async def get_browser_info(browser: Any) -> Dict[str, Any]:
        """
        Get browser information

        Args:
            browser: Browser instance

        Returns:
            Browser info dictionary
        """
        try:
            return {
                'type': browser.browser_type,
                'version': browser.version,
                'is_launched': browser.is_launched
            }
        except Exception as error:
            ColorPrint.red(f'Failed to get browser info: {error}')
            return {}
