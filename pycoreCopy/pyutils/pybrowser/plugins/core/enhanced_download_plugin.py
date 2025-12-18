#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedDownloadPlugin

Advanced download plugin with file monitoring and link detection (synchronous)
"""

import os
import re
import time
from typing import Dict, Any, List, Optional
from pathlib import Path
from urllib.parse import urlparse

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.pybrowser.interfaces import IPlugin

# Get requests via third_party manager
requests = get_third_package_requests()


class FileMonitor:
    """File monitor for tracking download completion (synchronous)"""

    def __init__(self, download_path: str):
        self.download_path = download_path
        self.min_file_size = 1024

    def wait_for_file(self, pattern: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Wait for file matching pattern to appear and stabilize (synchronous)

        Args:
            pattern: Regex pattern to match filenames
            options: Wait options
                - timeout: Maximum wait time in milliseconds (default: 300000)
                - pollInterval: Polling interval in milliseconds (default: 2000)
                - stableTime: Time file must remain same size (default: 3000)
                - onProgress: Progress callback function

        Returns:
            File information dictionary
        """
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

    def find_files_by_pattern(self, pattern: str) -> List[Dict[str, Any]]:
        """Find files matching pattern in download directory"""
        matched_files = []
        regex = re.compile(pattern)

        if not os.path.exists(self.download_path):
            return matched_files

        files = os.listdir(self.download_path)

        for file_name in files:
            # Skip duplicate downloads (Chrome naming convention)
            if re.search(r'\(\d+\)', file_name):
                continue

            if regex.search(file_name):
                file_path = os.path.join(self.download_path, file_name)
                stats = os.stat(file_path)

                if stats.st_size >= self.min_file_size:
                    matched_files.append({
                        'path': file_path,
                        'name': file_name,
                        'size': stats.st_size,
                        'modified': stats.st_mtime,
                        'directory': self.download_path
                    })

        return sorted(matched_files, key=lambda x: x['modified'], reverse=True)


class EnhancedDownloadPlugin(IPlugin):
    """Enhanced download plugin with file monitoring (synchronous)"""

    def __init__(self):
        super().__init__()
        self.name = 'EnhancedDownloadPlugin'
        self.version = '2.0.0'
        self.session = None  # Session instance
        self.download_path = None
        self.file_monitor = None
        self.active_downloads = {}
        self.download_metrics = {
            'totalDownloads': 0,
            'successfulDownloads': 0,
            'failedDownloads': 0,
            'buttonClicks': 0,
            'fileDetections': 0
        }

    def initialize(self, session: Any):
        """
        Initialize plugin (synchronous)

        Args:
            session: Session instance
        """
        self.session = session
        self.download_path = str(Path.home() / 'Downloads' / 'spider_downloads')

        os.makedirs(self.download_path, exist_ok=True)

        self.file_monitor = FileMonitor(self.download_path)

        self.is_initialized = True
        ColorPrint.green(f'EnhancedDownloadPlugin initialized: {self.download_path}')

    def cleanup(self):
        """Cleanup plugin (synchronous)"""
        self.active_downloads.clear()
        self.is_initialized = False
        ColorPrint.green('EnhancedDownloadPlugin cleaned up')

    def download_file(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download file from URL (synchronous)

        Args:
            url: File URL
            options: Download options

        Returns:
            Download result dictionary
        """
        options = options or {}
        filename = options.get('filename') or self.generate_filename(url)
        filepath = os.path.join(self.download_path, filename)

        ColorPrint.green(f'Starting download: {url} -> {filepath}')

        timeout = options.get('timeout', 300000) / 1000  # Convert to seconds

        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        self.download_metrics['totalDownloads'] += 1
        self.download_metrics['successfulDownloads'] += 1
        ColorPrint.green(f'Download completed: {filepath}')

        return {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'size': os.path.getsize(filepath)
        }

    def click_download_and_wait(self, selector: str, file_pattern: str,
                                 options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Click download button and wait for file (synchronous)

        Args:
            selector: CSS selector for download button
            file_pattern: Regex pattern to match downloaded file
            options: Wait options

        Returns:
            Download result dictionary
        """
        options = options or {}
        page = self.session.get_page()
        if not page:
            return {
                'success': False,
                'error': 'No page available for download',
                'message': 'Download failed'
            }

        page.click(selector)
        ColorPrint.green(f'Clicked download link: {selector}')
        self.download_metrics['buttonClicks'] += 1

        downloaded_file = self.wait_for_file_by_pattern(file_pattern, options)
        self.download_metrics['fileDetections'] += 1

        return {
            'success': True,
            'file': downloaded_file,
            'message': 'Download completed successfully'
        }

    def find_and_click_download_link(self, keywords: List[str], file_pattern: str,
                                      options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Find and click download link by keywords (synchronous)

        Args:
            keywords: List of keywords to search for
            file_pattern: Regex pattern to match downloaded file
            options: Wait options

        Returns:
            Download result dictionary
        """
        options = options or {}
        page = self.session.get_page()
        if not page:
            return {
                'success': False,
                'error': 'No page available for download',
                'message': 'Failed to find or click download link'
            }

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

        download_links = page.evaluate(script, keywords)

        if len(download_links) == 0:
            return {
                'success': False,
                'error': f'No download links found with keywords: {", ".join(keywords)}',
                'message': 'Failed to find or click download link'
            }

        ColorPrint.green(f'Found {len(download_links)} potential download links')

        target_link = download_links[0]
        ColorPrint.green(f'Clicking download link: {target_link["text"]}')

        return self.click_download_and_wait(f'a[href="{target_link["href"]}"]', file_pattern, options)

    def wait_for_file_by_pattern(self, pattern: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Wait for file matching pattern (synchronous)

        Args:
            pattern: Regex pattern
            options: Wait options

        Returns:
            File information dictionary
        """
        default_options = {
            'timeout': 300000,
            'pollInterval': 2000,
            'stableTime': 3000,
            'onProgress': lambda elapsed, total: ColorPrint.green(
                f'Waiting for download... {round(elapsed/1000)}s / {round(total/1000)}s'
            ) if elapsed % 30000 == 0 else None
        }

        merged_options = {**default_options, **(options or {})}
        return self.file_monitor.wait_for_file(pattern, merged_options)

    def generate_filename(self, url: str) -> str:
        """Generate filename from URL"""
        parsed = urlparse(url)
        pathname = parsed.path
        ext = os.path.splitext(pathname)[1] or '.html'
        basename = os.path.splitext(os.path.basename(pathname))[0] or 'download'
        timestamp = int(time.time() * 1000)

        return f'{basename}_{timestamp}{ext}'

    def get_download_metrics(self) -> Dict[str, Any]:
        """Get download metrics"""
        success_rate = 0
        if self.download_metrics['totalDownloads'] > 0:
            success_rate = (self.download_metrics['successfulDownloads'] /
                            self.download_metrics['totalDownloads']) * 100

        return {
            **self.download_metrics,
            'successRate': success_rate
        }
