#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Processor

Extracts, downloads, and processes resources (CSS, JS, images, fonts, etc.) from HTML content.
"""

import os
from pathlib import Path
from urllib.parse import urljoin
from typing import List, Dict, Tuple, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests


class ResourceProcessor:
    """
    Resource processor for HTML content

    Extracts resources, downloads them, and saves to local filesystem.

    Features:
    - Extract resources from HTML (img, script, link, video, audio, etc.)
    - Download resources using requests
    - Save resources to local filesystem
    - Track downloaded and failed resources
    - Support for custom headers and timeout
    """

    def __init__(self, file_mapper, domain_context):
        """
        Initialize resource processor

        Args:
            file_mapper: FileMapper instance
            domain_context: DomainContext instance
        """
        self.file_mapper = file_mapper
        self.domain_context = domain_context
        self.downloaded_resources = set()
        self.failed_resources = set()
        self.download_count = 0
        self.fail_count = 0

    def extract_resources(self, html_content: str, base_url: str) -> List[str]:
        """
        Extract all resource URLs from HTML content

        Args:
            html_content: HTML content
            base_url: Base URL for resolving relative URLs

        Returns:
            List of absolute resource URLs
        """
        from pycore.pyfoundations.third_party import get_third_package_BeautifulSoup

        BeautifulSoup = get_third_package_BeautifulSoup()
        if not BeautifulSoup:
            ColorPrint.red('[ResourceProcessor] BeautifulSoup not available')
            return []

        soup = BeautifulSoup(html_content, 'html.parser')
        resources = []

        # Extract images
        for tag in soup.find_all('img'):
            src = tag.get('src') or tag.get('data-src')
            if src and not src.startswith('data:'):
                absolute_url = urljoin(base_url, src)
                resources.append(absolute_url)

        # Extract stylesheets
        for tag in soup.find_all('link', rel='stylesheet'):
            href = tag.get('href')
            if href and not href.startswith('data:'):
                absolute_url = urljoin(base_url, href)
                resources.append(absolute_url)

        # Extract scripts
        for tag in soup.find_all('script', src=True):
            src = tag.get('src')
            if src and not src.startswith('data:'):
                absolute_url = urljoin(base_url, src)
                resources.append(absolute_url)

        # Extract videos
        for tag in soup.find_all(['video', 'source']):
            src = tag.get('src') or tag.get('poster')
            if src and not src.startswith('data:'):
                absolute_url = urljoin(base_url, src)
                resources.append(absolute_url)

        # Extract audio
        for tag in soup.find_all(['audio', 'source']):
            src = tag.get('src')
            if src and not src.startswith('data:'):
                absolute_url = urljoin(base_url, src)
                resources.append(absolute_url)

        # Extract fonts (link with rel containing "font")
        for tag in soup.find_all('link'):
            rel = tag.get('rel', [])
            if isinstance(rel, list):
                rel = ' '.join(rel)
            if 'font' in rel.lower():
                href = tag.get('href')
                if href and not href.startswith('data:'):
                    absolute_url = urljoin(base_url, href)
                    resources.append(absolute_url)

        # Remove duplicates
        unique_resources = list(set(resources))

        ColorPrint.blue(f'[ResourceProcessor] Extracted {len(unique_resources)} unique resources')
        return unique_resources

    def download_resource(
        self,
        resource_url: str,
        timeout: int = 30000,
        headers: Optional[Dict] = None
    ) -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Download single resource

        Args:
            resource_url: Resource URL to download
            timeout: Timeout in milliseconds (default: 30000)
            headers: Optional custom headers

        Returns:
            Tuple of (success, content, error_message)
        """
        # Check if already downloaded
        if resource_url in self.downloaded_resources:
            return (True, None, 'Already downloaded')

        # Check if previously failed
        if resource_url in self.failed_resources:
            return (False, None, 'Previously failed')

        requests = get_third_package_requests()
        if not requests:
            error_msg = 'requests library not available'
            ColorPrint.red(f'[ResourceProcessor] {error_msg}')
            return (False, None, error_msg)

        # Default headers
        default_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        if headers:
            default_headers.update(headers)

        timeout_seconds = timeout / 1000

        ColorPrint.blue(f'[ResourceProcessor] Downloading: {resource_url}')

        # Download resource
        response = requests.get(
            resource_url,
            timeout=timeout_seconds,
            headers=default_headers,
            stream=True
        )

        if response.status_code < 200 or response.status_code >= 400:
            error_msg = f'HTTP {response.status_code}'
            ColorPrint.yellow(f'[ResourceProcessor] Failed to download: {resource_url} ({error_msg})')
            self.failed_resources.add(resource_url)
            self.fail_count += 1
            return (False, None, error_msg)

        # Read content
        content = response.content

        self.downloaded_resources.add(resource_url)
        self.download_count += 1

        ColorPrint.green(f'[ResourceProcessor] Downloaded: {resource_url} ({len(content)} bytes)')
        return (True, content, None)

    def save_resource(
        self,
        resource_url: str,
        content: bytes,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        """
        Save resource to local filesystem

        Args:
            resource_url: Resource URL
            content: Resource content (bytes)
            content_type: Optional Content-Type header

        Returns:
            Local file path or None if failed
        """
        # Get absolute file path
        filepath = self.file_mapper.get_absolute_path(resource_url, content_type)

        # Ensure directory exists
        self.file_mapper.ensure_directory(filepath)

        # Write file
        filepath.write_bytes(content)

        ColorPrint.green(f'[ResourceProcessor] Saved: {filepath}')
        return str(filepath)

    def process_resources(
        self,
        html_content: str,
        base_url: str,
        download: bool = True,
        timeout: int = 30000,
        headers: Optional[Dict] = None
    ) -> Dict[str, any]:
        """
        Process all resources: extract, download, save

        Args:
            html_content: HTML content
            base_url: Base URL for resolving relative URLs
            download: If True, download resources (default: True)
            timeout: Timeout in milliseconds
            headers: Optional custom headers

        Returns:
            Processing result dictionary
        """
        # Extract resources
        resources = self.extract_resources(html_content, base_url)

        if not download:
            return {
                'total_resources': len(resources),
                'resources': resources,
                'downloaded': 0,
                'failed': 0
            }

        downloaded = []
        failed = []

        # Download and save each resource
        for resource_url in resources:
            success, content, error = self.download_resource(resource_url, timeout, headers)

            if success and content:
                # Save resource
                saved_path = self.save_resource(
                    resource_url,
                    content,
                    content_type=None  # Could be extracted from response headers
                )

                if saved_path:
                    downloaded.append({
                        'url': resource_url,
                        'path': saved_path,
                        'size': len(content)
                    })
            else:
                failed.append({
                    'url': resource_url,
                    'error': error or 'Unknown error'
                })

        ColorPrint.green(f'[ResourceProcessor] Processed {len(resources)} resources: {len(downloaded)} downloaded, {len(failed)} failed')

        return {
            'total_resources': len(resources),
            'resources': resources,
            'downloaded': len(downloaded),
            'downloaded_list': downloaded,
            'failed': len(failed),
            'failed_list': failed
        }

    def get_stats(self) -> Dict:
        """
        Get processor statistics

        Returns:
            Statistics dictionary
        """
        return {
            'download_count': self.download_count,
            'fail_count': self.fail_count,
            'downloaded_resources': len(self.downloaded_resources),
            'failed_resources': len(self.failed_resources)
        }

    def clear_cache(self):
        """Clear downloaded and failed resource caches"""
        self.downloaded_resources.clear()
        self.failed_resources.clear()
        ColorPrint.blue('[ResourceProcessor] Cache cleared')


__all__ = ['ResourceProcessor']
