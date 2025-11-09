#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Downloader Interface

Defines the contract for downloader implementations
"""

from typing import Dict, Any, Optional


class IDownloader:
    """Downloader interface for file download functionality"""

    def __init__(self):
        self.is_initialized = False
        self.download_path = None
        self.active_downloads: Dict[str, Any] = {}

    async def initialize(self, options: Dict[str, Any] = None):
        """
        Initialize downloader

        Args:
            options: Initialization options
        """
        raise NotImplementedError('IDownloader.initialize() must be implemented by subclass')

    async def download(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download file from URL

        Args:
            url: File URL
            options: Download options

        Returns:
            Download result dictionary
        """
        raise NotImplementedError('IDownloader.download() must be implemented by subclass')

    async def download_image(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download image file

        Args:
            url: Image URL
            options: Download options

        Returns:
            Download result dictionary
        """
        raise NotImplementedError('IDownloader.download_image() must be implemented by subclass')

    async def download_audio(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download audio file

        Args:
            url: Audio URL
            options: Download options

        Returns:
            Download result dictionary
        """
        raise NotImplementedError('IDownloader.download_audio() must be implemented by subclass')

    async def download_video(self, url: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Download video file

        Args:
            url: Video URL
            options: Download options

        Returns:
            Download result dictionary
        """
        raise NotImplementedError('IDownloader.download_video() must be implemented by subclass')

    async def get_download_status(self, download_id: str) -> Optional[Dict[str, Any]]:
        """
        Get download status

        Args:
            download_id: Download identifier

        Returns:
            Status dictionary or None
        """
        raise NotImplementedError('IDownloader.get_download_status() must be implemented by subclass')

    async def cancel_download(self, download_id: str):
        """
        Cancel active download

        Args:
            download_id: Download identifier
        """
        raise NotImplementedError('IDownloader.cancel_download() must be implemented by subclass')

    async def cleanup(self):
        """Cleanup downloader resources"""
        raise NotImplementedError('IDownloader.cleanup() must be implemented by subclass')

    def get_info(self) -> Dict[str, Any]:
        """
        Get downloader information

        Returns:
            Dictionary with downloader info
        """
        return {
            'is_initialized': self.is_initialized,
            'download_path': self.download_path,
            'active_downloads': len(self.active_downloads)
        }
