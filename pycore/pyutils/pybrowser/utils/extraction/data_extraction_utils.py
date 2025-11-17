#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Extraction Utilities

Helper functions for extracting data from pages
"""

from typing import List, Dict, Any
from pycore.pyfoundations.color_print import ColorPrint


class DataExtractionUtils:
    """Utilities for extracting structured data"""

    @staticmethod
    async def extract_table(page: Any, table_selector: str) -> List[List[str]]:
        """
        Extract table data

        Args:
            page: Page instance
            table_selector: Table selector

        Returns:
            List of rows (each row is list of cells)
        """
        script = f"""
        const table = document.querySelector('{table_selector}');
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row =>
            Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim())
        );
        """
        return await page.evaluate(script)

    @staticmethod
    async def extract_list(page: Any, list_selector: str) -> List[str]:
        """
        Extract list items

        Args:
            page: Page instance
            list_selector: List selector

        Returns:
            List of item texts
        """
        script = f"""
        const list = document.querySelector('{list_selector}');
        const items = Array.from(list.querySelectorAll('li'));
        return items.map(item => item.textContent.trim());
        """
        return await page.evaluate(script)
