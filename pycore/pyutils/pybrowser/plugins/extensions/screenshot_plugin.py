#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Plugin

Screenshot functionality with advanced options
"""

from typing import Dict, Any
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin


class ScreenshotPlugin(IPlugin):
    """Plugin for screenshot functionality"""

    def __init__(self):
        super().__init__()
        self.name = 'screenshot'
        self.version = '1.0.0'

    async def initialize(self, session: Any):
        """Initialize plugin with session"""
        self.session = session
        self.is_initialized = True
        ColorPrint.info(f"ScreenshotPlugin initialized for session: {session.id}")

    async def cleanup(self):
        """Cleanup plugin resources"""
        self.is_initialized = False
        ColorPrint.info('ScreenshotPlugin cleaned up')

    async def take_screenshot(self, page: Any, options: Dict[str, Any] = None) -> bytes:
        """
        Take screenshot

        Args:
            page: Page instance
            options: Screenshot options

        Returns:
            Screenshot bytes
        """
        return await page.screenshot(options or {})

    async def take_fullpage_screenshot(self, page: Any, path: str = None) -> bytes:
        """
        Take full page screenshot

        Args:
            page: Page instance
            path: Save path

        Returns:
            Screenshot bytes
        """
        total_height = await page.evaluate('return document.body.scrollHeight')
        total_width = await page.evaluate('return document.body.scrollWidth')

        original_size = await page.driver.get_window_size()

        await page.driver.set_window_size(total_width, total_height)

        screenshot = await page.screenshot({'path': path} if path else {})

        await page.driver.set_window_size(original_size['width'], original_size['height'])

        return screenshot
