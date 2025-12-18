#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedPage Implementation

Advanced page wrapper with resource collection, download handling, and tab management
"""

import os
import re
import time
import hashlib
from typing import Dict, Any, List, Optional
from pathlib import Path
from urllib.parse import urlparse

from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyutils.pybrowser.implementations.pages.standard_page import StandardPage
from pycore.pyutils.pybrowser.utils.download import EnhancedResourceCollector
from pycore.pyutils.pybrowser.utils.tab_utils import TabUtils


class EnhancedPage(StandardPage):
    def __init__(self, driver: Any, browser: Any = None, options: Dict[str, Any] = None):
        super().__init__(driver, options)
        self.browser = browser
        self.active_page = None
        self.pages = []
        self.download_path = options.get('downloadPath', str(Path.home() / 'Downloads')) if options else str(Path.home() / 'Downloads')
        self.url_comparison_strict = options.get('urlComparisonStrict', False) if options else False
        self.enable_resource_collection = options.get('enableResourceCollection', True) if options else True
        self.resource_collector = None
        self.metrics = {
            **self.metrics,
            'blankPageReuses': 0,
            'newPageCreations': 0,
            'tabSwitches': 0,
            'downloads': 0
        }

    async def initialize(self):
        await super().initialize()
        self.setup_download_directory()

        if self.enable_resource_collection:
            await self.setup_resource_collection()

        self.is_initialized = True

    def setup_download_directory(self):
        os.makedirs(self.download_path, exist_ok=True)

        if hasattr(self.driver, 'execute_cdp_cmd'):
            self.driver.execute_cdp_cmd('Page.setDownloadBehavior', {
                'behavior': 'allow',
                'downloadPath': self.download_path
            })

        ColorPrint.debug(f'Download directory set to: {self.download_path}')

    async def setup_resource_collection(self):
        self.resource_collector = EnhancedResourceCollector(self, {
            'resourceTypes': ['image', 'stylesheet', 'font', 'media'],
            'includeFailedRequests': True,
            'computeHash': True
        })

        await self.resource_collector.enable()
        ColorPrint.green('[EnhancedPage] Resource collection enabled for this page')

    async def collect_resources(self, options: Dict[str, Any] = None):
        if not self.resource_collector:
            ColorPrint.yellow('[EnhancedPage] Resource collector not initialized')
            return None

        result = await self.resource_collector.collect_resources(options or {})
        ColorPrint.green(f'[EnhancedPage] Collected {result["stats"]["total"]} resources ({result["stats"]["matched"]} matched)')
        return result

    def get_resource_collector(self):
        return self.resource_collector

    def is_blank_url(self, url: str) -> bool:
        """
        Check if URL is a blank page

        Delegates to TabUtils for consistency.
        """
        return TabUtils.is_blank_url(url)

    def equal_domain(self, url1: str, url2: str) -> bool:
        domain1 = urlparse(url1).netloc
        domain2 = urlparse(url2).netloc
        return bool(domain1) and domain1 == domain2

    def equal_domain_full(self, url1: str, url2: str) -> bool:
        parsed1 = urlparse(url1)
        parsed2 = urlparse(url2)
        return bool(parsed1.netloc) and parsed1.netloc == parsed2.netloc and parsed1.path == parsed2.path

    async def open_url(self, url: str, options: Dict[str, Any] = None):
        options = options or {}
        wait_for_complete = options.get('waitForComplete', True)
        timeout = options.get('timeout', 120000)
        logging = options.get('logging', True)
        exact_match = options.get('exactMatch', self.url_comparison_strict)

        if self.browser:
            existing_page_index = await self.find_normalized_url_index(url, exact_match)
            if existing_page_index != -1:
                await self.switch_to_page_by_index(existing_page_index)
                self.metrics['tabSwitches'] += 1
                ColorPrint.debug(f'Switched to existing tab for URL: {url}')
                return {'success': True, 'action': 'switched', 'pageIndex': existing_page_index}

            blank_page_index = await self.find_blank_page_index()
            if blank_page_index != -1:
                await self.switch_to_page_by_index(blank_page_index)
                self.metrics['blankPageReuses'] += 1
                ColorPrint.green(f'Reusing blank page at index {blank_page_index} for URL: {url}')
            else:
                self.metrics['newPageCreations'] += 1
                ColorPrint.yellow(f'No blank page found, using current page for URL: {url}')

        await self.goto(url, {'waitUntil': 'load' if wait_for_complete else None, 'timeout': timeout})

        return {'success': True, 'action': 'navigated'}

    async def find_blank_page_index(self) -> int:
        """
        Find blank page index

        Delegates to TabUtils for consistency.
        Maintains async signature for backward compatibility.
        """
        if not self.browser:
            return -1

        from pycore.pyutils.pybrowser.utils.tab_utils import TabUtils
        return TabUtils.find_blank_tab(self.driver)

    async def find_normalized_url_index(self, url: str, exact_match: bool = False) -> int:
        """
        Find tab index by normalized URL

        Delegates to TabUtils for consistency.
        Maintains async signature for backward compatibility.

        Args:
            url: Target URL
            exact_match: If True, match domain + path; if False, only domain (default: False)

        Returns:
            Tab index if found, -1 otherwise
        """
        if not self.browser:
            return -1

        from pycore.pyutils.pybrowser.utils.tab_utils import TabUtils
        return TabUtils.find_tab_by_url_domain(self.driver, url, exact_match=exact_match)

    async def switch_to_page_by_index(self, index: int):
        handles = self.driver.window_handles
        if index < 0 or index >= len(handles):
            raise ValueError(f'Invalid page index: {index}. Total pages: {len(handles)}')

        self.driver.switch_to.window(handles[index])
        self.active_page = self.driver
        self.metrics['tabSwitches'] += 1
        ColorPrint.debug(f'Switched to page at index {index}')
        return True

    async def switch_to_page_by_url(self, url: str):
        index = await self.find_normalized_url_index(url)
        if index != -1:
            await self.switch_to_page_by_index(index)
            return True
        return False

    async def get_current_page(self):
        if self.active_page:
            return self.active_page

        if self.browser:
            handles = self.driver.window_handles
            if len(handles) > 0:
                self.active_page = self.driver
                return self.active_page

        raise RuntimeError('No pages available')

    async def get_pages(self):
        if self.browser:
            return self.driver.window_handles
        return []

    async def get_current_url(self, full: bool = False):
        page = await self.get_current_page()
        url = page.current_url

        if not full:
            parsed = urlparse(url)
            url = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'

        return url

    async def has_url(self, target_url: str):
        handles = await self.get_pages()
        for handle in handles:
            self.driver.switch_to.window(handle)
            url = self.driver.current_url
            if self.equal_domain(url, target_url):
                return True
        return False

    async def click_download_and_wait(self, selector: str, file_pattern: str, options: Dict[str, Any] = None):
        await self.click(selector)
        ColorPrint.green(f'Clicked download link: {selector}')
        self.metrics['downloads'] += 1

        downloaded_file = await self.wait_for_file_by_pattern(file_pattern, options or {})

        return {
            'success': True,
            'file': downloaded_file,
            'message': 'Download completed successfully'
        }

    async def find_and_click_download_link(self, keywords: List[str], file_pattern: str, options: Dict[str, Any] = None):
        script = """
        return Array.from(document.querySelectorAll('a')).filter(link => {
            const text = link.textContent.toLowerCase();
            const href = link.href.toLowerCase();
            return arguments[0].some(keyword =>
                text.includes(keyword.toLowerCase()) ||
                href.includes(keyword.toLowerCase())
            );
        }).map(link => ({
            href: link.href,
            text: link.textContent.trim(),
            id: link.id,
            className: link.className
        }));
        """

        download_links = await self.evaluate(script, keywords)

        if len(download_links) == 0:
            return {
                'success': False,
                'error': f'No download links found with keywords: {", ".join(keywords)}',
                'message': 'Failed to find or click download link'
            }

        ColorPrint.green(f'Found {len(download_links)} potential download links')

        target_link = download_links[0]
        ColorPrint.green(f'Clicking download link: {target_link["text"]}')

        return await self.click_download_and_wait(f'a[href="{target_link["href"]}"]', file_pattern, options)

    async def wait_for_file_by_pattern(self, pattern: str, options: Dict[str, Any] = None):
        default_options = {
            'timeout': 300000,
            'pollInterval': 2000,
            'stableTime': 3000,
            'onProgress': lambda elapsed, total: ColorPrint.green(f'Waiting for download... {round(elapsed/1000)}s / {round(total/1000)}s') if elapsed % 30000 == 0 else None
        }

        merged_options = {**default_options, **(options or {})}
        return await self.file_monitor_wait(pattern, merged_options)

    async def file_monitor_wait(self, pattern: str, options: Dict[str, Any]):
        start_time = time.time() * 1000
        timeout = options.get('timeout', 300000)
        poll_interval = options.get('pollInterval', 2000) / 1000
        stable_time = options.get('stableTime', 3000)
        on_progress = options.get('onProgress')

        last_file_size = 0
        stable_start_time = None

        while (time.time() * 1000) - start_time < timeout:
            files = self.find_files_by_pattern(pattern)

            if len(files) > 0:
                latest_file = files[0]
                current_size = latest_file['size']

                if current_size == last_file_size:
                    if stable_start_time is None:
                        stable_start_time = time.time() * 1000
                    elif (time.time() * 1000) - stable_start_time >= stable_time:
                        ColorPrint.green(f'File download completed: {latest_file["path"]}')
                        return latest_file
                else:
                    stable_start_time = None
                    last_file_size = current_size

            if on_progress:
                on_progress((time.time() * 1000) - start_time, timeout)

            time.sleep(poll_interval)

        raise TimeoutError(f'Timeout waiting for file pattern: {pattern}')

    def find_files_by_pattern(self, pattern: str):
        matched_files = []
        regex = re.compile(pattern)

        if not os.path.exists(self.download_path):
            return matched_files

        files = os.listdir(self.download_path)

        for file_name in files:
            if re.search(r'\(\d+\)', file_name):
                continue

            if regex.search(file_name):
                file_path = os.path.join(self.download_path, file_name)
                stats = os.stat(file_path)

                matched_files.append({
                    'path': file_path,
                    'name': file_name,
                    'size': stats.st_size,
                    'modified': stats.st_mtime,
                    'directory': self.download_path
                })

        return sorted(matched_files, key=lambda x: x['modified'], reverse=True)

    def get_info(self):
        return {
            **super().get_info(),
            'downloadPath': self.download_path,
            'urlComparisonStrict': self.url_comparison_strict,
            'metrics': self.metrics
        }
