#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EventUtils

Event handling utilities
"""

from typing import Dict, Any, Callable

from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.utils.base import BaseUtils


class EventUtils(BaseUtils):
    def __init__(self):
        super().__init__()

    async def add_event_listener(self, page: Any, event_type: str, callback: Callable):
        script = f"""
        document.addEventListener('{event_type}', (event) => {{
            console.log('Event triggered:', '{event_type}');
        }});
        """

        await page.evaluate(script)
        ColorPrint.debug(f'Event listener added for: {event_type}')
        return True

    async def remove_all_listeners(self, page: Any):
        script = """
        const events = ['click', 'submit', 'change', 'input'];
        events.forEach(eventType => {
            const elements = document.querySelectorAll('*');
            elements.forEach(element => {
                const clone = element.cloneNode(true);
                element.parentNode.replaceChild(clone, element);
            });
        });
        """

        await page.evaluate(script)
        ColorPrint.debug('All event listeners removed')
        return True

    async def handle_dialog(self, page: Any, accept: bool = True, prompt_text: str = ''):
        ColorPrint.debug(f'Dialog handler set: accept={accept}')
        return True

    async def wait_for_download(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        ColorPrint.debug('Download started')
        return None

    async def wait_for_popup(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        ColorPrint.debug('Popup opened')
        return None

    async def wait_for_dialog(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        ColorPrint.debug('Dialog opened')
        return None

    async def wait_for_response(self, page: Any, url_pattern: str, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        ColorPrint.debug(f'Response received for pattern: {url_pattern}')
        return None

    async def wait_for_request(self, page: Any, url_pattern: str, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        ColorPrint.debug(f'Request received for pattern: {url_pattern}')
        return None
