#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TampermonkeyFetcher

WebSocket-based fetcher for Tampermonkey userscript integration
"""

import time
import threading
from typing import Dict, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.fetchers.base_fetcher import BaseFetcher
from pycore.pyutils.pybrowser.utils.tampermonkey.tampermonkey_server import TampermonkeyServer


class TampermonkeyFetchResult:
    """Extended fetch result for Tampermonkey crawling"""

    def __init__(self):
        self.success = False
        self.pages = []
        self.total_pages = 0
        self.total_bytes = 0
        self.error = None
        self.completion_data = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'pages': self.pages,
            'totalPages': self.total_pages,
            'totalBytes': self.total_bytes,
            'error': self.error,
            'completionData': self.completion_data
        }


class TampermonkeyFetcher(BaseFetcher):
    """
    Tampermonkey fetcher for WebSocket-based crawling

    Uses WebSocket server to receive page data from Tampermonkey userscripts
    Best for: Browser extension-based crawling, authenticated sessions
    """

    def __init__(self):
        super().__init__()
        self.fetcher_name = "TampermonkeyFetcher"
        self.server = None
        self.received_pages = []
        self.completion_event = None
        self.is_completed = False

    def initialize(self, options: Dict[str, Any] = None) -> bool:
        """
        Initialize Tampermonkey fetcher

        Args:
            options: Server port, host, etc.

        Returns:
            True if successful
        """
        options = options or {}

        # Create server instance
        server_options = {
            'port': options.get('port', 8765),
            'host': options.get('host', '127.0.0.1'),
            'autoStart': False  # We'll start it manually
        }

        self.server = TampermonkeyServer(server_options)

        # Register callbacks
        self.server.on('page', self._on_page_received)
        self.server.on('complete', self._on_complete)
        self.server.on('error', self._on_error)

        # Start server
        server_info = self.server.start()
        if not server_info:
            ColorPrint.red('[TampermonkeyFetcher] Failed to start server')
            return False

        self.is_initialized = True
        ColorPrint.green(f'[TampermonkeyFetcher] Initialized successfully on {server_info["url"]}')
        return True

    def fetch(self, url: str, options: Dict[str, Any] = None) -> TampermonkeyFetchResult:
        """
        Start Tampermonkey crawl and wait for completion

        Args:
            url: Start URL (userscript must handle navigation)
            options: Fetch options (maxDepth, timeout)

        Returns:
            TampermonkeyFetchResult with all received pages
        """
        result = TampermonkeyFetchResult()
        options = options or {}

        if not self.is_initialized:
            result.error = 'TampermonkeyFetcher not initialized. Call initialize() first.'
            ColorPrint.red(f'[TampermonkeyFetcher] {result.error}')
            return result

        # Reset state
        self.received_pages = []
        self.is_completed = False
        self.completion_event = threading.Event()

        timeout = options.get('timeout', 300000) / 1000  # Convert to seconds
        max_depth = options.get('maxDepth', 10)

        ColorPrint.green(f'[TampermonkeyFetcher] Waiting for userscript to send page data...')
        ColorPrint.green(f'[TampermonkeyFetcher] Server URL: http://{self.server.host}:{self.server.port}')
        ColorPrint.green(f'[TampermonkeyFetcher] Start URL: {url}')
        ColorPrint.green(f'[TampermonkeyFetcher] Max depth: {max_depth}')

        # Wait for completion or timeout
        completed = self.completion_event.wait(timeout)

        if not completed:
            result.success = False
            result.error = f'Timeout after {timeout}s waiting for userscript completion'
            ColorPrint.yellow(f'[TampermonkeyFetcher] {result.error}')
            # Still return collected pages
            result.pages = self.received_pages
            result.total_pages = len(self.received_pages)
            return result

        # Success
        result.success = True
        result.pages = self.received_pages
        result.total_pages = len(self.received_pages)
        result.total_bytes = sum(page.get('contentLength', 0) for page in self.received_pages)

        ColorPrint.green(f'[TampermonkeyFetcher] Crawl completed: {result.total_pages} pages received')
        return result

    def _on_page_received(self, page_data: Dict[str, Any]):
        """Callback when page data is received"""
        self.received_pages.append(page_data)
        ColorPrint.green(f'[TampermonkeyFetcher] Received page {len(self.received_pages)}: {page_data.get("url")}')

    def _on_complete(self, completion_data: Dict[str, Any]):
        """Callback when crawl is completed"""
        self.is_completed = True
        ColorPrint.green(f'[TampermonkeyFetcher] Crawl completion signal received')

        if self.completion_event:
            self.completion_event.set()

    def _on_error(self, error: Any):
        """Callback when error occurs"""
        ColorPrint.red(f'[TampermonkeyFetcher] Error: {error}')

    def cleanup(self) -> bool:
        """
        Cleanup Tampermonkey fetcher

        Returns:
            True if successful
        """
        if self.server:
            self.server.stop()
            self.server = None

        self.received_pages = []
        self.completion_event = None
        self.is_initialized = False

        ColorPrint.green('[TampermonkeyFetcher] Cleanup completed')
        return True

    def get_server_url(self) -> str:
        """Get server URL for userscript configuration"""
        if not self.server:
            return None
        return f'http://{self.server.host}:{self.server.port}'

    def get_statistics(self) -> Dict[str, Any]:
        """Get server statistics"""
        if not self.server:
            return {}
        return self.server.get_statistics()

    def get_info(self) -> Dict[str, Any]:
        """Get fetcher information"""
        return {
            **super().get_info(),
            'hasServer': self.server is not None,
            'isRunning': self.server.is_running if self.server else False,
            'serverUrl': self.get_server_url(),
            'receivedPages': len(self.received_pages),
            'isCompleted': self.is_completed
        }
