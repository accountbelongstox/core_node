#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Offline Controller

Main controller for offline document crawling (simplified version without pybrowser)
"""

import asyncio
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List, Set
from urllib.parse import urlparse

from .domain_context import DomainContext
from .file_mapper import FileMapper
from .url_queue import UrlQueue


class DocumentOfflineController:
    """
    Controller for offline document crawling

    Features:
    - HTTP fetching (aiohttp)
    - Recursive crawling with depth control
    - Same-origin filtering
    - Resource collection
    - Sitemap generation
    - Progress tracking
    """

    def __init__(self):
        """Initialize document offline controller"""
        self.domain_context: Optional[DomainContext] = None
        self.queue = UrlQueue()
        self.url_pool: Set[str] = set()
        self.max_depth = 3
        self.file_mapper = FileMapper({
            '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
            '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
            '.svg', '.webp', '.ico', '.css', '.js', '.mp3', '.mp4', '.avi', '.mov',
            '.m4v', '.webm', '.woff', '.woff2', '.ttf', '.otf', '.eot'
        })
        self.fetcher_type = 'http'
        self.downloaded_urls: List[str] = []
        self.failed_urls: List[Dict[str, str]] = []
        self.final_host_dir: Optional[str] = None
        self.disable_js = False
        self.screenshot = False
        self.debug = False
        self.scope_type = 'full'

    async def start(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start crawling process

        Args:
            config: Configuration dict with:
                - target_url: URL to crawl
                - depth: Max recursion depth (default: 3)
                - fetcher_type: Fetcher type (default: http)
                - scope_type: Scope type (full/path, default: full)
                - disable_js: Disable JavaScript (default: False)
                - screenshot: Capture screenshots (default: False)
                - debug: Debug mode (default: False)
                - output_dir: Output directory (optional)

        Returns:
            Result dict with status and statistics
        """
        target_url = config.get('target_url')
        if not target_url:
            return {'success': False, 'error': 'target_url is required'}

        self.max_depth = config.get('depth', 3)
        self.fetcher_type = config.get('fetcher_type', 'http')
        self.scope_type = config.get('scope_type', 'full')
        self.disable_js = config.get('disable_js', False)
        self.screenshot = config.get('screenshot', False)
        self.debug = config.get('debug', False)
        self.downloaded_urls = []
        self.failed_urls = []

        # Initialize domain context
        self.domain_context = DomainContext(target_url)

        print(f"[INFO] Starting document offline analysis for: {target_url}")
        print(f"[INFO] Recursion depth: {self.max_depth}")
        print(f"[INFO] Hostname validation: {self.domain_context.get_validation_domain()}")
        print(f"[INFO] Primary origin: {self.domain_context.get_origin()}")

        # Apply scope type
        self.apply_scope_type(self.scope_type)

        # Prepare download directory
        parsed = urlparse(self.domain_context.get_origin())
        if 'output_dir' in config:
            self.final_host_dir = config['output_dir']
        else:
            # Use project cache directory
            project_root = Path(__file__).parent.parent.parent.parent.parent
            cache_dir = project_root / '.cache' / 'DocumentOffline' / parsed.netloc
            self.final_host_dir = str(cache_dir)

        os.makedirs(self.final_host_dir, exist_ok=True)

        # Enqueue start URL
        canonical_target = self.domain_context.get_start_url()
        self.queue.enqueue(canonical_target, 0)
        self.url_pool.add(canonical_target)

        try:
            # Process queue
            await self.process_queue()

            # Generate reports
            await self.generate_sitemap()
            await self.save_failed_urls_report()

            stats = self.get_download_summary()

            return {
                'success': True,
                'output_dir': self.final_host_dir,
                'statistics': stats
            }

        except Exception as e:
            print(f"[ERROR] Processing failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def apply_scope_type(self, scope_type: str):
        """
        Apply scope type to domain context

        Args:
            scope_type: 'full' or 'path'
        """
        self.scope_type = scope_type

        if scope_type == 'path':
            print(f"[INFO] Path scope validation enabled: only URLs under {self.domain_context.get_scope_url()}")
        else:
            # Override is_within_scope to always return True for full site scope
            self.domain_context.is_within_scope = lambda url: True
            print(f"[INFO] Full site scope enabled: all URLs under {self.domain_context.get_origin()}")

    async def process_queue(self):
        """Process URL queue"""
        while self.queue.has_pending():
            item = self.queue.dequeue()
            if not item:
                continue

            url = item['url']
            depth = item['depth']

            if self.queue.has_processed(url):
                continue

            self.queue.mark_processed(url)

            print(f"[INFO] [{self.queue.processed_count()}/{self.queue.processed_count() + self.queue.size()}] Processing: {url} (depth: {depth})")

            try:
                # Fetch page
                result = await self.fetch_with_http(url, depth)

                if result.get('success'):
                    self.downloaded_urls.append(url)
                    print(f"[SUCCESS] ✓ Downloaded: {url}")
                else:
                    self.failed_urls.append({'url': url, 'error': result.get('error', 'Unknown error')})
                    print(f"[ERROR] ✗ Failed: {url} - {result.get('error')}")

            except Exception as e:
                self.failed_urls.append({'url': url, 'error': str(e)})
                print(f"[ERROR] ✗ Error processing {url}: {str(e)}")

    async def fetch_with_http(self, url: str, depth: int) -> Dict[str, Any]:
        """
        Fetch page using HTTP request

        Args:
            url: URL to fetch
            depth: Current depth

        Returns:
            Result dict
        """
        try:
            import aiohttp

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    html = await response.text()

                    # Save page
                    await self.save_page(url, html, False)

                    # Extract links and enqueue if not at max depth
                    if depth < self.max_depth:
                        links = self.extract_links(html, url)
                        for link in links:
                            if self.domain_context.is_internal_link(link) and link not in self.url_pool:
                                self.queue.enqueue(link, depth + 1)
                                self.url_pool.add(link)

                    return {'success': True}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def extract_links(self, html: str, base_url: str) -> List[str]:
        """
        Extract links from HTML

        Args:
            html: HTML content
            base_url: Base URL for resolution

        Returns:
            List of absolute URLs
        """
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            print("[WARNING] BeautifulSoup not installed, cannot extract links")
            return []

        links = []
        soup = BeautifulSoup(html, 'html.parser')

        for tag in soup.find_all('a', href=True):
            href = tag['href']
            resolved = self.domain_context.resolve_href(base_url, href)
            if resolved and resolved['canonical']:
                links.append(resolved['canonical'])

        return links

    async def save_page(self, url: str, content: str, is_binary: bool):
        """
        Save page to local file

        Args:
            url: Page URL
            content: Page content
            is_binary: Whether content is binary
        """
        parsed = urlparse(url)
        relative_path = self.file_mapper.map_path(parsed)
        full_path = os.path.join(self.final_host_dir, relative_path)

        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        if is_binary:
            with open(full_path, 'wb') as f:
                f.write(content)
        else:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

    async def generate_sitemap(self):
        """Generate sitemap.txt file"""
        sitemap_path = os.path.join(self.final_host_dir, 'sitemap.txt')

        with open(sitemap_path, 'w', encoding='utf-8') as f:
            for url in sorted(self.downloaded_urls):
                f.write(f"{url}\n")

        print(f"[SUCCESS] Sitemap generated: {sitemap_path}")

    async def save_failed_urls_report(self):
        """Save failed URLs report"""
        if not self.failed_urls:
            return

        report_path = os.path.join(self.final_host_dir, 'failed_urls.json')

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.failed_urls, f, indent=2, ensure_ascii=False)

        print(f"[WARNING] Failed URLs report saved: {report_path}")

    def get_download_summary(self) -> Dict[str, Any]:
        """
        Get download summary statistics

        Returns:
            Statistics dict
        """
        return {
            'total_urls': self.queue.processed_count(),
            'downloaded': len(self.downloaded_urls),
            'failed': len(self.failed_urls),
            'screenshots': 0,
            'max_depth': self.max_depth,
            'fetcher_type': self.fetcher_type,
            'scope_type': self.scope_type
        }

    async def cleanup_fetcher(self):
        """Cleanup fetcher resources"""
        # HTTP fetcher has no cleanup needed
        pass
