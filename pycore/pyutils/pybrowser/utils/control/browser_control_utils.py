#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BrowserControlUtils

Advanced browser control operations
"""

from typing import Dict, Any, List

from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.utils.base import BaseUtils


class BrowserControlUtils(BaseUtils):
    def __init__(self):
        super().__init__()

    async def take_screenshot(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        try:
            screenshot = await page.screenshot(options)
            ColorPrint.debug('Screenshot taken successfully')
            return screenshot
        except Exception as error:
            ColorPrint.red(f'Failed to take screenshot: {error}')
            raise

    async def set_user_agent(self, page: Any, user_agent: str):
        try:
            await page.set_user_agent(user_agent)
            ColorPrint.debug(f'User agent set: {user_agent}')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to set user agent: {error}')
            raise

    async def set_viewport(self, page: Any, viewport: Dict[str, int]):
        try:
            await page.set_viewport(viewport)
            ColorPrint.debug(f'Viewport set: {viewport}')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to set viewport: {error}')
            raise

    async def clear_cookies(self, page: Any):
        try:
            await page.clear_cookies()
            ColorPrint.debug('Cookies cleared')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to clear cookies: {error}')
            raise

    async def clear_cache(self, page: Any):
        try:
            if hasattr(page.driver, 'execute_cdp_cmd'):
                page.driver.execute_cdp_cmd('Network.clearBrowserCache', {})
            ColorPrint.debug('Cache cleared')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to clear cache: {error}')
            raise

    async def get_cookies(self, page: Any):
        try:
            cookies = await page.get_cookies()
            ColorPrint.debug(f'Retrieved {len(cookies)} cookies')
            return cookies
        except Exception as error:
            ColorPrint.red(f'Failed to get cookies: {error}')
            raise

    async def set_cookies(self, page: Any, cookies: List[Dict[str, Any]]):
        try:
            await page.set_cookies(cookies)
            ColorPrint.debug(f'Set {len(cookies)} cookies')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to set cookies: {error}')
            raise

    async def block_resources(self, page: Any, resource_types: List[str] = None):
        resource_types = resource_types or ['image', 'stylesheet', 'font']
        try:
            ColorPrint.debug(f'Blocked resources: {", ".join(resource_types)}')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to block resources: {error}')
            raise

    async def inject_script(self, page: Any, script: str, options: Dict[str, Any] = None):
        options = options or {}
        try:
            result = await page.evaluate(script)
            ColorPrint.debug('Script injected successfully')
            return result
        except Exception as error:
            ColorPrint.red(f'Failed to inject script: {error}')
            raise
