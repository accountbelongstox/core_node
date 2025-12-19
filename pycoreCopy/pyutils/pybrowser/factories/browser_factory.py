#!/usr/bin/env python3
"""
Browser Factory - Thread Mode

Creates threaded browser instances for different browser types.
Each browser instance is a self-contained thread that manages its own WebDriver.
"""

from typing import Dict, Any, Optional
from pycore import ColorPrint
from pycore.pyutils.pybrowser.core.threaded_browser import ThreadedBrowser
from pycore.pyutils.pybrowser.implementations.browsers.chrome_browser import ChromeBrowser
from pycore.pyutils.pybrowser.implementations.browsers.edge_browser import EdgeBrowser
from pycore.pyutils.pybrowser.implementations.browsers.firefox_browser import FirefoxBrowser


class BrowserFactory:
    """
    Factory for creating threaded browser instances

    Usage:
        # Create browser without auto-start
        browser = BrowserFactory.create('chrome', config={'headless': False})
        browser.start()

        # Create and auto-start
        browser = BrowserFactory.create('chrome', auto_start=True)

        # Multiple browsers
        browsers = [
            BrowserFactory.create('chrome', thread_name='Chrome-1', auto_start=True),
            BrowserFactory.create('edge', thread_name='Edge-1', auto_start=True),
            BrowserFactory.create('firefox', thread_name='Firefox-1', auto_start=True)
        ]
    """

    @staticmethod
    def create(
        browser_type: str = 'chrome',
        config: Dict[str, Any] = None,
        thread_name: str = None,
        auto_start: bool = False
    ) -> ThreadedBrowser:
        """
        Create threaded browser instance

        Args:
            browser_type: Browser type ('chrome', 'edge', 'firefox')
            config: Browser configuration dictionary
                Common options:
                - headless: bool (default: False)
                - args: list of browser arguments
                - user_data_dir: Browser profile directory (Chrome/Edge)
                - profile_dir: Firefox profile directory
                - download_dir: Download directory
                - window_size: tuple (width, height)
                - preferences: dict (Firefox only)
            thread_name: Custom thread name (default: auto-generated)
            auto_start: Automatically start thread after creation (default: False)

        Returns:
            ThreadedBrowser instance

        Raises:
            ValueError: If browser type is not supported

        Example:
            # Chrome with custom config
            browser = BrowserFactory.create(
                browser_type='chrome',
                config={
                    'headless': False,
                    'args': ['--start-maximized'],
                    'window_size': (1920, 1080)
                },
                thread_name='MyChrome',
                auto_start=True
            )

            # Wait for browser to be ready
            browser.wait_until_ready()

            # Navigate
            browser.navigate('https://google.com')

            # Cleanup
            browser.stop()
            browser.join()
        """
        ColorPrint.blue(f"Creating threaded browser: {browser_type}")

        browser_type_lower = browser_type.lower()
        browser = None

        if browser_type_lower == 'chrome':
            browser = ChromeBrowser(config=config, thread_name=thread_name)

        elif browser_type_lower == 'edge':
            browser = EdgeBrowser(config=config, thread_name=thread_name)

        elif browser_type_lower == 'firefox':
            browser = FirefoxBrowser(config=config, thread_name=thread_name)

        else:
            raise ValueError(
                f"Unsupported browser type: {browser_type}. "
                f"Supported types: {', '.join(BrowserFactory.get_supported_browsers())}"
            )

        # Auto-start if requested
        if auto_start:
            ColorPrint.blue(f"Auto-starting browser thread: {browser.name}")
            browser.start()

        return browser

    @staticmethod
    def create_multiple(
        browser_configs: list,
        auto_start: bool = False
    ) -> list:
        """
        Create multiple browser instances at once

        Args:
            browser_configs: List of browser configuration dictionaries
                Each dict should contain:
                - browser_type: str (required)
                - config: dict (optional)
                - thread_name: str (optional)
            auto_start: Auto-start all browsers (default: False)

        Returns:
            List of ThreadedBrowser instances

        Example:
            browsers = BrowserFactory.create_multiple([
                {
                    'browser_type': 'chrome',
                    'config': {'headless': False},
                    'thread_name': 'Chrome-1'
                },
                {
                    'browser_type': 'edge',
                    'config': {'headless': True},
                    'thread_name': 'Edge-1'
                },
                {
                    'browser_type': 'firefox',
                    'thread_name': 'Firefox-1'
                }
            ], auto_start=True)

            # All browsers run in parallel threads
            for browser in browsers:
                browser.wait_until_ready()
                browser.navigate('https://google.com')

            # Cleanup all
            for browser in browsers:
                browser.stop()
                browser.join()
        """
        browsers = []

        for browser_config in browser_configs:
            browser_type = browser_config.get('browser_type', 'chrome')
            config = browser_config.get('config')
            thread_name = browser_config.get('thread_name')

            browser = BrowserFactory.create(
                browser_type=browser_type,
                config=config,
                thread_name=thread_name,
                auto_start=auto_start
            )
            browsers.append(browser)

        ColorPrint.green(f"Created {len(browsers)} browser instances")
        return browsers

    @staticmethod
    def get_supported_browsers() -> list:
        """
        Get list of supported browser types

        Returns:
            List of browser names
        """
        return ['chrome', 'edge', 'firefox']

    @staticmethod
    def get_default_config(browser_type: str = 'chrome') -> Dict[str, Any]:
        """
        Get default configuration for browser type

        Args:
            browser_type: Browser type

        Returns:
            Default configuration dictionary

        Example:
            config = BrowserFactory.get_default_config('chrome')
            config['headless'] = True  # Modify as needed
            browser = BrowserFactory.create('chrome', config=config)
        """
        base_config = {
            'headless': False,
            'args': [],
            'download_dir': None,
            'window_size': None
        }

        browser_type_lower = browser_type.lower()

        if browser_type_lower == 'chrome':
            return {
                **base_config,
                'user_data_dir': None
            }
        elif browser_type_lower == 'edge':
            return {
                **base_config,
                'user_data_dir': None
            }
        elif browser_type_lower == 'firefox':
            return {
                **base_config,
                'profile_dir': None,
                'preferences': {}
            }
        else:
            return base_config
