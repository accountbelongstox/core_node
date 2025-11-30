#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Element Finder Utilities

Helper functions for finding elements
"""

from typing import List, Dict, Any
from pycore.pyfoundations.color_print import ColorPrint


class ElementFinderUtils:
    """Utilities for finding elements"""

    @staticmethod
    async def find_elements_by_text(page: Any, text: str) -> List[Dict[str, Any]]:
        """
        Find elements containing text

        Args:
            page: Page instance
            text: Text to search for

        Returns:
            List of element info dictionaries
        """
        try:
            script = f"""
            const xpath = '//*[contains(text(), "{text}")]';
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {{
                const el = result.snapshotItem(i);
                elements.push({{
                    tagName: el.tagName,
                    text: el.textContent.trim(),
                    id: el.id,
                    className: el.className
                }});
            }}
            return elements;
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to find elements by text: {error}')
            raise

    @staticmethod
    async def find_visible_elements(page: Any, selector: str) -> List[Dict[str, Any]]:
        """
        Find visible elements

        Args:
            page: Page instance
            selector: CSS selector

        Returns:
            List of visible element info
        """
        try:
            script = f"""
            const elements = Array.from(document.querySelectorAll('{selector}'));
            return elements
                .filter(el => el.offsetParent !== null)
                .map(el => ({{
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className
                }}));
            """
            return await page.evaluate(script)
        except Exception as error:
            ColorPrint.red(f'Failed to find visible elements: {error}')
            raise
