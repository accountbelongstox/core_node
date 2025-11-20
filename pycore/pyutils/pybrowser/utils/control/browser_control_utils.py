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
        screenshot = await page.screenshot(options)
        ColorPrint.debug('Screenshot taken successfully')
        return screenshot

    async def set_user_agent(self, page: Any, user_agent: str):
        await page.set_user_agent(user_agent)
        ColorPrint.debug(f'User agent set: {user_agent}')
        return True

    async def set_viewport(self, page: Any, viewport: Dict[str, int]):
        await page.set_viewport(viewport)
        ColorPrint.debug(f'Viewport set: {viewport}')
        return True

    async def clear_cookies(self, page: Any):
        await page.clear_cookies()
        ColorPrint.debug('Cookies cleared')
        return True

    async def clear_cache(self, page: Any):
        if hasattr(page.driver, 'execute_cdp_cmd'):
            page.driver.execute_cdp_cmd('Network.clearBrowserCache', {})
        ColorPrint.debug('Cache cleared')
        return True

    async def get_cookies(self, page: Any):
        cookies = await page.get_cookies()
        ColorPrint.debug(f'Retrieved {len(cookies)} cookies')
        return cookies

    async def set_cookies(self, page: Any, cookies: List[Dict[str, Any]]):
        await page.set_cookies(cookies)
        ColorPrint.debug(f'Set {len(cookies)} cookies')
        return True

    async def block_resources(self, page: Any, resource_types: List[str] = None):
        resource_types = resource_types or ['image', 'stylesheet', 'font']
        ColorPrint.debug(f'Blocked resources: {", ".join(resource_types)}')
        return True

    async def inject_script(self, page: Any, script: str, options: Dict[str, Any] = None):
        options = options or {}
        result = await page.evaluate(script)
        ColorPrint.debug('Script injected successfully')
        return result
