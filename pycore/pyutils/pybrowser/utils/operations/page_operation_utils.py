#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PageOperationUtils

Safe page operation utilities
"""

import time
from typing import Dict, Any, List

from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.utils.base import BaseUtils


class PageOperationUtils(BaseUtils):
    def __init__(self):
        super().__init__()

    async def safe_click(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _click():
            return await self._do_safe_click(page, selector, options)
        return await self.safe_execute(page, _click, options)

    async def _do_safe_click(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})
        await page.click(selector)
        ColorPrint.debug(f'Successfully clicked element: {selector}')
        return True

    async def safe_double_click(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _double_click():
            return await self._do_safe_double_click(page, selector, options)
        return await self.safe_execute(page, _double_click, options)

    async def _do_safe_double_click(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})
        await page.double_click(selector)
        ColorPrint.debug(f'Successfully double-clicked element: {selector}')
        return True

    async def safe_type(self, page: Any, selector: str, text: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _type():
            return await self._do_safe_type(page, selector, text, options)
        return await self.safe_execute(page, _type, options)

    async def _do_safe_type(self, page: Any, selector: str, text: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        if options.get('clearFirst', True):
            await page.click(selector, {'clickCount': 3})

        await page.type(selector, text, {'delay': options.get('typeDelay', 50)})
        ColorPrint.debug(f'Successfully typed text into element: {selector}')
        return True

    async def safe_clear(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _clear():
            return await self._do_safe_clear(page, selector, options)
        return await self.safe_execute(page, _clear, options)

    async def _do_safe_clear(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})
        await page.click(selector, {'clickCount': 3})

        script = f"document.querySelector('{selector}').value = '';"
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully cleared element: {selector}')
        return True

    async def safe_select(self, page: Any, selector: str, value: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _select():
            return await self._do_safe_select(page, selector, value, options)
        return await self.safe_execute(page, _select, options)

    async def _do_safe_select(self, page: Any, selector: str, value: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"""
        const select = document.querySelector('{selector}');
        select.value = '{value}';
        select.dispatchEvent(new Event('change', {{ bubbles: true }}));
        """
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully selected value {value} in element: {selector}')
        return True

    async def safe_select_by_text(self, page: Any, selector: str, text: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _select_by_text():
            return await self._do_safe_select_by_text(page, selector, text, options)
        return await self.safe_execute(page, _select_by_text, options)

    async def _do_safe_select_by_text(self, page: Any, selector: str, text: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"""
        const select = document.querySelector('{selector}');
        if (!select) throw new Error('Select not found');

        const options = Array.from(select.options);
        const option = options.find(opt => opt.textContent.includes('{text}'));
        if (option) {{
            select.value = option.value;
            select.dispatchEvent(new Event('change', {{ bubbles: true }}));
            return option.value;
        }}
        throw new Error('Option with text "{text}" not found');
        """

        option_value = await page.evaluate(script)

        if option_value:
            ColorPrint.debug(f'Successfully selected text "{text}" in element: {selector}')
        return True

    async def safe_hover(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _hover():
            return await self._do_safe_hover(page, selector, options)
        return await self.safe_execute(page, _hover, options)

    async def _do_safe_hover(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})
        await page.hover(selector)
        ColorPrint.debug(f'Successfully hovered over element: {selector}')
        return True

    async def safe_focus(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _focus():
            return await self._do_safe_focus(page, selector, options)
        return await self.safe_execute(page, _focus, options)

    async def _do_safe_focus(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"document.querySelector('{selector}').focus();"
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully focused element: {selector}')
        return True

    async def safe_blur(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _blur():
            return await self._do_safe_blur(page, selector, options)
        return await self.safe_execute(page, _blur, options)

    async def _do_safe_blur(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"document.querySelector('{selector}').blur();"
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully blurred element: {selector}')
        return True

    async def safe_check(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _check():
            return await self._do_safe_check(page, selector, options)
        return await self.safe_execute(page, _check, options)

    async def _do_safe_check(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"""
        const el = document.querySelector('{selector}');
        if (!el.checked) {{
            el.checked = true;
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}
        """
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully checked element: {selector}')
        return True

    async def safe_uncheck(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _uncheck():
            return await self._do_safe_uncheck(page, selector, options)
        return await self.safe_execute(page, _uncheck, options)

    async def _do_safe_uncheck(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.wait_for_selector(selector, {'timeout': options.get('timeout', self.default_timeout)})

        script = f"""
        const el = document.querySelector('{selector}');
        if (el.checked) {{
            el.checked = false;
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}
        """
        await page.evaluate(script)
        ColorPrint.debug(f'Successfully unchecked element: {selector}')
        return True

    async def safe_press_key(self, page: Any, key: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _press_key():
            return await self._do_safe_press_key(page, key, options)
        return await self.safe_execute(page, _press_key, options)

    async def _do_safe_press_key(self, page: Any, key: str, options: Dict[str, Any]):
        await page.press_key(key)
        ColorPrint.debug(f'Successfully pressed key: {key}')
        return True

    async def safe_press_keys(self, page: Any, keys: List[str], options: Dict[str, Any] = None):
        options = options or {}
        async def _press_keys():
            return await self._do_safe_press_keys(page, keys, options)
        return await self.safe_execute(page, _press_keys, options)

    async def _do_safe_press_keys(self, page: Any, keys: List[str], options: Dict[str, Any]):
        for key in keys:
            await page.press_key(key)
            await self.wait(options.get('keyDelay', 100))
        ColorPrint.debug(f'Successfully pressed keys: {", ".join(keys)}')
        return True

    async def safe_type_text(self, page: Any, text: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _type_text():
            return await self._do_safe_type_text(page, text, options)
        return await self.safe_execute(page, _type_text, options)

    async def _do_safe_type_text(self, page: Any, text: str, options: Dict[str, Any]):
        for char in text:
            await page.press_key(char)
            await self.wait(options.get('typeDelay', 50))
        ColorPrint.debug(f'Successfully typed text: {text}')
        return True

    async def safe_click_and_wait_for_navigation(self, page: Any, selector: str, options: Dict[str, Any] = None):
        options = options or {}
        async def _click_and_wait():
            return await self._do_safe_click_and_wait_for_navigation(page, selector, options)
        return await self.safe_execute(page, _click_and_wait, options)

    async def _do_safe_click_and_wait_for_navigation(self, page: Any, selector: str, options: Dict[str, Any]):
        await page.click(selector)
        time.sleep(2)
        ColorPrint.debug(f'Successfully clicked and navigated: {selector}')
        return True
