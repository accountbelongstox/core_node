#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download Plugin

File download functionality using synchronous requests and threading
"""

import os
import threading
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from urllib.parse import urlparse
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin
from pycore.pyutils.pybrowser.interfaces.idownloader import IDownloader

# Get requests via third_party manager
requests = get_third_package_requests()


class HttpDownloader(IDownloader):
    """HTTP-based file downloader (synchronous with threading support)"""

    def __init__(self):
        super().__init__()
        self.session = None
        self._download_threads: Dict[str, threading.Thread] = {}

    def initialize(self, options: Dict[str, Any] = None):
        """
        Initialize HTTP downloader (synchronous)

        Args:
            options: Initialization options
        """
        try:
            options = options or {}
            home_dir = Path.home()
            self.download_path = options.get('path') or str(home_dir / 'Downloads' / 'spider_downloads')

            os.makedirs(self.download_path, exist_ok=True)

            # Create requests session
            self.session = requests.Session()
            self.is_initialized = True

            ColorPrint.info(f"HttpDownloader initialized: {self.download_path}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize HttpDownloader: {error}')
            raise

    def download(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download file from URL (synchronous)

        Args:
            url: File URL
            options: Download options
                - filename: Custom filename
                - timeout: Request timeout (default: 30)
                - async: Run in background thread (default: False)

        Returns:
            Download result dictionary
        """
        try:
            options = options or {}

            # If async download requested, run in thread
            if options.get('async', False):
                return self._download_async(url, options)

            # Synchronous download
            return self._download_sync(url, options)
        except Exception as error:
            ColorPrint.red(f"Failed to download {url}: {error}")
            raise

    def _download_sync(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronous download implementation"""
        filename = options.get('filename') or self.generate_filename(url)
        filepath = os.path.join(self.download_path, filename)
        timeout = options.get('timeout', 30)

        response = self.session.get(url, timeout=timeout, stream=True)
        response.raise_for_status()

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        file_size = os.path.getsize(filepath)

        return {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'size': file_size
        }

    def _download_async(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Start download in background thread"""
        download_id = f"download_{datetime.now().timestamp()}"

        def _download_worker():
            try:
                result = self._download_sync(url, options)
                self.active_downloads[download_id] = {
                    'status': 'completed',
                    'result': result
                }
            except Exception as error:
                self.active_downloads[download_id] = {
                    'status': 'failed',
                    'error': str(error)
                }

        thread = threading.Thread(target=_download_worker, daemon=True)
        self._download_threads[download_id] = thread
        self.active_downloads[download_id] = {'status': 'downloading'}
        thread.start()

        return {
            'download_id': download_id,
            'status': 'started'
        }

    def download_image(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download image file (synchronous)"""
        options = options or {}
        options['type'] = 'image'
        return self.download(url, options)

    def download_audio(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download audio file (synchronous)"""
        options = options or {}
        options['type'] = 'audio'
        return self.download(url, options)

    def download_video(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download video file (synchronous)"""
        options = options or {}
        options['type'] = 'video'
        return self.download(url, options)

    def generate_filename(self, url: str) -> str:
        """
        Generate filename from URL

        Args:
            url: File URL

        Returns:
            Generated filename
        """
        parsed = urlparse(url)
        pathname = parsed.path
        ext = Path(pathname).suffix or '.html'
        basename = Path(pathname).stem or 'download'
        timestamp = int(datetime.now().timestamp() * 1000)

        return f"{basename}_{timestamp}{ext}"

    def get_download_status(self, download_id: str) -> Optional[Dict[str, Any]]:
        """Get download status (synchronous)"""
        return self.active_downloads.get(download_id)

    def cancel_download(self, download_id: str):
        """Cancel download (synchronous)"""
        if download_id in self.active_downloads:
            # Note: Can't actually stop thread, but can mark as cancelled
            self.active_downloads[download_id] = {'status': 'cancelled'}

    def cleanup(self):
        """Cleanup downloader (synchronous)"""
        if self.session:
            self.session.close()

        # Wait for all download threads to complete
        for thread in self._download_threads.values():
            if thread.is_alive():
                thread.join(timeout=5)

        self._download_threads.clear()
        self.active_downloads.clear()
        self.is_initialized = False


class DownloadPlugin(IPlugin):
    """Plugin for file download functionality (synchronous)"""

    def __init__(self):
        super().__init__()
        self.name = 'download'
        self.version = '1.0.0'
        self.downloader = None

    def initialize(self, session: Any):
        """
        Initialize plugin with session (synchronous)

        Args:
            session: Session instance
        """
        try:
            self.session = session
            self.downloader = HttpDownloader()
            self.downloader.initialize()

            self.is_initialized = True
            ColorPrint.info(f"DownloadPlugin initialized for session: {session.id}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize DownloadPlugin: {error}')
            raise

    def cleanup(self):
        """Cleanup plugin resources (synchronous)"""
        try:
            if self.downloader:
                self.downloader.cleanup()
            self.is_initialized = False
            ColorPrint.info('DownloadPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup DownloadPlugin: {error}')

    def download_file(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download file (synchronous)"""
        return self.downloader.download(url, options or {})

    def download_image(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download image (synchronous)"""
        return self.downloader.download_image(url, options or {})

    def download_audio(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download audio (synchronous)"""
        return self.downloader.download_audio(url, options or {})

    def download_video(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download video (synchronous)"""
        return self.downloader.download_video(url, options or {})
