#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BrowserFetcher

Browser-based fetcher using PyBrowser for JS-rendered HTML retrieval
"""

from typing import Dict, Any
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.fetchers.base_fetcher import BaseFetcher, FetchResult


class BrowserFetcher(BaseFetcher):
    """
    Browser fetcher for JS-rendered HTML retrieval

    Uses PyBrowser (Selenium-based) for full browser automation
    Best for: JavaScript-heavy sites, AJAX content, dynamic pages
    """

    def __init__(self):
        super().__init__()
        self.fetcher_name = "BrowserFetcher"
        self.engine = None
        self.session = None
        self.current_page = None

    def initialize(self, options: Dict[str, Any] = None) -> bool:
        """
        Initialize browser fetcher

        Args:
            options: Browser type, headless, viewport, etc.

        Returns:
            True if successful
        """
        options = options or {}

        from pycore.pyutils.pybrowser.core.spider_engine import SpiderEngine

        # Create engine
        self.engine = SpiderEngine()
        self.engine.initialize()

        # Create session
        session_config = {
            'browser': options.get('browser', 'edge'),
            'browser_options': {
                'headless': options.get('headless', False),
                'viewport': options.get('viewport', {'width': 1920, 'height': 1080})
            }
        }

        self.session = self.engine.create_session(session_config)

        self.is_initialized = True
        ColorPrint.green(f'[BrowserFetcher] Initialized successfully')
        return True

    def fetch(self, url: str, options: Dict[str, Any] = None) -> FetchResult:
        """
        Fetch content from URL via browser

        Args:
            url: URL to fetch
            options: Fetch options (waitUntil, timeout)

        Returns:
            FetchResult object
        """
        result = FetchResult()
        options = options or {}

        if not self.is_initialized:
            result.error = 'BrowserFetcher not initialized. Call initialize() first.'
            ColorPrint.red(f'[BrowserFetcher] {result.error}')
            return result

        # Create page if needed
        if not self.current_page:
            self.current_page = self.session.new_page()

        wait_until = options.get('waitUntil', 'networkidle2')
        timeout = options.get('timeout', 30000)

        ColorPrint.green(f'[BrowserFetcher] Fetching URL: {url}')

        # Navigate to URL
        self.current_page.goto(url, {
            'waitUntil': wait_until,
            'timeout': timeout
        })

        # Get page content
        content = self.current_page.get_content()
        if not content:
            result.error = 'Failed to get page content'
            ColorPrint.red(f'[BrowserFetcher] {result.error}')
            return result

        # Get final URL (after redirects)
        final_url = self.current_page.get_url()

        # Success
        result.success = True
        result.url = final_url
        result.content = content
        result.content_type = 'text/html'
        result.status = 200
        result.metadata = {
            'waitUntil': wait_until,
            'renderedByBrowser': True
        }

        ColorPrint.green(f'[BrowserFetcher] Successfully fetched {len(result.content)} bytes from {final_url}')
        return result

    def cleanup(self) -> bool:
        """
        Cleanup browser fetcher

        Returns:
            True if successful
        """
        if self.current_page:
            self.current_page.close()
            self.current_page = None

        if self.session:
            self.session.close()
            self.session = None

        if self.engine:
            self.engine = None

        self.is_initialized = False
        ColorPrint.green('[BrowserFetcher] Cleanup completed')
        return True

    def get_page(self):
        """Get current page instance for advanced operations"""
        return self.current_page

    def get_session(self):
        """Get session instance"""
        return self.session

    def get_info(self) -> Dict[str, Any]:
        """Get fetcher information"""
        return {
            **super().get_info(),
            'hasEngine': self.engine is not None,
            'hasSession': self.session is not None,
            'hasPage': self.current_page is not None
        }
