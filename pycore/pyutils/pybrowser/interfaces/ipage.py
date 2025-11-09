#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Page Interface

Defines the contract for page implementations
"""

from typing import Dict, List, Optional, Any, Callable


class IPage:
    """Page interface for different page implementations"""

    def __init__(self):
        self.driver = None
        self.is_initialized = False
        self.url = None
        self.title = None

    async def goto(self, url: str, options: Dict[str, Any] = None) -> Any:
        """
        Navigate to URL

        Args:
            url: Target URL
            options: Navigation options

        Returns:
            Response or status
        """
        raise NotImplementedError('IPage.goto() must be implemented by subclass')

    async def click(self, selector: str, options: Dict[str, Any] = None):
        """
        Click an element

        Args:
            selector: Element selector
            options: Click options
        """
        raise NotImplementedError('IPage.click() must be implemented by subclass')

    async def type(self, selector: str, text: str, options: Dict[str, Any] = None):
        """
        Type text into an element

        Args:
            selector: Element selector
            text: Text to type
            options: Type options
        """
        raise NotImplementedError('IPage.type() must be implemented by subclass')

    async def screenshot(self, options: Dict[str, Any] = None) -> bytes:
        """
        Take screenshot

        Args:
            options: Screenshot options

        Returns:
            Screenshot bytes
        """
        raise NotImplementedError('IPage.screenshot() must be implemented by subclass')

    async def evaluate(self, script: str, *args) -> Any:
        """
        Execute JavaScript

        Args:
            script: JavaScript code
            *args: Arguments to pass to script

        Returns:
            Script result
        """
        raise NotImplementedError('IPage.evaluate() must be implemented by subclass')

    async def wait_for_selector(self, selector: str, options: Dict[str, Any] = None):
        """
        Wait for element to appear

        Args:
            selector: Element selector
            options: Wait options
        """
        raise NotImplementedError('IPage.wait_for_selector() must be implemented by subclass')

    async def wait_for_function(self, func: Callable, options: Dict[str, Any] = None):
        """
        Wait for function to return truthy value

        Args:
            func: Function to evaluate
            options: Wait options
        """
        raise NotImplementedError('IPage.wait_for_function() must be implemented by subclass')

    async def get_content(self) -> str:
        """
        Get page HTML content

        Returns:
            HTML string
        """
        raise NotImplementedError('IPage.get_content() must be implemented by subclass')

    async def get_title(self) -> str:
        """
        Get page title

        Returns:
            Title string
        """
        raise NotImplementedError('IPage.get_title() must be implemented by subclass')

    async def get_url(self) -> str:
        """
        Get current URL

        Returns:
            URL string
        """
        raise NotImplementedError('IPage.get_url() must be implemented by subclass')

    async def close(self):
        """Close the page"""
        raise NotImplementedError('IPage.close() must be implemented by subclass')

    def get_info(self) -> Dict[str, Any]:
        """
        Get page information

        Returns:
            Dictionary with page info
        """
        return {
            'is_initialized': self.is_initialized,
            'url': self.url,
            'title': self.title
        }
