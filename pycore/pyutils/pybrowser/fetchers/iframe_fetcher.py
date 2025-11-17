#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IframeFetcher

Recursive iframe fetcher for deep page traversal with iframe content extraction
"""

import time
from typing import Dict, Any, List
from urllib.parse import urlparse
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.fetchers.base_fetcher import BaseFetcher, FetchResult


class IframeFetchResult:
    """Extended fetch result for iframe crawling"""

    def __init__(self):
        self.success = False
        self.start_url = None
        self.pages = []
        self.total_pages = 0
        self.failed_urls = []
        self.max_depth_reached = 0
        self.error = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'startUrl': self.start_url,
            'pages': self.pages,
            'totalPages': self.total_pages,
            'failedUrls': self.failed_urls,
            'maxDepthReached': self.max_depth_reached,
            'error': self.error
        }


class IframeFetcher(BaseFetcher):
    """
    Iframe fetcher for recursive iframe content extraction

    Recursively crawls iframes and their links to extract nested content
    Best for: Sites with heavy iframe usage, nested documents
    """

    def __init__(self):
        super().__init__()
        self.fetcher_name = "IframeFetcher"
        self.engine = None
        self.session = None
        self.current_page = None

    def initialize(self, options: Dict[str, Any] = None) -> bool:
        """
        Initialize iframe fetcher

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
        ColorPrint.green(f'[IframeFetcher] Initialized successfully')
        return True

    def fetch(self, url: str, options: Dict[str, Any] = None) -> IframeFetchResult:
        """
        Fetch content from URL and recursively crawl iframes

        Args:
            url: URL to fetch
            options: Fetch options (maxDepth, delay, sameOriginOnly, onPageCallback)

        Returns:
            IframeFetchResult object with all crawled pages
        """
        result = IframeFetchResult()
        options = options or {}

        if not self.is_initialized:
            result.error = 'IframeFetcher not initialized. Call initialize() first.'
            ColorPrint.red(f'[IframeFetcher] {result.error}')
            return result

        # Create page if needed
        if not self.current_page:
            self.current_page = self.session.new_page()

        max_depth = options.get('maxDepth', 10)
        delay = options.get('delay', 1000) / 1000  # Convert to seconds
        same_origin_only = options.get('sameOriginOnly', True)
        on_page_callback = options.get('onPageCallback')

        ColorPrint.green(f'[IframeFetcher] Starting recursive iframe crawl from: {url}')

        # Navigate to initial page
        self.current_page.goto(url, {
            'waitUntil': options.get('waitUntil', 'networkidle2'),
            'timeout': options.get('timeout', 30000)
        })

        # Initialize crawl state
        result.start_url = url
        parsed = urlparse(url)
        start_origin = f'{parsed.scheme}://{parsed.netloc}'

        processed_urls = set()
        failed_urls = []

        # Capture initial page
        content = self.current_page.get_content()
        initial_page = {
            'url': url,
            'content': content,
            'contentLength': len(content),
            'depth': 0,
            'success': True,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
        }
        result.pages.append(initial_page)
        processed_urls.add(url)

        if on_page_callback and callable(on_page_callback):
            on_page_callback(initial_page, 1, 0)

        ColorPrint.green(f'[IframeFetcher] Initial page captured: {url}')

        # Recursive crawl function
        def crawl_recursive(current_url: str, depth: int):
            if depth >= max_depth:
                ColorPrint.yellow(f'[IframeFetcher] Max depth {max_depth} reached')
                return

            # Get all links on current page
            links = self._get_page_links(current_url, start_origin, same_origin_only)

            # Filter unprocessed links
            unprocessed_links = [
                link for link in links
                if link['normalizedUrl'] not in processed_urls
                and link['normalizedUrl'] not in failed_urls
            ]

            ColorPrint.green(f'[IframeFetcher] Found {len(unprocessed_links)} unprocessed links at depth {depth}')

            # Process each link
            for i, link in enumerate(unprocessed_links):
                if link['normalizedUrl'] in processed_urls:
                    continue

                ColorPrint.green(f'[IframeFetcher] Processing link {i + 1}/{len(unprocessed_links)}: {link["text"]}')

                # Click link and navigate
                clicked = self._click_link_by_href(link['href'])
                if not clicked:
                    ColorPrint.yellow(f'[IframeFetcher] Failed to click link: {link["normalizedUrl"]}')
                    failed_urls.append(link['normalizedUrl'])
                    continue

                time.sleep(delay)

                # Get new URL
                new_url = self.current_page.get_url()
                normalized_new_url = self._normalize_url(new_url)

                if normalized_new_url in processed_urls:
                    ColorPrint.green(f'[IframeFetcher] Already processed, going back: {normalized_new_url}')
                    self.current_page.go_back()
                    time.sleep(delay)
                    continue

                # Capture page content
                content = self.current_page.get_content()
                page_data = {
                    'url': normalized_new_url,
                    'originalUrl': new_url,
                    'linkText': link.get('text', ''),
                    'content': content,
                    'contentLength': len(content),
                    'depth': depth + 1,
                    'success': True,
                    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
                }

                result.pages.append(page_data)
                processed_urls.add(normalized_new_url)

                if on_page_callback and callable(on_page_callback):
                    on_page_callback(page_data, len(result.pages), depth + 1)

                ColorPrint.green(f'[IframeFetcher] Captured page at depth {depth + 1}: {normalized_new_url}')

                # Recursive crawl
                crawl_recursive(new_url, depth + 1)

                # Go back
                ColorPrint.green(f'[IframeFetcher] Going back from depth {depth + 1} to {depth}')
                self.current_page.go_back()
                time.sleep(delay)

        # Start recursive crawl
        crawl_recursive(url, 0)

        # Set result
        result.success = True
        result.total_pages = len(result.pages)
        result.failed_urls = failed_urls
        result.max_depth_reached = max([p['depth'] for p in result.pages]) if result.pages else 0

        ColorPrint.green(f'[IframeFetcher] Crawl completed: {result.total_pages} pages, {len(failed_urls)} failed')
        return result

    def _get_page_links(self, current_url: str, start_origin: str, same_origin_only: bool) -> List[Dict[str, Any]]:
        """Get all valid links on current page"""
        script = """
        return Array.from(document.querySelectorAll('a[href]')).map((a, index) => ({
            href: a.href,
            text: a.textContent.trim(),
            id: a.id || '',
            className: a.className || '',
            index: index
        }));
        """

        links = self.current_page.evaluate(script)
        if not links:
            return []

        # Filter valid links
        valid_links = []
        for link in links:
            href = link.get('href', '')
            if not href:
                continue

            parsed = urlparse(href)
            if parsed.scheme not in ['http', 'https']:
                continue

            if same_origin_only:
                origin = f'{parsed.scheme}://{parsed.netloc}'
                if origin != start_origin:
                    continue

            link['normalizedUrl'] = self._normalize_url(href)
            valid_links.append(link)

        return valid_links

    def _click_link_by_href(self, target_href: str) -> bool:
        """Click link by href"""
        script = """
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const targetAnchor = anchors.find(a => a.href === arguments[0]);
        if (targetAnchor) {
            targetAnchor.click();
            return true;
        }
        return false;
        """

        clicked = self.current_page.evaluate(script, target_href)
        return bool(clicked)

    def _normalize_url(self, url: str) -> str:
        """Normalize URL (remove hash)"""
        parsed = urlparse(url)
        return f'{parsed.scheme}://{parsed.netloc}{parsed.path}{("?" + parsed.query) if parsed.query else ""}'

    def cleanup(self) -> bool:
        """Cleanup iframe fetcher"""
        if self.current_page:
            self.current_page.close()
            self.current_page = None

        if self.session:
            self.session.close()
            self.session = None

        if self.engine:
            self.engine = None

        self.is_initialized = False
        ColorPrint.green('[IframeFetcher] Cleanup completed')
        return True

    def get_info(self) -> Dict[str, Any]:
        """Get fetcher information"""
        return {
            **super().get_info(),
            'hasEngine': self.engine is not None,
            'hasSession': self.session is not None,
            'hasPage': self.current_page is not None
        }
