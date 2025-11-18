#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetcher - High-level convenience wrapper for PyBrowser

Provides simplified API for common browser automation tasks
"""

from typing import Dict, Any, Optional
from pycore.pyutils.pybrowser.core import SpiderEngine
from pycore.pyutils.pybrowser.utils.iframe import IFrameUtils
from pycore.pyutils.pybrowser.utils.logger import Logger

logger = Logger({'prefix': 'Fetcher'})

_default_engine = None


class Fetcher:
    """
    High-level convenience wrapper for browser automation

    Simplifies common tasks like fetching pages, screenshots, iframe content
    """

    def __init__(self):
        self.engine = None
        self.session = None
        self.current_page = None
        self.is_initialized = False

    async def initialize(self, browser_type: str = 'chrome', options: Dict[str, Any] = None) -> 'Fetcher':
        """
        Initialize fetcher with browser

        Args:
            browser_type: Browser type ('chrome', 'edge', 'firefox')
            options: Browser options (headless, viewport, etc.)

        Returns:
            Self for chaining
        """
        global _default_engine
        options = options or {}

        logger.info(f'Initializing Fetcher with browser type: {browser_type}')

        if not _default_engine:
            _default_engine = SpiderEngine()
            await _default_engine.initialize()

        self.engine = _default_engine

        self.session = await self.engine.create_session({
            'preset': 'desktop',
            'browser': browser_type,
            'headless': options.get('headless', False),
            'viewport': options.get('viewport', {'width': 1920, 'height': 1080})
        })

        self.current_page = await self.session.new_page()
        self.is_initialized = True

        logger.info('Fetcher initialized successfully')
        return self

    async def fetch(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fetch page content from URL

        Args:
            url: URL to fetch
            options: Fetch options (waitUntil, timeout)

        Returns:
            Fetch result with content, url, status
        """
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')

        options = options or {}
        logger.info(f'Fetching URL: {url}')

        await self.current_page.goto(url, {
            'waitUntil': options.get('waitUntil', 'networkidle2'),
            'timeout': options.get('timeout', 30000)
        })

        content = await self.current_page.content()
        final_url = await self.current_page.evaluate('window.location.href')

        logger.info(f'Page fetched successfully: {final_url}')

        return {
            'content': content,
            'contentType': 'text/html',
            'isText': True,
            'isBinary': False,
            'url': final_url,
            'status': 200
        }

    async def take_screenshot(self, options: Dict[str, Any] = None) -> bytes:
        """
        Take screenshot of current page

        Args:
            options: Screenshot options (path, fullPage, type)

        Returns:
            Screenshot bytes
        """
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')

        options = options or {}
        logger.info('Taking screenshot')

        screenshot = await self.current_page.screenshot({
            'path': options.get('path'),
            'fullPage': options.get('fullPage', True),
            'type': options.get('type', 'png')
        })

        logger.info('Screenshot taken successfully')
        return screenshot

    async def get_page(self):
        """Get current page instance"""
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')
        return self.current_page

    async def get_browser(self):
        """Get browser instance"""
        if not self.session:
            raise RuntimeError('Session not initialized. Call initialize() first.')
        return self.session.get_browser()

    async def close(self):
        """Close fetcher and cleanup resources"""
        if self.current_page:
            await self.current_page.close()
            self.current_page = None

        if self.session:
            await self.session.close()
            self.session = None

        self.is_initialized = False
        logger.info('Fetcher closed successfully')

    async def fetch_iframe_content(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fetch content from all iframes on a page

        Args:
            url: URL to fetch
            options: Options (waitUntil, timeout, delay, maxLinksPerIframe, onPageCallback)

        Returns:
            Result with iframe data
        """
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')

        options = options or {}
        logger.info(f'Fetching iframe content from URL: {url}')

        await self.current_page.goto(url, {
            'waitUntil': options.get('waitUntil', 'networkidle2'),
            'timeout': options.get('timeout', 30000)
        })

        iframe_utils = IFrameUtils(self.current_page)
        results = await iframe_utils.get_all_iframes_with_content({
            'delay': options.get('delay', 1000),
            'maxLinksPerIframe': options.get('maxLinksPerIframe', float('inf')),
            'onPageCallback': options.get('onPageCallback')
        })

        logger.info(f"Fetched content from {len(results)} iframes")

        return {
            'url': url,
            'iframes': results,
            'totalIframes': len(results),
            'successfulIframes': sum(1 for r in results if r.get('success') is not False)
        }

    async def fetch_iframe_content_recursive(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Recursively fetch content from iframes and their links

        Args:
            url: URL to fetch
            options: Options (maxDepth, delay, maxLinksPerPage, sameOriginOnly, etc.)

        Returns:
            Result with recursively crawled iframe data
        """
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')

        options = options or {}
        logger.info(f'[RECURSIVE] Fetching iframe content from URL: {url}')

        await self.current_page.goto(url, {
            'waitUntil': options.get('waitUntil', 'networkidle2'),
            'timeout': options.get('timeout', 30000)
        })

        iframe_utils = IFrameUtils(self.current_page)
        results = await iframe_utils.recursive_crawl_all_iframes({
            'maxDepth': options.get('maxDepth', 10),
            'delay': options.get('delay', 1000),
            'maxLinksPerPage': options.get('maxLinksPerPage', float('inf')),
            'sameOriginOnly': options.get('sameOriginOnly', True),
            'skipHashLinks': options.get('skipHashLinks', True),
            'onPageCallback': options.get('onPageCallback'),
            'onFailedCallback': options.get('onFailedCallback')
        })

        logger.info(f'[RECURSIVE] Recursively crawled {len(results)} iframes')

        return {
            'url': url,
            'iframes': results,
            'totalIframes': len(results),
            'successfulIframes': sum(1 for r in results if r.get('success') is not False)
        }

    async def fetch_single_iframe_content(self, url: str, iframe_index: int = 0, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fetch content from a single iframe by index

        Args:
            url: URL to fetch
            iframe_index: Index of iframe to extract
            options: Options (delay, maxLinks)

        Returns:
            Result with iframe data
        """
        if not self.is_initialized:
            raise RuntimeError('Fetcher not initialized. Call initialize() first.')

        options = options or {}
        logger.info(f'Fetching iframe {iframe_index} content from URL: {url}')

        await self.current_page.goto(url, {
            'waitUntil': options.get('waitUntil', 'networkidle2'),
            'timeout': options.get('timeout', 30000)
        })

        iframe_utils = IFrameUtils(self.current_page)
        result = await iframe_utils.extract_iframe_content_by_index(iframe_index, {
            'delay': options.get('delay', 1000),
            'maxLinks': options.get('maxLinks', float('inf'))
        })

        logger.info(f'Fetched content from iframe {iframe_index}')

        return {
            'url': url,
            'iframeData': result
        }

    async def collect_resources(self, options: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """
        Collect resources from current page (requires EnhancedPage)

        Args:
            options: Collection options

        Returns:
            Resource collection result or None
        """
        if not self.is_initialized or not self.current_page:
            raise RuntimeError('Fetcher not initialized or no active page')

        if hasattr(self.current_page, 'collect_resources'):
            return await self.current_page.collect_resources(options or {})
        else:
            logger.warn('Current page does not support resource collection (EnhancedPage required)')
            return None

    def get_resource_collector(self):
        """Get resource collector from current page"""
        if not self.is_initialized or not self.current_page:
            return None

        if hasattr(self.current_page, 'get_resource_collector'):
            return self.current_page.get_resource_collector()
        else:
            return None

    def get_info(self) -> Dict[str, Any]:
        """Get fetcher information"""
        return {
            'isInitialized': self.is_initialized,
            'hasSession': self.session is not None,
            'hasPage': self.current_page is not None,
            'supportsResourceCollection': self.current_page and hasattr(self.current_page, 'collect_resources')
        }
