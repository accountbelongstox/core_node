#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTML Processor

Processes HTML content: extracts resources, rewrites URLs, and saves for offline viewing.
"""

from pathlib import Path
from typing import Dict, Optional, List
from pycore.pyfoundations.color_print import ColorPrint


class HTMLProcessor:
    """
    HTML content processor

    Coordinates the full HTML processing pipeline for offline viewing.

    Features:
    - Extract and download resources (CSS, JS, images, etc.)
    - Rewrite URLs to relative paths
    - Save processed HTML to local filesystem
    - Extract links for further crawling
    - Track processing statistics
    """

    def __init__(self, file_mapper, domain_context, resource_processor):
        """
        Initialize HTML processor

        Args:
            file_mapper: FileMapper instance
            domain_context: DomainContext instance
            resource_processor: ResourceProcessor instance
        """
        self.file_mapper = file_mapper
        self.domain_context = domain_context
        self.resource_processor = resource_processor
        self.processed_count = 0
        self.saved_files = []

    def extract_links(self, html_content: str, base_url: str) -> List[str]:
        """
        Extract all links from HTML content

        Args:
            html_content: HTML content
            base_url: Base URL for resolving relative URLs

        Returns:
            List of absolute link URLs
        """
        from pycore.pyfoundations.third_party import get_third_package_BeautifulSoup

        BeautifulSoup = get_third_package_BeautifulSoup()
        if not BeautifulSoup:
            ColorPrint.red('[HTMLProcessor] BeautifulSoup not available')
            return []

        soup = BeautifulSoup(html_content, 'html.parser')
        links = []

        # Extract <a> tags
        for tag in soup.find_all('a', href=True):
            href = tag.get('href')
            if href and not href.startswith(('#', 'javascript:', 'mailto:', 'tel:', 'data:')):
                absolute_url = self.domain_context.resolve_href(base_url, href)

                # Only include links within scope
                if self.domain_context.is_within_scope(absolute_url):
                    links.append(absolute_url)

        # Remove duplicates
        unique_links = list(set(links))

        ColorPrint.blue(f'[HTMLProcessor] Extracted {len(unique_links)} unique links')
        return unique_links

    def process_html(
        self,
        html_content: str,
        url: str,
        download_resources: bool = True,
        rewrite_urls: bool = True,
        save_html: bool = True,
        resource_timeout: int = 30000,
        resource_headers: Optional[Dict] = None
    ) -> Dict:
        """
        Process HTML content: extract resources, rewrite URLs, save

        Args:
            html_content: HTML content to process
            url: URL of the HTML page
            download_resources: If True, download resources (default: True)
            rewrite_urls: If True, rewrite URLs to relative paths (default: True)
            save_html: If True, save processed HTML to filesystem (default: True)
            resource_timeout: Timeout for resource downloads in milliseconds
            resource_headers: Optional custom headers for resource downloads

        Returns:
            Processing result dictionary
        """
        ColorPrint.green(f'[HTMLProcessor] Processing HTML: {url}')

        result = {
            'url': url,
            'success': False,
            'resources_extracted': 0,
            'resources_downloaded': 0,
            'resources_failed': 0,
            'urls_rewritten': 0,
            'links_extracted': 0,
            'html_saved': False,
            'html_path': None,
            'links': [],
            'error': None
        }

        # Step 1: Extract and download resources
        if download_resources:
            ColorPrint.blue('[HTMLProcessor] Step 1: Extract and download resources')
            resource_result = self.resource_processor.process_resources(
                html_content,
                url,
                download=True,
                timeout=resource_timeout,
                headers=resource_headers
            )

            result['resources_extracted'] = resource_result['total_resources']
            result['resources_downloaded'] = resource_result['downloaded']
            result['resources_failed'] = resource_result['failed']

            ColorPrint.green(
                f'[HTMLProcessor] Resources: {result["resources_downloaded"]} downloaded, '
                f'{result["resources_failed"]} failed'
            )

        # Step 2: Rewrite URLs
        processed_html = html_content
        if rewrite_urls:
            ColorPrint.blue('[HTMLProcessor] Step 2: Rewrite URLs to relative paths')

            from pycore.pyctl.document_offline.core import URLRewriter
            rewriter = URLRewriter(url, self.file_mapper)
            processed_html = rewriter.rewrite_html(html_content, preserve_external=True)

            result['urls_rewritten'] = rewriter.get_rewrite_count()

            ColorPrint.green(f'[HTMLProcessor] Rewrote {result["urls_rewritten"]} URLs')

        # Step 3: Save processed HTML
        if save_html:
            ColorPrint.blue('[HTMLProcessor] Step 3: Save processed HTML')

            filepath = self.file_mapper.get_absolute_path(url, content_type='text/html')
            self.file_mapper.ensure_directory(filepath)

            # Write HTML file
            filepath.write_text(processed_html, encoding='utf-8')

            result['html_saved'] = True
            result['html_path'] = str(filepath)

            self.saved_files.append(str(filepath))

            ColorPrint.green(f'[HTMLProcessor] Saved HTML: {filepath}')

        # Step 4: Extract links for crawling
        ColorPrint.blue('[HTMLProcessor] Step 4: Extract links')
        links = self.extract_links(html_content, url)
        result['links'] = links
        result['links_extracted'] = len(links)

        ColorPrint.green(f'[HTMLProcessor] Extracted {len(links)} links for crawling')

        # Mark success
        result['success'] = True
        self.processed_count += 1

        ColorPrint.green(f'[HTMLProcessor] Successfully processed: {url}')

        return result

    def process_and_save(
        self,
        html_content: str,
        url: str,
        options: Optional[Dict] = None
    ) -> Dict:
        """
        Simplified processing: process HTML and save with default options

        Args:
            html_content: HTML content
            url: URL of the page
            options: Optional processing options

        Returns:
            Processing result dictionary
        """
        options = options or {}

        return self.process_html(
            html_content=html_content,
            url=url,
            download_resources=options.get('download_resources', True),
            rewrite_urls=options.get('rewrite_urls', True),
            save_html=options.get('save_html', True),
            resource_timeout=options.get('resource_timeout', 30000),
            resource_headers=options.get('resource_headers', None)
        )

    def get_stats(self) -> Dict:
        """
        Get processor statistics

        Returns:
            Statistics dictionary
        """
        return {
            'processed_count': self.processed_count,
            'saved_files': len(self.saved_files),
            'resource_stats': self.resource_processor.get_stats()
        }

    def clear_cache(self):
        """Clear processing caches"""
        self.saved_files.clear()
        self.resource_processor.clear_cache()
        ColorPrint.blue('[HTMLProcessor] Cache cleared')


__all__ = ['HTMLProcessor']
