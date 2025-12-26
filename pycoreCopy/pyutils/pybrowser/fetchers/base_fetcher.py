#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BaseFetcher

Base class for all fetchers providing unified interface and result format
"""

from typing import Dict, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint


class FetchResult:
    """Unified fetch result format"""

    def __init__(self, success: bool = False):
        self.success = success
        self.url = None
        self.content = None
        self.content_type = "text/html"
        self.status = None
        self.error = None
        self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'success': self.success,
            'url': self.url,
            'content': self.content,
            'contentType': self.content_type,
            'status': self.status,
            'error': self.error,
            'metadata': self.metadata
        }


class BaseFetcher:
    """
    Base class for all fetchers

    All fetchers must inherit from this class and implement:
    - initialize()
    - fetch()
    - cleanup()
    """

    def __init__(self):
        self.is_initialized = False
        self.fetcher_name = "BaseFetcher"

    def initialize(self, options: Dict[str, Any] = None) -> bool:
        """
        Initialize fetcher (synchronous)

        Args:
            options: Initialization options

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.red(f'{self.fetcher_name}.initialize() must be implemented by subclass')
        return False

    def fetch(self, url: str, options: Dict[str, Any] = None) -> FetchResult:
        """
        Fetch content from URL (synchronous)

        Args:
            url: URL to fetch
            options: Fetch options

        Returns:
            FetchResult object
        """
        result = FetchResult(success=False)
        result.error = f'{self.fetcher_name}.fetch() must be implemented by subclass'
        ColorPrint.red(result.error)
        return result

    def cleanup(self) -> bool:
        """
        Cleanup fetcher resources (synchronous)

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.green(f'{self.fetcher_name} cleanup completed')
        return True

    def get_info(self) -> Dict[str, Any]:
        """
        Get fetcher information

        Returns:
            Fetcher information dictionary
        """
        return {
            'name': self.fetcher_name,
            'isInitialized': self.is_initialized
        }
