#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLI Controller

Command-line interface for document offline downloads.
"""

import sys
import argparse
from pathlib import Path
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


class CLIController:
    """
    CLI controller for document offline downloads

    Provides command-line interface for crawling and downloading documents.

    Features:
    - Argument parsing
    - Component initialization
    - Progress display
    - Statistics reporting
    """

    def __init__(self):
        """Initialize CLI controller"""
        self.parser = self._create_parser()

    def _create_parser(self) -> argparse.ArgumentParser:
        """
        Create argument parser

        Returns:
            ArgumentParser instance
        """
        parser = argparse.ArgumentParser(
            description='DocumentOffline - Download websites for offline viewing',
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  # Basic download
  python -m pycore.pyctl.pybrowserauto.controller.cli_controller \\
      --url https://example.com/docs/ \\
      --output ./downloads

  # Advanced download with options
  python -m pycore.pyctl.pybrowserauto.controller.cli_controller \\
      --url https://example.com/docs/ \\
      --output ./downloads \\
      --depth 5 \\
      --max-pages 500 \\
      --fetcher browser \\
      --scope path

  # Quick download (HTTP fetcher, shallow depth)
  python -m pycore.pyctl.pybrowserauto.controller.cli_controller \\
      --url https://example.com/page.html \\
      --output ./downloads \\
      --depth 1 \\
      --max-pages 10
            """
        )

        # Required arguments
        parser.add_argument(
            '--url',
            type=str,
            required=True,
            help='Starting URL to crawl'
        )

        parser.add_argument(
            '--output',
            type=str,
            required=True,
            help='Output directory for downloaded files'
        )

        # Optional arguments
        parser.add_argument(
            '--depth',
            type=int,
            default=3,
            help='Maximum crawl depth (default: 3)'
        )

        parser.add_argument(
            '--max-pages',
            type=int,
            default=100,
            help='Maximum number of pages to crawl (default: 100)'
        )

        parser.add_argument(
            '--fetcher',
            type=str,
            choices=['http', 'browser', 'iframe', 'tampermonkey'],
            default='http',
            help='Fetcher type to use (default: http)'
        )

        parser.add_argument(
            '--scope',
            type=str,
            choices=['full', 'path'],
            default='path',
            help='Crawl scope: "full" (entire domain) or "path" (specific path) (default: path)'
        )

        parser.add_argument(
            '--no-resources',
            action='store_true',
            help='Do not download resources (CSS, JS, images)'
        )

        parser.add_argument(
            '--timeout',
            type=int,
            default=30000,
            help='Fetch timeout in milliseconds (default: 30000)'
        )

        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Enable verbose output'
        )

        return parser

    def run(self, args: Optional[list] = None):
        """
        Run CLI controller

        Args:
            args: Command-line arguments (default: sys.argv[1:])
        """
        # Parse arguments
        if args is None:
            args = sys.argv[1:]

        parsed_args = self.parser.parse_args(args)

        # Display configuration
        ColorPrint.green('\n' + '='*60)
        ColorPrint.green('DocumentOffline CLI')
        ColorPrint.green('='*60)
        ColorPrint.blue(f'URL: {parsed_args.url}')
        ColorPrint.blue(f'Output: {parsed_args.output}')
        ColorPrint.blue(f'Max Depth: {parsed_args.depth}')
        ColorPrint.blue(f'Max Pages: {parsed_args.max_pages}')
        ColorPrint.blue(f'Fetcher: {parsed_args.fetcher}')
        ColorPrint.blue(f'Scope: {parsed_args.scope}')
        ColorPrint.blue(f'Download Resources: {not parsed_args.no_resources}')
        ColorPrint.blue(f'Timeout: {parsed_args.timeout}ms')

        # Initialize components
        ColorPrint.green('\n[CLI] Initializing components...')

        success = self._initialize_components(
            url=parsed_args.url,
            output_dir=parsed_args.output,
            scope_mode=parsed_args.scope
        )

        if not success:
            ColorPrint.red('[CLI] Failed to initialize components')
            return

        # Start crawling
        ColorPrint.green('\n[CLI] Starting crawl...')

        result = self.crawl_controller.crawl(
            start_url=parsed_args.url,
            max_depth=parsed_args.depth,
            max_pages=parsed_args.max_pages,
            fetcher_type=parsed_args.fetcher,
            download_resources=not parsed_args.no_resources,
            process_css=True,
            fetch_timeout=parsed_args.timeout
        )

        # Display results
        self._display_results(result)

    def _initialize_components(self, url: str, output_dir: str, scope_mode: str) -> bool:
        """
        Initialize all components

        Args:
            url: Starting URL
            output_dir: Output directory
            scope_mode: Scope mode ('full' or 'path')

        Returns:
            True if successful, False otherwise
        """
        from urllib.parse import urlparse

        # Import components
        from pycore.pyctl.pybrowserauto.core import (
            DomainContext,
            URLQueue,
            FileMapper,
            URLRewriter
        )

        from pycore.pyctl.pybrowserauto.processor import (
            ResourceProcessor,
            HTMLProcessor,
            CSSProcessor
        )

        from pycore.pyctl.pybrowserauto.controller import CrawlController

        # Parse URL for origin
        parsed = urlparse(url)
        origin = f'{parsed.scheme}://{parsed.netloc}'

        ColorPrint.blue(f'[CLI] Origin: {origin}')

        # Initialize domain context
        self.domain_context = DomainContext(url, scope_mode=scope_mode)
        ColorPrint.green('[CLI] ✓ DomainContext initialized')

        # Initialize URL queue
        self.url_queue = URLQueue()
        ColorPrint.green('[CLI] ✓ URLQueue initialized')

        # Initialize file mapper
        self.file_mapper = FileMapper(output_dir, origin)
        ColorPrint.green('[CLI] ✓ FileMapper initialized')

        # Initialize processors
        self.resource_processor = ResourceProcessor(
            self.file_mapper,
            self.domain_context
        )
        ColorPrint.green('[CLI] ✓ ResourceProcessor initialized')

        self.html_processor = HTMLProcessor(
            self.file_mapper,
            self.domain_context,
            self.resource_processor
        )
        ColorPrint.green('[CLI] ✓ HTMLProcessor initialized')

        self.css_processor = CSSProcessor(
            self.file_mapper,
            self.domain_context,
            self.resource_processor
        )
        ColorPrint.green('[CLI] ✓ CSSProcessor initialized')

        # Initialize crawl controller
        self.crawl_controller = CrawlController(
            self.domain_context,
            self.url_queue,
            self.file_mapper,
            self.resource_processor,
            self.html_processor,
            self.css_processor
        )
        ColorPrint.green('[CLI] ✓ CrawlController initialized')

        # Set progress callbacks
        self.crawl_controller.set_callbacks(
            on_page_start=self._on_page_start,
            on_page_complete=self._on_page_complete,
            on_page_error=self._on_page_error,
            on_crawl_complete=self._on_crawl_complete
        )

        return True

    def _on_page_start(self, url: str, depth: int):
        """Callback: Page processing started"""
        ColorPrint.blue(f'[Progress] Starting page (depth {depth}): {url}')

    def _on_page_complete(self, url: str, result: dict):
        """Callback: Page processing completed"""
        ColorPrint.green(
            f'[Progress] ✓ Completed: {url} '
            f'({result["resources_downloaded"]} resources, {result["links_extracted"]} links)'
        )

    def _on_page_error(self, url: str, error: str):
        """Callback: Page processing failed"""
        ColorPrint.red(f'[Progress] ✗ Failed: {url} ({error})')

    def _on_crawl_complete(self, stats: dict):
        """Callback: Crawl completed"""
        ColorPrint.green('[Progress] Crawl completed!')

    def _display_results(self, result: dict):
        """
        Display crawl results

        Args:
            result: Crawl result dictionary
        """
        ColorPrint.green('\n' + '='*60)
        ColorPrint.green('Crawl Results')
        ColorPrint.green('='*60)

        ColorPrint.blue(f'Total Pages: {result["total_pages"]}')
        ColorPrint.blue(f'Successful Pages: {result["successful_pages"]}')
        ColorPrint.blue(f'Failed Pages: {result["failed_pages"]}')
        ColorPrint.blue(f'Total Resources: {result["total_resources"]}')

        if 'elapsed_time' in result:
            ColorPrint.blue(f'Elapsed Time: {result["elapsed_time"]:.2f}s')

        # Queue stats
        queue_stats = result.get('queue_stats', {})
        ColorPrint.blue(f'\nQueue Stats:')
        ColorPrint.blue(f'  Queued: {queue_stats.get("queued", 0)}')
        ColorPrint.blue(f'  Processed: {queue_stats.get("processed", 0)}')
        ColorPrint.blue(f'  Pending: {queue_stats.get("pending", 0)}')

        # Resource stats
        resource_stats = result.get('resource_processor_stats', {})
        ColorPrint.blue(f'\nResource Stats:')
        ColorPrint.blue(f'  Downloaded: {resource_stats.get("download_count", 0)}')
        ColorPrint.blue(f'  Failed: {resource_stats.get("fail_count", 0)}')

        ColorPrint.green('\n' + '='*60)


def main():
    """Main entry point"""
    cli = CLIController()
    cli.run()


if __name__ == '__main__':
    main()


__all__ = ['CLIController', 'main']
