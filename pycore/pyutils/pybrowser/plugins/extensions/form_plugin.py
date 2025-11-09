#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Form Plugin

Advanced form handling functionality
"""

from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin


class FormPlugin(IPlugin):
    """Plugin for advanced form handling"""

    def __init__(self):
        super().__init__()
        self.name = 'form'
        self.version = '1.0.0'

    async def initialize(self, session: Any):
        """Initialize plugin with session"""
        try:
            self.session = session
            self.is_initialized = True
            ColorPrint.info(f"FormPlugin initialized for session: {session.id}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize FormPlugin: {error}')
            raise

    async def cleanup(self):
        """Cleanup plugin resources"""
        try:
            self.is_initialized = False
            ColorPrint.info('FormPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup FormPlugin: {error}')

    async def submit_form(self, page: Any, form_selector: str, data: Dict[str, str], submit_selector: str = None):
        """
        Fill and submit form

        Args:
            page: Page instance
            form_selector: Form selector
            data: Form field data
            submit_selector: Submit button selector
        """
        try:
            for field_selector, value in data.items():
                await page.type(field_selector, value, {'clear': True})

            if submit_selector:
                await page.click(submit_selector)
            else:
                script = f"document.querySelector('{form_selector}').submit();"
                await page.evaluate(script)

            ColorPrint.debug(f"Form submitted: {form_selector}")
        except Exception as error:
            ColorPrint.red(f'Failed to submit form: {error}')
            raise

    async def get_form_data(self, page: Any, form_selector: str) -> Dict[str, str]:
        """
        Get form field values

        Args:
            page: Page instance
            form_selector: Form selector

        Returns:
            Dictionary of field values
        """
        try:
            script = f"""
            const form = document.querySelector('{form_selector}');
            const formData = new FormData(form);
            const result = {{}};
            for (let [key, value] of formData.entries()) {{
                result[key] = value;
            }}
            return result;
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to get form data: {error}')
            raise
