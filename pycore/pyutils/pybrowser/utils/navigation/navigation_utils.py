#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Navigation Utilities

Helper functions for page navigation
"""

import asyncio
from typing import Any
from pycore.pyfoundations.color_print import ColorPrint


class NavigationUtils:
    """Utilities for page navigation"""

    @staticmethod
    async def go_back(page: Any):
        """
        Navigate back

        Args:
            page: Page instance
        """
        try:
            page.driver.back()
            await asyncio.sleep(0.5)
            ColorPrint.debug('Navigated back')
        except Exception as error:
            ColorPrint.red(f'Failed to navigate back: {error}')
            raise

    @staticmethod
    async def go_forward(page: Any):
        """
        Navigate forward

        Args:
            page: Page instance
        """
        try:
            page.driver.forward()
            await asyncio.sleep(0.5)
            ColorPrint.debug('Navigated forward')
        except Exception as error:
            ColorPrint.red(f'Failed to navigate forward: {error}')
            raise

    @staticmethod
    async def refresh(page: Any):
        """
        Refresh page

        Args:
            page: Page instance
        """
        try:
            page.driver.refresh()
            await asyncio.sleep(0.5)
            ColorPrint.debug('Page refreshed')
        except Exception as error:
            ColorPrint.red(f'Failed to refresh page: {error}')
            raise
