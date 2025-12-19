#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Page Switcher

Smart page and tab management for browser automation.
Refactored to use TabUtils for consistency and code reuse.
"""

from typing import List, Dict, Any, Optional, Union

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.utils.tab_utils import TabUtils


class PageSwitcher:
    """
    Page Switcher

    Provides intelligent page/tab switching functionality.
    Wraps PyBrowser browser implementations (ChromeBrowser, EdgeBrowser, etc.).

    Refactored: Now uses TabUtils for all tab operations to eliminate code duplication.
    """

    def __init__(self, browser):
        """
        Initialize page switcher

        Args:
            browser: IBrowser object (ChromeBrowser, EdgeBrowser, FirefoxBrowser, etc.)
        """
        if not browser:
            ColorPrint.red('[PageSwitcher] Browser is required')
            raise ValueError('Browser is required')

        self.browser = browser
        self.switch_count = 0

        ColorPrint.green(f'[PageSwitcher] Initialized with browser: {type(browser).__name__}')

    def switch_by_index(self, index: int) -> bool:
        """
        Switch to tab by index

        Args:
            index: Tab index (0-based)

        Returns:
            True if successful, False otherwise

        Example:
            switcher = PageSwitcher(chrome_browser)
            switcher.switch_by_index(2)  # Switch to 3rd tab
        """
        if index < 0:
            ColorPrint.red(f'[PageSwitcher] Invalid index: {index} (must be >= 0)')
            return False

        ColorPrint.blue(f'[PageSwitcher] Switching to tab index: {index}')

        # Use browser's switch_to_tab method if available
        if hasattr(self.browser, 'switch_to_tab'):
            success = self.browser.switch_to_tab(index)
            if success:
                self.switch_count += 1
                ColorPrint.green(f'[PageSwitcher] Successfully switched to tab {index}')
            else:
                ColorPrint.red(f'[PageSwitcher] Failed to switch to tab {index}')
            return success

        # Fallback: Use TabUtils directly
        if hasattr(self.browser, 'driver'):
            success = TabUtils.switch_to_tab(self.browser.driver, index)
            if success:
                self.switch_count += 1
            return success

        ColorPrint.red('[PageSwitcher] Browser does not have switch_to_tab() or driver attribute')
        return False

    def switch_by_url(self, url: str, exact_match: bool = False, use_domain_match: bool = False) -> bool:
        """
        Switch to tab by URL

        Args:
            url: Target URL
            exact_match: If True, require exact URL match; if False, allow partial match (default: False)
            use_domain_match: If True, use domain matching instead of simple string match

        Returns:
            True if successful, False otherwise

        Example:
            switcher.switch_by_url('https://example.com', exact_match=False)
        """
        if not url:
            ColorPrint.red('[PageSwitcher] URL is required')
            return False

        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not have driver attribute')
            return False

        ColorPrint.blue(f'[PageSwitcher] Searching for URL: {url} (exact_match={exact_match}, domain_match={use_domain_match})')

        # Use TabUtils to find tab
        if use_domain_match:
            index = TabUtils.find_tab_by_url_domain(self.browser.driver, url, exact_match=exact_match)
        else:
            index = TabUtils.find_tab_by_url(self.browser.driver, url, exact_match=exact_match)

        if index != -1:
            self.switch_count += 1
            return True

        return False

    def switch_by_title(self, title: str, exact_match: bool = False, case_sensitive: bool = False) -> bool:
        """
        Switch to tab by page title

        Args:
            title: Page title
            exact_match: If True, require exact title match; if False, allow partial match (default: False)
            case_sensitive: If True, case-sensitive match (default: False)

        Returns:
            True if successful, False otherwise

        Example:
            switcher.switch_by_title('Google', exact_match=False)
        """
        if not title:
            ColorPrint.red('[PageSwitcher] Title is required')
            return False

        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not have driver attribute')
            return False

        ColorPrint.blue(f'[PageSwitcher] Searching for title: {title} (exact_match={exact_match})')

        # Use TabUtils to find tab
        index = TabUtils.find_tab_by_title(self.browser.driver, title, exact_match=exact_match, case_sensitive=case_sensitive)

        if index != -1:
            self.switch_count += 1
            return True

        return False

    def open_and_switch(self, url: str, reuse_blank: bool = True) -> bool:
        """
        Open URL and switch to it (creates new tab if needed)

        Args:
            url: Target URL
            reuse_blank: If True, reuse blank tab if available (default: True)

        Returns:
            True if successful, False otherwise

        Example:
            switcher.open_and_switch('https://example.com', reuse_blank=True)
        """
        if not url:
            ColorPrint.red('[PageSwitcher] URL is required')
            return False

        ColorPrint.blue(f'[PageSwitcher] Opening URL: {url} (reuse_blank={reuse_blank})')

        if not hasattr(self.browser, 'new_tab') or not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not support required methods')
            return False

        # If reuse_blank, try to find blank tab first
        if reuse_blank:
            blank_index = TabUtils.find_blank_tab(self.browser.driver)
            if blank_index != -1:
                ColorPrint.blue(f'[PageSwitcher] Found blank tab at index {blank_index}, reusing')
                success = self.switch_by_index(blank_index)
                if success:
                    # Navigate to URL
                    self.browser.driver.get(url)
                    ColorPrint.green(f'[PageSwitcher] Navigated to {url} in reused tab')
                    return True

        # Create new tab and navigate
        success = self.browser.new_tab(url)
        if success:
            self.switch_count += 1
            ColorPrint.green(f'[PageSwitcher] Opened new tab: {url}')
        else:
            ColorPrint.red(f'[PageSwitcher] Failed to open new tab: {url}')

        return success

    def close_current_and_switch(self, fallback_index: int = 0) -> bool:
        """
        Close current tab and switch to fallback tab

        Args:
            fallback_index: Index to switch to after closing (default: 0)

        Returns:
            True if successful, False otherwise

        Example:
            switcher.close_current_and_switch(fallback_index=0)
        """
        ColorPrint.blue(f'[PageSwitcher] Closing current tab and switching to index {fallback_index}')

        # Check if browser has close_current_tab method
        if hasattr(self.browser, 'close_current_tab'):
            success = self.browser.close_current_tab()
            if success:
                ColorPrint.green('[PageSwitcher] Successfully closed current tab')
                return True
            else:
                ColorPrint.red('[PageSwitcher] Failed to close current tab')
                return False

        # Fallback: Use TabUtils
        if hasattr(self.browser, 'driver'):
            current_index = TabUtils.get_current_tab_index(self.browser.driver)
            if current_index == -1:
                ColorPrint.red('[PageSwitcher] Failed to get current tab index')
                return False

            return TabUtils.close_tab(self.browser.driver, current_index, fallback_index)

        ColorPrint.red('[PageSwitcher] Browser does not support tab closing')
        return False

    def get_all_tabs_info(self) -> List[Dict[str, Any]]:
        """
        Get information about all tabs

        Returns:
            List of tab info dictionaries:
            [
                {'index': 0, 'url': '...', 'title': '...', 'is_blank': bool},
                ...
            ]

        Example:
            tabs = switcher.get_all_tabs_info()
            for tab in tabs:
                print(f"{tab['index']}: {tab['title']} - {tab['url']}")
        """
        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not have driver attribute')
            return []

        # Use TabUtils to get all tabs info
        tabs_info = TabUtils.get_all_tabs_info(self.browser.driver)

        ColorPrint.green(f'[PageSwitcher] Retrieved info for {len(tabs_info)} tabs')
        return tabs_info

    def get_current_tab_index(self) -> int:
        """
        Get current tab index

        Returns:
            Current tab index, or -1 if failed
        """
        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not have driver attribute')
            return -1

        return TabUtils.get_current_tab_index(self.browser.driver)

    def get_tab_count(self) -> int:
        """
        Get number of tabs

        Returns:
            Number of tabs
        """
        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[PageSwitcher] Browser does not have driver attribute')
            return 0

        return TabUtils.get_tab_count(self.browser.driver)

    def cleanup(self):
        """
        Cleanup resources (added for consistency)

        Note: PageSwitcher doesn't own the browser, so it doesn't close it.
        """
        ColorPrint.blue('[PageSwitcher] Cleanup (no resources to release)')

    def get_stats(self) -> Dict[str, Any]:
        """
        Get page switcher statistics

        Returns:
            Statistics dictionary
        """
        return {
            'switch_count': self.switch_count,
            'tab_count': self.get_tab_count()
        }


__all__ = ['PageSwitcher']
