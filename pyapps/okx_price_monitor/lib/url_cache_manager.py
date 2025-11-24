#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX URL Cache Manager

Manages intercepted URLs from pages and provides timestamp replacement functionality.
"""

import time
import re
from typing import Dict, List, Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from pycore.pyfoundations.color_print import ColorPrint


class URLCacheManager:
    """
    URL Cache Manager for OKX API URLs

    Caches intercepted URLs from browser pages and provides:
    - URL storage by page
    - Timestamp replacement
    - URL filtering and pattern matching
    """

    def __init__(self):
        self.url_cache = {}  # page_num -> List[url_info]
        self.cache_timestamp = {}  # page_num -> timestamp

    def add_urls_from_page(self, page_num: int, urls: List[str], url_prefix: str = None):
        """
        Add URLs intercepted from a specific page

        Args:
            page_num (int): Page number (1-based)
            urls (List[str]): List of intercepted URLs
            url_prefix (str): Optional prefix filter

        Returns:
            int: Number of URLs added
        """
        if url_prefix:
            filtered_urls = [url for url in urls if url.startswith(url_prefix)]
        else:
            filtered_urls = urls

        if not filtered_urls:
            return 0

        # Parse and store URL info
        url_infos = []
        for url in filtered_urls:
            url_info = self._parse_url(url)
            if url_info:
                url_infos.append(url_info)

        self.url_cache[page_num] = url_infos
        self.cache_timestamp[page_num] = time.time()

        ColorPrint.green(f"[URLCacheManager] Cached {len(url_infos)} URLs for page {page_num}")
        return len(url_infos)

    def _parse_url(self, url: str) -> Optional[Dict]:
        """
        Parse URL and extract components

        Args:
            url (str): Full URL

        Returns:
            dict: URL components
        """
        try:
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)

            # Extract timestamp parameter
            timestamp = query_params.get('t', [None])[0]

            return {
                'original_url': url,
                'base_url': f"{parsed.scheme}://{parsed.netloc}{parsed.path}",
                'query_params': query_params,
                'timestamp': timestamp,
                'scheme': parsed.scheme,
                'netloc': parsed.netloc,
                'path': parsed.path
            }
        except Exception as e:
            ColorPrint.red(f"[URLCacheManager] Failed to parse URL {url}: {e}")
            return None

    def get_url_with_new_timestamp(self, page_num: int, index: int = 0, new_timestamp: int = None) -> Optional[str]:
        """
        Get URL from cache with replaced timestamp

        Args:
            page_num (int): Page number
            index (int): URL index in page cache
            new_timestamp (int): New timestamp (milliseconds), None = current time

        Returns:
            str: URL with new timestamp, or None if not found
        """
        if page_num not in self.url_cache:
            return None

        urls = self.url_cache[page_num]
        if index >= len(urls):
            return None

        url_info = urls[index]

        # Use current timestamp if not provided
        if new_timestamp is None:
            new_timestamp = int(time.time() * 1000)

        # Update query params
        query_params = url_info['query_params'].copy()
        query_params['t'] = [str(new_timestamp)]

        # Rebuild URL
        parsed = urlparse(url_info['original_url'])
        new_query = urlencode(query_params, doseq=True)
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))

        return new_url

    def get_all_urls_with_new_timestamp(self, page_num: int, new_timestamp: int = None) -> List[str]:
        """
        Get all URLs from a page with replaced timestamp

        Args:
            page_num (int): Page number
            new_timestamp (int): New timestamp (milliseconds), None = current time

        Returns:
            List[str]: List of URLs with new timestamp
        """
        if page_num not in self.url_cache:
            return []

        urls = self.url_cache[page_num]

        # Use current timestamp if not provided
        if new_timestamp is None:
            new_timestamp = int(time.time() * 1000)

        result = []
        for i in range(len(urls)):
            url = self.get_url_with_new_timestamp(page_num, i, new_timestamp)
            if url:
                result.append(url)

        return result

    def get_cached_pages(self) -> List[int]:
        """
        Get list of cached page numbers

        Returns:
            List[int]: Sorted list of page numbers
        """
        return sorted(self.url_cache.keys())

    def get_page_url_count(self, page_num: int) -> int:
        """
        Get number of cached URLs for a page

        Args:
            page_num (int): Page number

        Returns:
            int: Number of URLs
        """
        if page_num not in self.url_cache:
            return 0
        return len(self.url_cache[page_num])

    def clear_page(self, page_num: int):
        """
        Clear cached URLs for a page

        Args:
            page_num (int): Page number
        """
        if page_num in self.url_cache:
            del self.url_cache[page_num]
            del self.cache_timestamp[page_num]
            ColorPrint.blue(f"[URLCacheManager] Cleared cache for page {page_num}")

    def clear_all(self):
        """
        Clear all cached URLs
        """
        self.url_cache.clear()
        self.cache_timestamp.clear()
        ColorPrint.blue("[URLCacheManager] Cleared all URL cache")

    def get_stats(self) -> Dict:
        """
        Get cache statistics

        Returns:
            dict: Statistics
        """
        total_urls = sum(len(urls) for urls in self.url_cache.values())
        return {
            'total_pages': len(self.url_cache),
            'total_urls': total_urls,
            'pages': {page_num: len(urls) for page_num, urls in self.url_cache.items()}
        }

    def print_stats(self):
        """
        Print cache statistics
        """
        stats = self.get_stats()
        ColorPrint.green("\n=== URL Cache Statistics ===")
        ColorPrint.blue(f"Total pages cached: {stats['total_pages']}")
        ColorPrint.blue(f"Total URLs cached: {stats['total_urls']}")
        if stats['pages']:
            ColorPrint.blue("\nURLs per page:")
            for page_num, count in sorted(stats['pages'].items()):
                ColorPrint.yellow(f"  Page {page_num}: {count} URLs")
        ColorPrint.green("===========================\n")
