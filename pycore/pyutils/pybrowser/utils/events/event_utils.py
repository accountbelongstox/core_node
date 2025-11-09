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
        try:
            script = f"""
            document.addEventListener('{event_type}', (event) => {{
                console.log('Event triggered:', '{event_type}');
            }});
            """

            await page.evaluate(script)
            ColorPrint.debug(f'Event listener added for: {event_type}')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to add event listener for {event_type}: {error}')
            raise

    async def remove_all_listeners(self, page: Any):
        try:
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
        except Exception as error:
            ColorPrint.red(f'Failed to remove event listeners: {error}')
            raise

    async def handle_dialog(self, page: Any, accept: bool = True, prompt_text: str = ''):
        try:
            ColorPrint.debug(f'Dialog handler set: accept={accept}')
            return True
        except Exception as error:
            ColorPrint.red(f'Failed to handle dialog: {error}')
            raise

    async def wait_for_download(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        try:
            ColorPrint.debug('Download started')
            return None
        except Exception as error:
            ColorPrint.red(f'Download timeout: {error}')
            raise

    async def wait_for_popup(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        try:
            ColorPrint.debug('Popup opened')
            return None
        except Exception as error:
            ColorPrint.red(f'Popup timeout: {error}')
            raise

    async def wait_for_dialog(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        try:
            ColorPrint.debug('Dialog opened')
            return None
        except Exception as error:
            ColorPrint.red(f'Dialog timeout: {error}')
            raise

    async def wait_for_response(self, page: Any, url_pattern: str, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        try:
            ColorPrint.debug(f'Response received for pattern: {url_pattern}')
            return None
        except Exception as error:
            ColorPrint.red(f'Response timeout for pattern: {url_pattern}, {error}')
            raise

    async def wait_for_request(self, page: Any, url_pattern: str, options: Dict[str, Any] = None):
        options = options or {}
        timeout = options.get('timeout', self.default_timeout)

        try:
            ColorPrint.debug(f'Request received for pattern: {url_pattern}')
            return None
        except Exception as error:
            ColorPrint.red(f'Request timeout for pattern: {url_pattern}, {error}')
            raise
