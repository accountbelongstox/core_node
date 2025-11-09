#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Pool

Manages browser and page resources for efficient reuse
"""

import asyncio
from typing import Dict, List, Any
from pycore.pyfoundations.color_print import ColorPrint


class ResourcePool:
    """Resource pool for browser and page reuse"""

    def __init__(self):
        self.browser_pool: Dict[str, List[Any]] = {}
        self.page_pool: Dict[str, List[Any]] = {}
        self.max_browsers = 5
        self.max_pages_per_browser = 10
        self.is_initialized = False
        self.metrics = {
            'browsers_created': 0,
            'browsers_released': 0,
            'pages_created': 0,
            'pages_released': 0,
            'pool_hits': 0,
            'pool_misses': 0
        }

    async def initialize(self):
        """Initialize resource pool"""
        try:
            ColorPrint.info('Initializing ResourcePool...')
            self.is_initialized = True
            ColorPrint.info('ResourcePool initialized')
        except Exception as error:
            ColorPrint.red(f'Failed to initialize ResourcePool: {error}')
            raise

    async def get_browser(self, browser_type: str = 'edge') -> Any:
        """
        Get or create browser from pool

        Args:
            browser_type: Browser type ('chrome', 'edge', 'firefox')

        Returns:
            Browser instance
        """
        pool = self.browser_pool.get(browser_type, [])

        browser = next((b for b in pool if hasattr(b, 'is_idle') and b.is_idle()), None)

        if browser:
            browser.mark_busy()
            self.metrics['pool_hits'] += 1
            ColorPrint.debug(f"Browser reused from pool: {browser_type}")
        else:
            browser = await self.create_browser(browser_type)
            pool.append(browser)
            self.browser_pool[browser_type] = pool
            self.metrics['pool_misses'] += 1
            ColorPrint.debug(f"New browser created: {browser_type}")

        self.metrics['browsers_created'] += 1
        return browser

    async def release_browser(self, browser: Any):
        """
        Release browser back to pool

        Args:
            browser: Browser instance
        """
        try:
            if hasattr(browser, 'mark_idle'):
                browser.mark_idle()
            self.metrics['browsers_released'] += 1
            ColorPrint.debug(f"Browser released to pool: {browser.browser_type}")
        except Exception as error:
            ColorPrint.red(f'Failed to release browser: {error}')

    async def create_browser(self, browser_type: str) -> Any:
        """
        Create new browser instance

        Args:
            browser_type: Browser type

        Returns:
            Browser instance
        """
        from pycore.pyutils.pybrowser.factories.browser_factory import BrowserFactory
        browser = await BrowserFactory.create(browser_type)

        browser._is_idle = True
        browser.is_idle = lambda: browser._is_idle
        browser.mark_busy = lambda: setattr(browser, '_is_idle', False)
        browser.mark_idle = lambda: setattr(browser, '_is_idle', True)
        browser.browser_type = browser_type

        return browser

    async def get_page(self, browser_type: str = 'edge') -> Any:
        """
        Get or create page from pool

        Args:
            browser_type: Browser type

        Returns:
            Page instance
        """
        pool = self.page_pool.get(browser_type, [])

        page = next((p for p in pool if hasattr(p, 'is_idle') and p.is_idle()), None)

        if page:
            page.mark_busy()
            self.metrics['pool_hits'] += 1
            ColorPrint.debug(f"Page reused from pool: {browser_type}")
        else:
            browser = await self.get_browser(browser_type)
            page = await browser.new_page()

            page._is_idle = True
            page.is_idle = lambda: page._is_idle
            page.mark_busy = lambda: setattr(page, '_is_idle', False)
            page.mark_idle = lambda: setattr(page, '_is_idle', True)
            page.browser_type = browser_type

            pool.append(page)
            self.page_pool[browser_type] = pool
            self.metrics['pool_misses'] += 1
            ColorPrint.debug(f"New page created: {browser_type}")

        self.metrics['pages_created'] += 1
        return page

    async def release_page(self, page: Any):
        """
        Release page back to pool

        Args:
            page: Page instance
        """
        try:
            if hasattr(page, 'mark_idle'):
                page.mark_idle()
            self.metrics['pages_released'] += 1
            ColorPrint.debug(f"Page released to pool: {page.browser_type}")
        except Exception as error:
            ColorPrint.red(f'Failed to release page: {error}')

    async def cleanup(self):
        """Cleanup all resources"""
        try:
            ColorPrint.info('Cleaning up ResourcePool...')

            for browser_type, browsers in self.browser_pool.items():
                for browser in browsers:
                    try:
                        await browser.close()
                    except Exception as error:
                        ColorPrint.warn(f"Failed to close browser {browser_type}: {error}")

            for page_type, pages in self.page_pool.items():
                for page in pages:
                    try:
                        await page.close()
                    except Exception as error:
                        ColorPrint.warn(f"Failed to close page {page_type}: {error}")

            self.browser_pool.clear()
            self.page_pool.clear()
            self.is_initialized = False

            ColorPrint.info('ResourcePool cleanup completed')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup ResourcePool: {error}')
            raise

    def get_info(self) -> Dict[str, Any]:
        """
        Get resource pool information

        Returns:
            Dictionary with pool info
        """
        browser_pools = [
            {'type': browser_type, 'count': len(browsers)}
            for browser_type, browsers in self.browser_pool.items()
        ]

        page_pools = [
            {'type': page_type, 'count': len(pages)}
            for page_type, pages in self.page_pool.items()
        ]

        return {
            'is_initialized': self.is_initialized,
            'max_browsers': self.max_browsers,
            'max_pages_per_browser': self.max_pages_per_browser,
            'browser_pools': browser_pools,
            'page_pools': page_pools,
            'metrics': self.metrics
        }
