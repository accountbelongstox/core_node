#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automation Plugin

Provides automation helpers for page interactions
"""

import time
from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin


class AutomationPlugin(IPlugin):
    """Plugin for page automation helpers"""

    def __init__(self):
        super().__init__()
        self.name = 'automation'
        self.version = '1.0.0'

    def initialize(self, session: Any):
        """
        Initialize plugin with session

        Args:
            session: Session instance
        """
        try:
            self.session = session
            self.is_initialized = True
            ColorPrint.info(f"AutomationPlugin initialized for session: {session.id}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize AutomationPlugin: {error}')
            raise

    def cleanup(self):
        """Cleanup plugin resources"""
        try:
            self.is_initialized = False
            ColorPrint.info('AutomationPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup AutomationPlugin: {error}')

    def fill_form(self, page: Any, form_data: Dict[str, str]):
        """
        Fill form fields

        Args:
            page: Page instance
            form_data: Dictionary of field name/value pairs
        """
        try:
            for selector, value in form_data.items():
                page.type(selector, value)

            ColorPrint.debug(f"Filled {len(form_data)} form fields")
        except Exception as error:
            ColorPrint.red(f'Failed to fill form: {error}')
            raise

    def select_dropdown(self, page: Any, selector: str, value: str):
        """
        Select dropdown option

        Args:
            page: Page instance
            selector: Dropdown selector
            value: Option value
        """
        try:
            script = f"""
            const select = document.querySelector('{selector}');
            select.value = '{value}';
            select.dispatchEvent(new Event('change', {{ bubbles: true }}));
            """
            page.evaluate(script)

            ColorPrint.debug(f"Selected dropdown option: {value}")
        except Exception as error:
            ColorPrint.red(f'Failed to select dropdown: {error}')
            raise

    def check_checkbox(self, page: Any, selector: str, checked: bool = True):
        """
        Check/uncheck checkbox

        Args:
            page: Page instance
            selector: Checkbox selector
            checked: True to check, False to uncheck
        """
        try:
            script = f"""
            const checkbox = document.querySelector('{selector}');
            checkbox.checked = {str(checked).lower()};
            checkbox.dispatchEvent(new Event('change', {{ bubbles: true }}));
            """
            page.evaluate(script)

            ColorPrint.debug(f"Checkbox {'checked' if checked else 'unchecked'}: {selector}")
        except Exception as error:
            ColorPrint.red(f'Failed to check checkbox: {error}')
            raise

    def hover(self, page: Any, selector: str):
        """
        Hover over element

        Args:
            page: Page instance
            selector: Element selector
        """
        try:
            script = f"""
            const element = document.querySelector('{selector}');
            const event = new MouseEvent('mouseover', {{
                view: window,
                bubbles: true,
                cancelable: true
            }});
            element.dispatchEvent(event);
            """
            page.evaluate(script)

            ColorPrint.debug(f"Hovered over element: {selector}")
        except Exception as error:
            ColorPrint.red(f'Failed to hover: {error}')
            raise

    def scroll_to(self, page: Any, selector: str = None, x: int = None, y: int = None):
        """
        Scroll to element or position

        Args:
            page: Page instance
            selector: Element selector (optional)
            x: X coordinate (optional)
            y: Y coordinate (optional)
        """
        try:
            if selector:
                script = f"""
                const element = document.querySelector('{selector}');
                element.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                """
            elif x is not None and y is not None:
                script = f"window.scrollTo({{ top: {y}, left: {x}, behavior: 'smooth' }});"
            else:
                raise ValueError("Either selector or x/y coordinates must be provided")

            page.evaluate(script)

            ColorPrint.debug("Scrolled to target")
        except Exception as error:
            ColorPrint.red(f'Failed to scroll: {error}')
            raise

    def wait_for_navigation(self, page: Any, timeout: int = 30):
        """
        Wait for page navigation (synchronous)

        Args:
            page: Page instance
            timeout: Timeout in seconds
        """
        try:
            # Simple wait - could be enhanced with actual navigation detection
            time.sleep(1)

            ColorPrint.debug("Navigation wait completed")
        except Exception as error:
            ColorPrint.red(f'Failed to wait for navigation: {error}')
            raise

    def get_element_text(self, page: Any, selector: str) -> str:
        """
        Get element text content

        Args:
            page: Page instance
            selector: Element selector

        Returns:
            Text content
        """
        try:
            script = f"return document.querySelector('{selector}').textContent.trim();"
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to get element text: {error}')
            raise

    def get_element_attribute(self, page: Any, selector: str, attribute: str) -> str:
        """
        Get element attribute value

        Args:
            page: Page instance
            selector: Element selector
            attribute: Attribute name

        Returns:
            Attribute value
        """
        try:
            script = f"return document.querySelector('{selector}').getAttribute('{attribute}');"
            return page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to get element attribute: {error}')
            raise
