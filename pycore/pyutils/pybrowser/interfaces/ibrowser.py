#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Browser Interface

Defines the contract for browser implementations
"""

from typing import Dict, List, Optional, Any


class IBrowser:
    """Browser interface for different browser implementations"""

    def __init__(self):
        self.driver = None
        self.is_launched = False
        self.version = None
        self.browser_type = None

    async def launch(self, options: Dict[str, Any] = None) -> Any:
        """
        Launch the browser

        Args:
            options: Browser launch options

        Returns:
            Browser driver instance
        """
        raise NotImplementedError('IBrowser.launch() must be implemented by subclass')

    async def close(self):
        """Close the browser"""
        raise NotImplementedError('IBrowser.close() must be implemented by subclass')

    async def new_page(self, options: Dict[str, Any] = None) -> 'IPage':
        """
        Create a new page/tab

        Args:
            options: Page options

        Returns:
            IPage instance
        """
        raise NotImplementedError('IBrowser.new_page() must be implemented by subclass')

    async def get_version(self) -> Optional[str]:
        """
        Get browser version

        Returns:
            Version string or None
        """
        raise NotImplementedError('IBrowser.get_version() must be implemented by subclass')

    async def get_pages(self) -> List['IPage']:
        """
        Get all open pages

        Returns:
            List of IPage instances
        """
        raise NotImplementedError('IBrowser.get_pages() must be implemented by subclass')

    async def is_connected(self) -> bool:
        """
        Check if browser is connected

        Returns:
            True if connected
        """
        raise NotImplementedError('IBrowser.is_connected() must be implemented by subclass')

    def get_info(self) -> Dict[str, Any]:
        """
        Get browser information

        Returns:
            Dictionary with browser info
        """
        return {
            'is_launched': self.is_launched,
            'version': self.version,
            'browser_type': self.browser_type
        }
