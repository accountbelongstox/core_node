#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tab Utilities

Unified tab/window management utilities for browser automation.
Eliminates code duplication across PageSwitcher and EnhancedPage.
"""

from typing import Optional, List, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.color_print import ColorPrint


# Unified blank tab URL list
BLANK_TAB_URLS = [
    'about:blank',
    'chrome://newtab/',
    'edge://newtab/',
    'chrome://new-tab-page/',
    'edge://new-tab-page/',
    'about:newtab',
    ''
]


class TabUtils:
    """
    Tab utility class for browser automation

    Provides unified methods for tab/window management.
    All methods are static and work with Selenium WebDriver.
    """

    @staticmethod
    def find_tab_by_url(driver, url: str, exact_match: bool = False) -> int:
        """
        Find tab index by URL

        Args:
            driver: Selenium WebDriver instance
            url: Target URL to search for
            exact_match: If True, require exact URL match; if False, allow partial match (default: False)

        Returns:
            Tab index (0-based) if found, -1 otherwise

        Example:
            index = TabUtils.find_tab_by_url(driver, 'https://example.com', exact_match=False)
            if index != -1:
                driver.switch_to.window(driver.window_handles[index])
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return -1

        if not url:
            ColorPrint.red('[TabUtils] URL is required')
            return -1

        handles = driver.window_handles
        original_handle = driver.current_window_handle

        ColorPrint.blue(f'[TabUtils] Searching for URL: {url} (exact_match={exact_match}) in {len(handles)} tabs')

        for i, handle in enumerate(handles):
            driver.switch_to.window(handle)
            current_url = driver.current_url

            match = False
            if exact_match:
                match = current_url == url
            else:
                match = url in current_url

            if match:
                ColorPrint.green(f'[TabUtils] Found matching tab at index {i}: {current_url}')
                driver.switch_to.window(original_handle)
                return i

        # Restore original tab
        driver.switch_to.window(original_handle)
        ColorPrint.yellow(f'[TabUtils] No tab found with URL: {url}')
        return -1

    @staticmethod
    def find_tab_by_url_domain(driver, url: str, exact_match: bool = False) -> int:
        """
        Find tab index by URL domain matching

        Args:
            driver: Selenium WebDriver instance
            url: Target URL
            exact_match: If True, match domain + path; if False, match domain only (default: False)

        Returns:
            Tab index if found, -1 otherwise
        """
        if not driver or not url:
            ColorPrint.red('[TabUtils] Driver and URL are required')
            return -1

        handles = driver.window_handles
        original_handle = driver.current_window_handle

        try:
            parsed_target = urlparse(url)
        except Exception:
            ColorPrint.red(f'[TabUtils] Invalid URL: {url}')
            driver.switch_to.window(original_handle)
            return -1

        ColorPrint.blue(f'[TabUtils] Searching for domain: {parsed_target.netloc}')

        for i, handle in enumerate(handles):
            driver.switch_to.window(handle)
            current_url = driver.current_url

            try:
                parsed_current = urlparse(current_url)

                if exact_match:
                    # Match domain + path (exact)
                    if parsed_current.netloc == parsed_target.netloc and \
                       parsed_current.path == parsed_target.path:
                        ColorPrint.green(f'[TabUtils] Found matching tab at index {i}: {current_url}')
                        driver.switch_to.window(original_handle)
                        return i
                else:
                    # Match domain only (partial)
                    if parsed_current.netloc == parsed_target.netloc:
                        ColorPrint.green(f'[TabUtils] Found matching tab at index {i}: {current_url}')
                        driver.switch_to.window(original_handle)
                        return i
            except Exception:
                continue

        driver.switch_to.window(original_handle)
        ColorPrint.yellow(f'[TabUtils] No tab found with domain: {parsed_target.netloc}')
        return -1

    @staticmethod
    def find_tab_by_title(driver, title: str, exact_match: bool = False, case_sensitive: bool = False) -> int:
        """
        Find tab index by page title

        Args:
            driver: Selenium WebDriver instance
            title: Target title to search for
            exact_match: If True, require exact title match; if False, allow partial match (default: False)
            case_sensitive: If True, case-sensitive match (default: False)

        Returns:
            Tab index if found, -1 otherwise

        Example:
            index = TabUtils.find_tab_by_title(driver, 'Google', exact_match=False)
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return -1

        if not title:
            ColorPrint.red('[TabUtils] Title is required')
            return -1

        handles = driver.window_handles
        original_handle = driver.current_window_handle

        ColorPrint.blue(f'[TabUtils] Searching for title: {title} (exact_match={exact_match}) in {len(handles)} tabs')

        search_title = title if case_sensitive else title.lower()

        for i, handle in enumerate(handles):
            driver.switch_to.window(handle)
            current_title = driver.title
            compare_title = current_title if case_sensitive else current_title.lower()

            match = False
            if exact_match:
                match = compare_title == search_title
            else:
                match = search_title in compare_title

            if match:
                ColorPrint.green(f'[TabUtils] Found matching tab at index {i}: {current_title}')
                driver.switch_to.window(original_handle)
                return i

        driver.switch_to.window(original_handle)
        ColorPrint.yellow(f'[TabUtils] No tab found with title: {title}')
        return -1

    @staticmethod
    def find_blank_tab(driver) -> int:
        """
        Find blank tab index

        Args:
            driver: Selenium WebDriver instance

        Returns:
            Index of blank tab if found, -1 otherwise

        Example:
            blank_index = TabUtils.find_blank_tab(driver)
            if blank_index != -1:
                # Reuse blank tab
                driver.switch_to.window(driver.window_handles[blank_index])
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return -1

        handles = driver.window_handles
        original_handle = driver.current_window_handle

        ColorPrint.blue(f'[TabUtils] Searching for blank tab in {len(handles)} tabs')

        for i, handle in enumerate(handles):
            driver.switch_to.window(handle)
            current_url = driver.current_url

            if TabUtils.is_blank_url(current_url):
                ColorPrint.green(f'[TabUtils] Found blank tab at index {i}: {current_url}')
                driver.switch_to.window(original_handle)
                return i

        driver.switch_to.window(original_handle)
        ColorPrint.blue('[TabUtils] No blank tab found')
        return -1

    @staticmethod
    def is_blank_url(url: str) -> bool:
        """
        Check if URL is a blank page

        Args:
            url: URL to check

        Returns:
            True if URL is blank, False otherwise

        Example:
            if TabUtils.is_blank_url(driver.current_url):
                # This is a blank page
        """
        return url in BLANK_TAB_URLS

    @staticmethod
    def get_all_tabs_info(driver) -> List[dict]:
        """
        Get information about all tabs

        Args:
            driver: Selenium WebDriver instance

        Returns:
            List of tab info dictionaries:
            [
                {'index': 0, 'url': '...', 'title': '...', 'is_blank': bool},
                ...
            ]

        Example:
            tabs = TabUtils.get_all_tabs_info(driver)
            for tab in tabs:
                print(f"{tab['index']}: {tab['title']}")
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return []

        handles = driver.window_handles
        original_handle = driver.current_window_handle

        ColorPrint.blue(f'[TabUtils] Getting info for {len(handles)} tabs')

        tabs_info = []
        for i, handle in enumerate(handles):
            driver.switch_to.window(handle)
            url = driver.current_url
            tab_info = {
                'index': i,
                'url': url,
                'title': driver.title,
                'is_blank': TabUtils.is_blank_url(url)
            }
            tabs_info.append(tab_info)

        driver.switch_to.window(original_handle)
        ColorPrint.green(f'[TabUtils] Retrieved info for {len(tabs_info)} tabs')

        return tabs_info

    @staticmethod
    def switch_to_tab(driver, index: int) -> bool:
        """
        Switch to tab by index

        Args:
            driver: Selenium WebDriver instance
            index: Tab index (0-based)

        Returns:
            True if successful, False otherwise

        Example:
            success = TabUtils.switch_to_tab(driver, 2)
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return False

        if index < 0:
            ColorPrint.red(f'[TabUtils] Invalid index: {index} (must be >= 0)')
            return False

        handles = driver.window_handles

        if index >= len(handles):
            ColorPrint.red(f'[TabUtils] Index {index} out of range (total: {len(handles)} tabs)')
            return False

        driver.switch_to.window(handles[index])
        ColorPrint.green(f'[TabUtils] Switched to tab {index}')
        return True

    @staticmethod
    def get_tab_count(driver) -> int:
        """
        Get number of tabs

        Args:
            driver: Selenium WebDriver instance

        Returns:
            Number of tabs
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return 0

        count = len(driver.window_handles)
        ColorPrint.blue(f'[TabUtils] Tab count: {count}')
        return count

    @staticmethod
    def get_current_tab_index(driver) -> int:
        """
        Get current tab index

        Args:
            driver: Selenium WebDriver instance

        Returns:
            Current tab index, or -1 if failed
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return -1

        current_handle = driver.current_window_handle
        handles = driver.window_handles

        for i, handle in enumerate(handles):
            if handle == current_handle:
                ColorPrint.blue(f'[TabUtils] Current tab index: {i}')
                return i

        ColorPrint.red('[TabUtils] Failed to find current tab index')
        return -1

    @staticmethod
    def close_tab(driver, index: int, fallback_index: int = 0) -> bool:
        """
        Close tab by index and switch to fallback

        Args:
            driver: Selenium WebDriver instance
            index: Index of tab to close
            fallback_index: Index to switch to after closing (default: 0)

        Returns:
            True if successful, False otherwise
        """
        if not driver:
            ColorPrint.red('[TabUtils] Driver is required')
            return False

        handles = driver.window_handles

        if len(handles) <= 1:
            ColorPrint.yellow('[TabUtils] Cannot close the only tab')
            return False

        if index < 0 or index >= len(handles):
            ColorPrint.red(f'[TabUtils] Invalid index: {index}')
            return False

        # Switch to target tab and close
        driver.switch_to.window(handles[index])
        driver.close()

        # Switch to fallback
        remaining_handles = driver.window_handles
        if fallback_index >= len(remaining_handles):
            fallback_index = 0

        driver.switch_to.window(remaining_handles[fallback_index])
        ColorPrint.green(f'[TabUtils] Closed tab {index}, switched to tab {fallback_index}')

        return True


__all__ = ['TabUtils', 'BLANK_TAB_URLS']
