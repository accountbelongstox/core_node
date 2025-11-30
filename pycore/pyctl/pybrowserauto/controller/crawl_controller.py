#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Crawl Controller

Orchestrates the PyBrowserAuto offline download process.
"""

import time
from typing import Dict, Optional, List, Callable
from pycore.pyfoundations.color_print import ColorPrint


class CrawlController:
    """
    Crawl controller for PyBrowserAuto offline downloads

    Orchestrates the entire crawling and processing pipeline.

    Features:
    - BFS/DFS crawling with depth control
    - Multiple fetcher support (HTTP, Browser, etc.)
    - HTML/CSS processing with resource downloads
    - Max pages and depth limits
    - Progress tracking and statistics
    - Callback support for progress reporting
    """

    def __init__(
        self,
        domain_context,
        url_queue,
        file_mapper,
        resource_processor,
        html_processor,
        css_processor
    ):
        """
        Initialize crawl controller

        Args:
            domain_context: DomainContext instance
            url_queue: URLQueue instance
            file_mapper: FileMapper instance
            resource_processor: ResourceProcessor instance
            html_processor: HTMLProcessor instance
            css_processor: CSSProcessor instance
        """
        self.domain_context = domain_context
        self.url_queue = url_queue
        self.file_mapper = file_mapper
        self.resource_processor = resource_processor
        self.html_processor = html_processor
        self.css_processor = css_processor

        # Fetcher (will be initialized in crawl())
        self.fetcher = None

        # Statistics
        self.total_pages = 0
        self.successful_pages = 0
        self.failed_pages = 0
        self.total_resources = 0
        self.start_time = None
        self.end_time = None

        # Callbacks
        self.on_page_start = None  # Called when starting to process a page
        self.on_page_complete = None  # Called when page processing completes
        self.on_page_error = None  # Called when page processing fails
        self.on_crawl_complete = None  # Called when crawl completes

    def set_callbacks(
        self,
        on_page_start: Optional[Callable] = None,
        on_page_complete: Optional[Callable] = None,
        on_page_error: Optional[Callable] = None,
        on_crawl_complete: Optional[Callable] = None
    ):
        """
        Set callback functions

        Args:
            on_page_start: Callback(url, depth) when starting page
            on_page_complete: Callback(url, result) when page completes
            on_page_error: Callback(url, error) when page fails
            on_crawl_complete: Callback(stats) when crawl completes
        """
        self.on_page_start = on_page_start
        self.on_page_complete = on_page_complete
        self.on_page_error = on_page_error
        self.on_crawl_complete = on_crawl_complete

    def initialize_fetcher(self, fetcher_type: str = 'http', fetcher_options: Optional[Dict] = None):
        """
        Initialize fetcher

        Args:
            fetcher_type: Type of fetcher ('http', 'browser', 'iframe', 'tampermonkey')
            fetcher_options: Fetcher initialization options

        Returns:
            True if successful, False otherwise
        """
        fetcher_options = fetcher_options or {}

        ColorPrint.blue(f'[CrawlController] Initializing {fetcher_type} fetcher')

        # Import fetchers from PyBrowser
        from pycore.pyutils.pybrowser.fetchers import (
            HTTPFetcher,
            BrowserFetcher,
            IframeFetcher,
            TampermonkeyFetcher
        )

        # Create fetcher based on type
        if fetcher_type == 'http':
            self.fetcher = HTTPFetcher()
        elif fetcher_type == 'browser':
            self.fetcher = BrowserFetcher()
        elif fetcher_type == 'iframe':
            self.fetcher = IframeFetcher()
        elif fetcher_type == 'tampermonkey':
            self.fetcher = TampermonkeyFetcher()
        else:
            ColorPrint.red(f'[CrawlController] Unknown fetcher type: {fetcher_type}')
            return False

        # Initialize fetcher
        success = self.fetcher.initialize(fetcher_options)

        if success:
            ColorPrint.green(f'[CrawlController] Fetcher initialized: {fetcher_type}')
        else:
            ColorPrint.red(f'[CrawlController] Failed to initialize fetcher: {fetcher_type}')

        return success

    def cleanup_fetcher(self):
        """Cleanup fetcher resources"""
        if self.fetcher:
            self.fetcher.cleanup()
            ColorPrint.blue('[CrawlController] Fetcher cleaned up')

    def crawl(
        self,
        start_url: str,
        max_depth: int = 3,
        max_pages: int = 100,
        fetcher_type: str = 'http',
        fetcher_options: Optional[Dict] = None,
        download_resources: bool = True,
        process_css: bool = True,
        fetch_timeout: int = 30000
    ) -> Dict:
        """
        Start crawling from the given URL

        Args:
            start_url: Starting URL
            max_depth: Maximum crawl depth (default: 3)
            max_pages: Maximum number of pages to crawl (default: 100)
            fetcher_type: Type of fetcher to use ('http', 'browser', etc.)
            fetcher_options: Fetcher initialization options
            download_resources: If True, download resources (default: True)
            process_css: If True, process CSS files (default: True)
            fetch_timeout: Timeout for fetching pages in milliseconds

        Returns:
            Crawl result dictionary with statistics
        """
        ColorPrint.green('\n' + '='*60)
        ColorPrint.green('PyBrowserAuto Crawl Started')
        ColorPrint.green('='*60)
        ColorPrint.blue(f'Start URL: {start_url}')
        ColorPrint.blue(f'Max Depth: {max_depth}')
        ColorPrint.blue(f'Max Pages: {max_pages}')
        ColorPrint.blue(f'Fetcher: {fetcher_type}')

        self.start_time = time.time()

        # Initialize fetcher
        success = self.initialize_fetcher(fetcher_type, fetcher_options)
        if not success:
            return {
                'success': False,
                'error': 'Failed to initialize fetcher',
                'total_pages': 0,
                'successful_pages': 0,
                'failed_pages': 0
            }

        # Enqueue start URL
        self.url_queue.enqueue(start_url, depth=0)

        # Main crawling loop
        while not self.url_queue.is_empty() and self.total_pages < max_pages:
            # Dequeue next URL
            item = self.url_queue.dequeue()
            if not item:
                break

            url, depth = item

            # Check depth limit
            if depth > max_depth:
                ColorPrint.yellow(f'[CrawlController] Skipping (depth {depth} > max {max_depth}): {url}')
                continue

            # Process page
            self._process_page(
                url,
                depth,
                download_resources,
                process_css,
                fetch_timeout
            )

            # Check if reached max pages
            if self.total_pages >= max_pages:
                ColorPrint.yellow(f'[CrawlController] Reached max pages limit: {max_pages}')
                break

        # Cleanup
        self.cleanup_fetcher()

        self.end_time = time.time()
        elapsed_time = self.end_time - self.start_time

        # Generate statistics
        stats = self.get_stats()
        stats['elapsed_time'] = elapsed_time

        ColorPrint.green('\n' + '='*60)
        ColorPrint.green('PyBrowserAuto Crawl Completed')
        ColorPrint.green('='*60)
        ColorPrint.blue(f'Total Pages: {self.total_pages}')
        ColorPrint.blue(f'Successful: {self.successful_pages}')
        ColorPrint.blue(f'Failed: {self.failed_pages}')
        ColorPrint.blue(f'Total Resources: {self.total_resources}')
        ColorPrint.blue(f'Elapsed Time: {elapsed_time:.2f}s')

        # Call completion callback
        if self.on_crawl_complete:
            self.on_crawl_complete(stats)

        return stats

    def _process_page(
        self,
        url: str,
        depth: int,
        download_resources: bool,
        process_css: bool,
        fetch_timeout: int
    ):
        """
        Process a single page

        Args:
            url: URL to process
            depth: Current depth
            download_resources: Whether to download resources
            process_css: Whether to process CSS files
            fetch_timeout: Fetch timeout in milliseconds
        """
        ColorPrint.green(f'\n[CrawlController] Processing page (depth {depth}): {url}')

        self.total_pages += 1

        # Call page start callback
        if self.on_page_start:
            self.on_page_start(url, depth)

        # Fetch page content
        ColorPrint.blue('[CrawlController] Fetching page content')

        fetch_result = self.fetcher.fetch(url, {'timeout': fetch_timeout})

        if not fetch_result.success:
            ColorPrint.red(f'[CrawlController] Failed to fetch: {url}')
            ColorPrint.red(f'[CrawlController] Error: {fetch_result.error}')

            self.failed_pages += 1

            # Call error callback
            if self.on_page_error:
                self.on_page_error(url, fetch_result.error)

            # Mark as processed
            self.url_queue.mark_processed(url)
            return

        html_content = fetch_result.content

        # Process HTML
        ColorPrint.blue('[CrawlController] Processing HTML')

        html_result = self.html_processor.process_html(
            html_content=html_content,
            url=url,
            download_resources=download_resources,
            rewrite_urls=True,
            save_html=True
        )

        if html_result['success']:
            self.successful_pages += 1
            self.total_resources += html_result['resources_downloaded']

            ColorPrint.green(f'[CrawlController] Successfully processed: {url}')

            # Extract and enqueue links
            links = html_result['links']
            ColorPrint.blue(f'[CrawlController] Found {len(links)} links to crawl')

            for link in links:
                # Enqueue link at depth + 1
                added = self.url_queue.enqueue(link, depth=depth + 1)
                if added:
                    ColorPrint.blue(f'[CrawlController] Enqueued (depth {depth + 1}): {link}')

            # Call completion callback
            if self.on_page_complete:
                self.on_page_complete(url, html_result)

        else:
            self.failed_pages += 1
            ColorPrint.red(f'[CrawlController] Failed to process: {url}')

            # Call error callback
            if self.on_page_error:
                self.on_page_error(url, html_result.get('error', 'Unknown error'))

        # Mark as processed
        self.url_queue.mark_processed(url)

    def get_stats(self) -> Dict:
        """
        Get crawl statistics

        Returns:
            Statistics dictionary
        """
        return {
            'success': True,
            'total_pages': self.total_pages,
            'successful_pages': self.successful_pages,
            'failed_pages': self.failed_pages,
            'total_resources': self.total_resources,
            'queue_stats': self.url_queue.get_stats(),
            'html_processor_stats': self.html_processor.get_stats(),
            'css_processor_stats': self.css_processor.get_stats(),
            'resource_processor_stats': self.resource_processor.get_stats()
        }

    def reset_stats(self):
        """Reset statistics"""
        self.total_pages = 0
        self.successful_pages = 0
        self.failed_pages = 0
        self.total_resources = 0
        self.start_time = None
        self.end_time = None

        ColorPrint.blue('[CrawlController] Statistics reset')

    def cleanup(self):
        """
        Cleanup crawl controller resources

        Cleans up fetcher and resets state for next crawl.
        """
        ColorPrint.blue('[CrawlController] Cleaning up')

        # Cleanup fetcher if exists
        if self.fetcher and hasattr(self.fetcher, 'cleanup'):
            self.fetcher.cleanup()
            ColorPrint.green('[CrawlController] Fetcher cleaned up')

        # Reset fetcher
        self.fetcher = None

        # Reset statistics
        self.reset_stats()

        ColorPrint.green('[CrawlController] Cleanup complete')


__all__ = ['CrawlController']
