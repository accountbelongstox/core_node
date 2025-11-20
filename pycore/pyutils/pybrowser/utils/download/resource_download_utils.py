#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Download Utilities

Advanced resource download capabilities with injected button download and proxy support
"""

import os
import re
import time
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
from pycore.pyutils.pybrowser.utils.logger import Logger

logger = Logger({'prefix': 'ResourceDownloadUtils'})


class ResourceDownloadUtils:
    """
    Advanced resource download utilities

    Provides download capabilities via:
    - Injected download buttons
    - Batch downloads with concurrency
    - File monitoring and stability detection
    - Proxy server integration
    """

    def __init__(self, page: Any, options: Dict[str, Any] = None):
        options = options or {}
        self.page = page
        self.download_path = options.get('downloadPath', str(Path.home() / 'Downloads' / 'spider_downloads'))
        self.min_file_size = options.get('minFileSize', 100)
        self.download_timeout = options.get('downloadTimeout', 60000)
        self.poll_interval = options.get('pollInterval', 500)
        self.stable_time = options.get('stableTime', 2000)
        self.proxy_server = options.get('proxyServer', None)
        self.use_proxy = options.get('useProxy', True)

        self.ensure_download_directory()

    def ensure_download_directory(self):
        """Create download directory if it doesn't exist"""
        if not os.path.exists(self.download_path):
            os.makedirs(self.download_path, exist_ok=True)
            logger.info(f'Created download directory: {self.download_path}')

    async def download_resource_via_injected_button(self, resource_url: str, target_path: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download resource by injecting download link and clicking it

        Args:
            resource_url: URL of resource to download
            target_path: Target file path
            options: Download options (fileName, timeout)

        Returns:
            Download result with success status and metadata
        """
        options = options or {}
        file_name = options.get('fileName') or self.generate_file_name(resource_url)
        expected_pattern = self.escape_regex(file_name)
        start_time = time.time()

        try:
            logger.debug(f'Downloading resource: {resource_url}')
            logger.debug(f'Expected file name: {file_name}')
            logger.debug(f'Target path: {target_path}')

            button_id = f"spider_download_{int(time.time() * 1000)}_{os.urandom(4).hex()}"

            # Inject download link
            await self.page.execute_script(f'''
                (function(url, id) {{
                    const link = document.createElement('a');
                    link.id = id;
                    link.href = url;
                    link.download = '';
                    link.style.display = 'none';
                    link.target = '_blank';
                    document.body.appendChild(link);
                }})(arguments[0], arguments[1]);
            ''', resource_url, button_id)

            logger.debug(f'Injected download button with id: {button_id}')

            # Click download link
            await self.page.execute_script(f'''
                (function(id) {{
                    const link = document.getElementById(id);
                    if (link) {{
                        link.click();
                    }}
                }})(arguments[0]);
            ''', button_id)

            logger.debug('Clicked download button')

            # Wait for download to complete
            downloaded_file = await self.wait_for_download_complete(expected_pattern, {
                'timeout': options.get('timeout', self.download_timeout),
                'pollInterval': self.poll_interval,
                'stableTime': self.stable_time
            })

            logger.debug(f"Download completed: {downloaded_file['path']}")

            # Move to target path
            if target_path:
                target_dir = os.path.dirname(target_path)
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)

                import shutil
                shutil.copy2(downloaded_file['path'], target_path)
                logger.debug(f'Copied file to: {target_path}')

                try:
                    os.unlink(downloaded_file['path'])
                    logger.debug(f"Cleaned up temporary file: {downloaded_file['path']}")
                except Exception as cleanup_error:
                    logger.warn(f'Failed to cleanup temporary file: {cleanup_error}')

            # Remove injected link
            await self.page.execute_script(f'''
                (function(id) {{
                    const link = document.getElementById(id);
                    if (link) {{
                        link.remove();
                    }}
                }})(arguments[0]);
            ''', button_id)

            duration = int((time.time() - start_time) * 1000)
            logger.info(f'Resource downloaded successfully in {duration}ms: {resource_url} -> {target_path}')

            return {
                'success': True,
                'sourcePath': downloaded_file['path'],
                'targetPath': target_path,
                'fileName': file_name,
                'size': downloaded_file['size'],
                'duration': duration
            }
        except Exception as error:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f'Failed to download resource after {duration}ms: {resource_url}', error)
            return {
                'success': False,
                'error': str(error),
                'duration': duration
            }

    async def download_resource_batch(self, resources: List[Dict[str, Any]], target_dir: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download multiple resources in batch with concurrency control

        Args:
            resources: List of resource definitions (url, targetFileName)
            target_dir: Target directory for downloads
            options: Batch options (concurrency, delay, timeout)

        Returns:
            Batch download results
        """
        options = options or {}
        concurrency = options.get('concurrency', 1)
        delay = options.get('delay', 1000) / 1000

        logger.info(f'Starting batch download of {len(resources)} resources with concurrency: {concurrency}')

        results = []
        for i in range(0, len(resources), concurrency):
            batch = resources[i:i + concurrency]
            batch_tasks = []

            for resource in batch:
                target_path = os.path.join(target_dir, resource.get('targetFileName') or self.generate_file_name(resource['url']))
                task = self.download_resource_via_injected_button(resource['url'], target_path, {
                    'fileName': resource.get('targetFileName'),
                    'timeout': options.get('timeout')
                })
                batch_tasks.append(task)

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    results.append({
                        'url': batch[j]['url'],
                        'targetPath': os.path.join(target_dir, batch[j].get('targetFileName') or self.generate_file_name(batch[j]['url'])),
                        'success': False,
                        'error': str(result)
                    })
                else:
                    results.append({
                        'url': batch[j]['url'],
                        'targetPath': result.get('targetPath'),
                        **result
                    })

            if i + concurrency < len(resources) and delay > 0:
                await asyncio.sleep(delay)

        success_count = sum(1 for r in results if r.get('success'))
        failed_count = len(results) - success_count

        logger.info(f'Batch download completed: {success_count} succeeded, {failed_count} failed')

        return {
            'total': len(results),
            'succeeded': success_count,
            'failed': failed_count,
            'results': results
        }

    async def wait_for_download_complete(self, file_pattern: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Wait for download to complete by monitoring file size stability

        Args:
            file_pattern: File name pattern to match
            options: Wait options (timeout, pollInterval, stableTime)

        Returns:
            Downloaded file information
        """
        options = options or {}
        start_time = time.time()
        timeout = options.get('timeout', self.download_timeout) / 1000
        poll_interval = options.get('pollInterval', self.poll_interval) / 1000
        stable_time = options.get('stableTime', self.stable_time) / 1000

        last_file_size = 0
        stable_start_time = None
        last_found_file = None

        while time.time() - start_time < timeout:
            try:
                files = self.find_files_by_pattern(file_pattern)

                if files:
                    latest_file = files[0]
                    last_found_file = latest_file

                    if latest_file['size'] < self.min_file_size:
                        await asyncio.sleep(poll_interval)
                        continue

                    current_size = latest_file['size']

                    if current_size == last_file_size and current_size >= self.min_file_size:
                        if stable_start_time is None:
                            stable_start_time = time.time()
                        elif time.time() - stable_start_time >= stable_time:
                            logger.debug(f"File download stable: {latest_file['path']} ({current_size} bytes)")
                            return latest_file
                    else:
                        stable_start_time = None
                        last_file_size = current_size
                        logger.debug(f"File downloading: {latest_file['name']} ({current_size} bytes)")

                await asyncio.sleep(poll_interval)
            except Exception as error:
                logger.warn(f'Error monitoring download: {error}')
                await asyncio.sleep(poll_interval)

        if last_found_file:
            logger.warn(f"Download timeout but file exists: {last_found_file['path']} ({last_found_file['size']} bytes)")
            return last_found_file

        raise TimeoutError(f'Timeout waiting for download: {file_pattern}')

    def find_files_by_pattern(self, pattern: str) -> List[Dict[str, Any]]:
        """
        Find files matching pattern in download directory

        Args:
            pattern: Regex pattern to match file names

        Returns:
            List of matched files sorted by modification time
        """
        matched_files = []
        regex = re.compile(pattern, re.IGNORECASE)

        try:
            if not os.path.exists(self.download_path):
                return matched_files

            for file_name in os.listdir(self.download_path):
                # Skip temporary/duplicate files
                if re.search(r'\(\d+\)', file_name) or file_name.endswith('.crdownload') or file_name.endswith('.tmp'):
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
        except Exception as error:
            logger.error(f'Cannot read directory {self.download_path}: {error}')

        return sorted(matched_files, key=lambda x: x['modified'], reverse=True)

    def generate_file_name(self, url: str) -> str:
        """
        Generate file name from URL

        Args:
            url: Resource URL

        Returns:
            Generated file name
        """
        try:
            parsed = urlparse(url)
            path = parsed.path
            file_name = os.path.basename(path)

            if not file_name or file_name == '/':
                file_name = 'index.html'

            ext = os.path.splitext(file_name)[1]
            if not ext:
                file_name += '.html'

            return file_name
        except Exception as error:
            logger.warn(f'Failed to generate filename from URL: {url}', error)
            return f'download_{int(time.time() * 1000)}.html'

    def escape_regex(self, string: str) -> str:
        """Escape special regex characters"""
        return re.escape(string)

    def set_download_path(self, new_path: str):
        """Set new download directory"""
        self.download_path = new_path
        self.ensure_download_directory()

    def get_download_path(self) -> str:
        """Get current download directory"""
        return self.download_path

    def cleanup_download_directory(self):
        """Cleanup old files from download directory"""
        try:
            if os.path.exists(self.download_path):
                files = os.listdir(self.download_path)
                cleaned_count = 0

                for file_name in files:
                    file_path = os.path.join(self.download_path, file_name)
                    stats = os.stat(file_path)
                    age = time.time() - stats.st_mtime

                    if age > 3600:  # 1 hour
                        os.unlink(file_path)
                        cleaned_count += 1

                if cleaned_count > 0:
                    logger.info(f'Cleaned up {cleaned_count} old files from download directory')
        except Exception as error:
            logger.warn(f'Failed to cleanup download directory: {error}')

    def set_proxy_server(self, proxy_server: Any):
        """Set proxy server for downloads"""
        self.proxy_server = proxy_server
        logger.info('Proxy server set for resource downloads')
