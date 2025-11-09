#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download Plugin

File download functionality
"""

import os
import asyncio
import aiohttp
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from urllib.parse import urlparse
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin
from pycore.pyutils.pybrowser.interfaces.idownloader import IDownloader


class HttpDownloader(IDownloader):
    """HTTP-based file downloader"""

    def __init__(self):
        super().__init__()
        self.session = None

    async def initialize(self, options: Dict[str, Any] = None):
        """
        Initialize HTTP downloader

        Args:
            options: Initialization options
        """
        try:
            options = options or {}
            home_dir = Path.home()
            self.download_path = options.get('path') or str(home_dir / 'Downloads' / 'spider_downloads')

            os.makedirs(self.download_path, exist_ok=True)

            self.session = aiohttp.ClientSession()
            self.is_initialized = True

            ColorPrint.info(f"HttpDownloader initialized: {self.download_path}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize HttpDownloader: {error}')
            raise

    async def download(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download file from URL

        Args:
            url: File URL
            options: Download options

        Returns:
            Download result dictionary
        """
        try:
            options = options or {}
            filename = options.get('filename') or self.generate_filename(url)
            filepath = os.path.join(self.download_path, filename)

            timeout = aiohttp.ClientTimeout(total=options.get('timeout', 30))

            async with self.session.get(url, timeout=timeout) as response:
                response.raise_for_status()

                with open(filepath, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)

            file_size = os.path.getsize(filepath)

            return {
                'success': True,
                'filepath': filepath,
                'filename': filename,
                'size': file_size
            }
        except Exception as error:
            ColorPrint.red(f"Failed to download {url}: {error}")
            raise

    async def download_image(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download image file"""
        options = options or {}
        options['type'] = 'image'
        return await self.download(url, options)

    async def download_audio(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download audio file"""
        options = options or {}
        options['type'] = 'audio'
        return await self.download(url, options)

    async def download_video(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download video file"""
        options = options or {}
        options['type'] = 'video'
        return await self.download(url, options)

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

    async def get_download_status(self, download_id: str) -> Dict[str, Any]:
        """Get download status"""
        return self.active_downloads.get(download_id)

    async def cancel_download(self, download_id: str):
        """Cancel download"""
        if download_id in self.active_downloads:
            del self.active_downloads[download_id]

    async def cleanup(self):
        """Cleanup downloader"""
        if self.session:
            await self.session.close()
        self.active_downloads.clear()
        self.is_initialized = False


class DownloadPlugin(IPlugin):
    """Plugin for file download functionality"""

    def __init__(self):
        super().__init__()
        self.name = 'download'
        self.version = '1.0.0'
        self.downloader = None

    async def initialize(self, session: Any):
        """
        Initialize plugin with session

        Args:
            session: Session instance
        """
        try:
            self.session = session
            self.downloader = HttpDownloader()
            await self.downloader.initialize()

            self.is_initialized = True
            ColorPrint.info(f"DownloadPlugin initialized for session: {session.id}")
        except Exception as error:
            ColorPrint.red(f'Failed to initialize DownloadPlugin: {error}')
            raise

    async def cleanup(self):
        """Cleanup plugin resources"""
        try:
            if self.downloader:
                await self.downloader.cleanup()
            self.is_initialized = False
            ColorPrint.info('DownloadPlugin cleaned up')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup DownloadPlugin: {error}')

    async def download_file(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download file"""
        return await self.downloader.download(url, options or {})

    async def download_image(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download image"""
        return await self.downloader.download_image(url, options or {})

    async def download_audio(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download audio"""
        return await self.downloader.download_audio(url, options or {})

    async def download_video(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Download video"""
        return await self.downloader.download_video(url, options or {})
