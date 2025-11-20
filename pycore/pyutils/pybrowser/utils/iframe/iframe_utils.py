#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IFrame Utilities

Helper functions for working with iframes
"""

from typing import List, Any
from pycore.pyfoundations.color_print import ColorPrint


class IFrameUtils:
    """Utilities for iframe operations"""

    @staticmethod
    async def get_iframes(page: Any) -> List:
        """
        Get all iframes in page

        Args:
            page: Page instance

        Returns:
            List of iframe elements
        """
        script = """
        return Array.from(document.querySelectorAll('iframe')).map((iframe, index) => ({
            index: index,
            src: iframe.src,
            name: iframe.name,
            id: iframe.id
        }));
        """
        return await page.evaluate(script)

    @staticmethod
    async def switch_to_iframe(page: Any, iframe_index: int):
        """
        Switch to iframe

        Args:
            page: Page instance
            iframe_index: IFrame index
        """
        iframes = page.driver.find_elements('tag name', 'iframe')
        if iframe_index < len(iframes):
            page.driver.switch_to.frame(iframes[iframe_index])
            ColorPrint.debug(f"Switched to iframe {iframe_index}")

    @staticmethod
    async def switch_to_default(page: Any):
        """
        Switch back to main content

        Args:
            page: Page instance
        """
        page.driver.switch_to.default_content()
        ColorPrint.debug('Switched to default content')
