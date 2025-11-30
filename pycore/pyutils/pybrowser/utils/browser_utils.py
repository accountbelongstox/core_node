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
        page.driver.set_window_size(width, height)
        ColorPrint.debug(f"Viewport set to {width}x{height}")

    @staticmethod
    async def set_user_agent(page: Any, user_agent: str):
        """
        Set user agent

        Args:
            page: Page instance
            user_agent: User agent string
        """
        page.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
            'userAgent': user_agent
        })
        ColorPrint.debug(f"User agent set: {user_agent[:50]}...")

    @staticmethod
    async def get_browser_info(browser: Any) -> Dict[str, Any]:
        """
        Get browser information

        Args:
            browser: Browser instance

        Returns:
            Browser info dictionary
        """
        return {
            'type': browser.browser_type,
            'version': browser.version,
            'is_launched': browser.is_launched
        }
