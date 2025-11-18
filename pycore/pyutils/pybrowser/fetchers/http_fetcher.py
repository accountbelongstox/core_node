#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTPFetcher

Synchronous HTTP fetcher using requests library for fast source HTML retrieval
"""

from typing import Dict, Any
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.pybrowser.fetchers.base_fetcher import BaseFetcher, FetchResult


class HTTPFetcher(BaseFetcher):
    """
    HTTP fetcher for fast source HTML retrieval

    Uses requests library for synchronous HTTP requests
    Best for: Quick crawling, source HTML without JS execution
    """

    def __init__(self):
        super().__init__()
        self.fetcher_name = "HTTPFetcher"
        self.session = None
        self.default_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

    def initialize(self, options: Dict[str, Any] = None) -> bool:
        """
        Initialize HTTP fetcher

        Args:
            options: Optional headers, timeout, etc.

        Returns:
            True if successful
        """
        options = options or {}

        requests = get_third_package_requests()
        if not requests:
            ColorPrint.red('[HTTPFetcher] Failed to load requests package')
            return False

        self.session = requests.Session()

        # Set custom headers if provided
        custom_headers = options.get('headers', {})
        self.session.headers.update({**self.default_headers, **custom_headers})

        self.is_initialized = True
        ColorPrint.green(f'[HTTPFetcher] Initialized successfully')
        return True

    def fetch(self, url: str, options: Dict[str, Any] = None) -> FetchResult:
        """
        Fetch content from URL via HTTP

        Args:
            url: URL to fetch
            options: Fetch options (timeout, headers, method)

        Returns:
            FetchResult object
        """
        result = FetchResult()
        options = options or {}

        if not self.is_initialized:
            result.error = 'HTTPFetcher not initialized. Call initialize() first.'
            ColorPrint.red(f'[HTTPFetcher] {result.error}')
            return result

        timeout = options.get('timeout', 30000) / 1000  # Convert ms to seconds
        method = options.get('method', 'GET').upper()
        custom_headers = options.get('headers', {})

        ColorPrint.green(f'[HTTPFetcher] Fetching URL: {url}')

        # Make HTTP request without try-except (let errors propagate)
        if method == 'GET':
            response = self.session.get(url, timeout=timeout, headers=custom_headers)
        elif method == 'POST':
            post_data = options.get('data', {})
            response = self.session.post(url, data=post_data, timeout=timeout, headers=custom_headers)
        else:
            result.error = f'Unsupported HTTP method: {method}'
            ColorPrint.red(f'[HTTPFetcher] {result.error}')
            return result

        # Check response status
        if response.status_code < 200 or response.status_code >= 400:
            result.success = False
            result.status = response.status_code
            result.error = f'HTTP error: {response.status_code}'
            ColorPrint.yellow(f'[HTTPFetcher] {result.error} for URL: {url}')
            return result

        # Success
        result.success = True
        result.url = response.url
        result.content = response.text
        result.content_type = response.headers.get('Content-Type', 'text/html')
        result.status = response.status_code
        result.metadata = {
            'encoding': response.encoding,
            'headers': dict(response.headers),
            'cookies': dict(response.cookies)
        }

        ColorPrint.green(f'[HTTPFetcher] Successfully fetched {len(result.content)} bytes from {url}')
        return result

    def cleanup(self) -> bool:
        """
        Cleanup HTTP fetcher

        Returns:
            True if successful
        """
        if self.session:
            self.session.close()
            self.session = None

        self.is_initialized = False
        ColorPrint.green('[HTTPFetcher] Cleanup completed')
        return True

    def get_info(self) -> Dict[str, Any]:
        """Get fetcher information"""
        return {
            **super().get_info(),
            'hasSession': self.session is not None
        }
