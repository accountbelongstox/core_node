#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Standard Page Implementation

Selenium-based page wrapper
"""

from typing import Dict, Any, Callable, Optional
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.ipage import IPage


class StandardPage(IPage):
    """Standard page implementation using Selenium WebDriver"""

    def __init__(self, driver: Any, options: Dict[str, Any] = None):
        super().__init__()
        self.driver = driver
        self.options = options or {}
        self.url = None
        self.title = None
        self.is_initialized = False
        self.metrics = {
            'requests': 0,
            'responses': 0,
            'errors': 0,
            'clicks': 0,
            'types': 0,
            'navigations': 0
        }

    def initialize(self):
        """Initialize page"""
        try:
            if self.options.get('user_agent'):
                self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                    'userAgent': self.options['user_agent']
                })

            self.is_initialized = True
            ColorPrint.debug('StandardPage initialized')
        except Exception as error:
            ColorPrint.red(f'Failed to initialize StandardPage: {error}')
            raise

    def goto(self, url: str, options: Dict[str, Any] = None) -> Any:
        """
        Navigate to URL

        Args:
            url: Target URL
            options: Navigation options

        Returns:
            None (Selenium doesn't return response object)
        """
        try:
            timeout = options.get('timeout', 30) if options else 30
            self.driver.set_page_load_timeout(timeout)

            self.driver.get(url)
            self.url = url
            self.metrics['navigations'] += 1

            ColorPrint.debug(f"Navigated to: {url}")
            return None
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Failed to navigate to {url}: {error}")
            raise

    def click(self, selector: str, options: Dict[str, Any] = None):
        """
        Click an element

        Args:
            selector: CSS selector
            options: Click options
        """
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            timeout = options.get('timeout', 30) if options else 30
            element = WebDriverWait(self.driver, timeout).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )

            element.click()
            self.metrics['clicks'] += 1

            ColorPrint.debug(f"Clicked element: {selector}")
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Failed to click element {selector}: {error}")
            raise

    def type(self, selector: str, text: str, options: Dict[str, Any] = None):
        """
        Type text into an element

        Args:
            selector: CSS selector
            text: Text to type
            options: Type options
        """
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            timeout = options.get('timeout', 30) if options else 30
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )

            if options and options.get('clear', True):
                element.clear()

            element.send_keys(text)
            self.metrics['types'] += 1

            ColorPrint.debug(f"Typed into element: {selector}")
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Failed to type into element {selector}: {error}")
            raise

    def screenshot(self, options: Dict[str, Any] = None) -> bytes:
        """
        Take screenshot

        Args:
            options: Screenshot options

        Returns:
            Screenshot bytes
        """
        try:
            if options and options.get('path'):
                self.driver.save_screenshot(options['path'])
                with open(options['path'], 'rb') as f:
                    return f.read()
            else:
                return self.driver.get_screenshot_as_png()
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Failed to take screenshot: {error}')
            raise

    def evaluate(self, script: str, *args) -> Any:
        """
        Execute JavaScript

        Args:
            script: JavaScript code
            *args: Arguments to pass to script

        Returns:
            Script result
        """
        try:
            return self.driver.execute_script(script, *args)
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Failed to evaluate script: {error}')
            raise

    def wait_for_selector(self, selector: str, options: Dict[str, Any] = None):
        """
        Wait for element to appear

        Args:
            selector: CSS selector
            options: Wait options
        """
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            timeout = options.get('timeout', 30) if options else 30
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )

            ColorPrint.debug(f"Element appeared: {selector}")
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Timeout waiting for element {selector}: {error}")
            raise

    def wait_for_function(self, func: Callable, options: Dict[str, Any] = None):
        """
        Wait for function to return truthy value

        Args:
            func: JavaScript function as string
            options: Wait options
        """
        try:
            from selenium.webdriver.support.ui import WebDriverWait

            timeout = options.get('timeout', 30) if options else 30

            def condition(driver):
                return self.driver.execute_script(f"return ({func})()")

            WebDriverWait(self.driver, timeout).until(condition)

            ColorPrint.debug("Function condition met")
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Timeout waiting for function: {error}')
            raise

    def get_content(self) -> str:
        """
        Get page HTML content

        Returns:
            HTML string
        """
        try:
            return self.driver.page_source
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Failed to get page content: {error}')
            raise

    def get_title(self) -> str:
        """
        Get page title

        Returns:
            Title string
        """
        try:
            self.title = self.driver.title
            return self.title
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Failed to get page title: {error}')
            raise

    def get_url(self) -> str:
        """
        Get current URL

        Returns:
            URL string
        """
        try:
            self.url = self.driver.current_url
            return self.url
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f'Failed to get page URL: {error}')
            raise

    def close(self):
        """Close the page"""
        try:
            self.driver.close()
            ColorPrint.debug('Page closed')
        except Exception as error:
            ColorPrint.red(f'Failed to close page: {error}')
            raise

    def main_frame(self):
        """Get main frame (for compatibility)"""
        return self

    def url(self) -> str:
        """Get URL (for compatibility)"""
        return self.get_url()

    def get_info(self) -> Dict[str, Any]:
        """
        Get page information

        Returns:
            Dictionary with page details including URL, title, metrics, etc.

        Example:
            info = page.get_info()
            print(f"Current URL: {info['url']}")
            print(f"Total clicks: {info['metrics']['clicks']}")
        """
        return {
            'url': self.driver.current_url if self.driver else None,
            'title': self.driver.title if self.driver else None,
            'is_initialized': self.is_initialized,
            'metrics': self.metrics.copy(),
            'options': self.options
        }
