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
        page.driver.back()
        await asyncio.sleep(0.5)
        ColorPrint.debug('Navigated back')

    @staticmethod
    async def go_forward(page: Any):
        """
        Navigate forward

        Args:
            page: Page instance
        """
        page.driver.forward()
        await asyncio.sleep(0.5)
        ColorPrint.debug('Navigated forward')

    @staticmethod
    async def refresh(page: Any):
        """
        Refresh page

        Args:
            page: Page instance
        """
        page.driver.refresh()
        await asyncio.sleep(0.5)
        ColorPrint.debug('Page refreshed')
