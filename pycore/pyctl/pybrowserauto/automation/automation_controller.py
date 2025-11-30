#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automation Controller

High-level browser automation controller.
Integrates ScreenshotManager, PageSwitcher, and PyBrowser functionality.
"""

import time
from typing import List, Dict, Any, Union
from pathlib import Path

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyctl.pybrowserauto.automation.screenshot_manager import ScreenshotManager
from pycore.pyctl.pybrowserauto.automation.page_switcher import PageSwitcher
from pycore.pyutils.pybrowser.utils.page_utils import PageWrapper


class AutomationController:
    """
    Automation Controller

    High-level controller for browser automation workflows.
    Combines page navigation, switching, screenshot, and image merging.
    """

    def __init__(self):
        """Initialize automation controller"""
        self.browser = None
        self.page = None
        self.page_switcher = None
        self.screenshot_manager = None
        self.is_initialized = False

        ColorPrint.green('[AutomationController] Initialized')

    def initialize(
        self,
        browser,
        page = None,
        screenshot_output_dir: str = None
    ) -> bool:
        """
        Initialize with browser and page instances

        Args:
            browser: IBrowser object (ChromeBrowser, EdgeBrowser, etc.)
            page: IPage object (optional, can be obtained from browser)
            screenshot_output_dir: Screenshot output directory (optional)

        Returns:
            True if successful, False otherwise

        Example:
            from pycore.pyutils.pybrowser.implementations.browsers import ChromeBrowser

            controller = AutomationController()
            chrome = ChromeBrowser()
            chrome.launch()
            controller.initialize(chrome)
        """
        if not browser:
            ColorPrint.red('[AutomationController] Browser is required')
            return False

        ColorPrint.blue('[AutomationController] Initializing with browser')

        self.browser = browser
        self.page = page

        # Initialize PageSwitcher
        self.page_switcher = PageSwitcher(browser)
        ColorPrint.green('[AutomationController] PageSwitcher initialized')

        # Initialize ScreenshotManager
        output_dir = screenshot_output_dir or str(Path.cwd() / 'automation_screenshots')
        self.screenshot_manager = ScreenshotManager(output_dir)
        ColorPrint.green('[AutomationController] ScreenshotManager initialized')

        self.is_initialized = True
        ColorPrint.green('[AutomationController] Initialization complete')

        return True

    def navigate_to(self, url: str, wait_time: float = 2.0) -> bool:
        """
        Navigate to URL

        Args:
            url: Target URL
            wait_time: Wait time after navigation in seconds (default: 2.0)

        Returns:
            True if successful, False otherwise
        """
        if not self.is_initialized:
            ColorPrint.red('[AutomationController] Controller not initialized')
            return False

        if not url:
            ColorPrint.red('[AutomationController] URL is required')
            return False

        ColorPrint.blue(f'[AutomationController] Navigating to: {url}')

        # Use browser driver to navigate
        if hasattr(self.browser, 'driver'):
            self.browser.driver.get(url)
            ColorPrint.green(f'[AutomationController] Navigated to: {url}')

            # Wait for page to load
            if wait_time > 0:
                ColorPrint.blue(f'[AutomationController] Waiting {wait_time}s for page to load')
                time.sleep(wait_time)

            return True
        else:
            ColorPrint.red('[AutomationController] Browser does not have driver attribute')
            return False

    def navigate_screenshot_merge(
        self,
        url: str,
        reference_image: str,
        output_path: str = None,
        wait_time: float = 2.0,
        merge_mode: str = 'horizontal',
        spacing: int = 10
    ) -> Dict[str, Any]:
        """
        Navigate → Wait → Screenshot → Merge workflow

        Args:
            url: Target URL
            reference_image: Reference image source (URL or local path)
            output_path: Output path for merged image (optional)
            wait_time: Wait time after navigation in seconds (default: 2.0)
            merge_mode: Merge mode ('horizontal', 'vertical', 'grid')
            spacing: Spacing between images in pixels (default: 10)

        Returns:
            Result dictionary (same as ScreenshotManager.take_screenshot_and_merge())

        Example:
            controller = AutomationController()
            controller.initialize(chrome_browser)

            result = controller.navigate_screenshot_merge(
                url='https://example.com',
                reference_image='/path/to/reference.png',
                merge_mode='horizontal'
            )

            if result['success']:
                print(f"Merged image: {result['merged_path']}")
        """
        if not self.is_initialized:
            ColorPrint.red('[AutomationController] Controller not initialized')
            return {
                'success': False,
                'error': 'Controller not initialized'
            }

        ColorPrint.blue('[AutomationController] Starting navigate→screenshot→merge workflow')

        # Step 1: Navigate to URL
        success = self.navigate_to(url, wait_time)
        if not success:
            return {
                'success': False,
                'error': f'Failed to navigate to {url}'
            }

        # Step 2: Get current page
        # For simplicity, we create a minimal page wrapper
        page = self._get_current_page_wrapper()
        if not page:
            return {
                'success': False,
                'error': 'Failed to get current page'
            }

        # Step 3: Screenshot and merge
        result = self.screenshot_manager.take_screenshot_and_merge(
            page=page,
            reference_image_source=reference_image,
            output_path=output_path,
            merge_mode=merge_mode,
            spacing=spacing
        )

        if result['success']:
            ColorPrint.green(f'[AutomationController] Workflow completed successfully')
        else:
            ColorPrint.red(f'[AutomationController] Workflow failed: {result.get("error")}')

        return result

    def switch_screenshot_merge(
        self,
        target: Union[int, str],
        target_type: str,
        reference_image: str,
        output_path: str = None,
        merge_mode: str = 'horizontal',
        spacing: int = 10
    ) -> Dict[str, Any]:
        """
        Switch page → Screenshot → Merge workflow

        Args:
            target: Switch target (index, URL, or title)
            target_type: Target type ('index', 'url', 'title')
            reference_image: Reference image source
            output_path: Output path for merged image (optional)
            merge_mode: Merge mode ('horizontal', 'vertical', 'grid')
            spacing: Spacing between images in pixels (default: 10)

        Returns:
            Result dictionary

        Example:
            # Switch to 2nd tab and screenshot
            result = controller.switch_screenshot_merge(
                target=1,
                target_type='index',
                reference_image='/path/to/reference.png'
            )

            # Switch by URL
            result = controller.switch_screenshot_merge(
                target='https://example.com',
                target_type='url',
                reference_image='/path/to/reference.png'
            )
        """
        if not self.is_initialized:
            ColorPrint.red('[AutomationController] Controller not initialized')
            return {
                'success': False,
                'error': 'Controller not initialized'
            }

        ColorPrint.blue('[AutomationController] Starting switch→screenshot→merge workflow')

        # Step 1: Switch to target page
        success = False
        if target_type == 'index':
            success = self.page_switcher.switch_by_index(int(target))
        elif target_type == 'url':
            success = self.page_switcher.switch_by_url(str(target))
        elif target_type == 'title':
            success = self.page_switcher.switch_by_title(str(target))
        else:
            ColorPrint.red(f'[AutomationController] Unknown target_type: {target_type}')
            return {
                'success': False,
                'error': f'Unknown target_type: {target_type}'
            }

        if not success:
            return {
                'success': False,
                'error': f'Failed to switch to target: {target}'
            }

        # Wait a bit for page to stabilize
        time.sleep(1.0)

        # Step 2: Get current page
        page = self._get_current_page_wrapper()
        if not page:
            return {
                'success': False,
                'error': 'Failed to get current page'
            }

        # Step 3: Screenshot and merge
        result = self.screenshot_manager.take_screenshot_and_merge(
            page=page,
            reference_image_source=reference_image,
            output_path=output_path,
            merge_mode=merge_mode,
            spacing=spacing
        )

        if result['success']:
            ColorPrint.green(f'[AutomationController] Workflow completed successfully')
        else:
            ColorPrint.red(f'[AutomationController] Workflow failed: {result.get("error")}')

        return result

    def batch_navigate_screenshot_merge(
        self,
        url_list: List[str],
        reference_image: str,
        output_dir: str = None,
        merge_mode: str = 'horizontal',
        spacing: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Batch process multiple URLs

        Args:
            url_list: List of URLs
            reference_image: Reference image source
            output_dir: Output directory (uses screenshot_manager's dir if not provided)
            merge_mode: Merge mode ('horizontal', 'vertical', 'grid')
            spacing: Spacing between images in pixels (default: 10)

        Returns:
            List of result dictionaries

        Example:
            results = controller.batch_navigate_screenshot_merge(
                url_list=[
                    'https://example.com/page1',
                    'https://example.com/page2',
                    'https://example.com/page3'
                ],
                reference_image='/path/to/reference.png',
                merge_mode='horizontal'
            )

            for i, result in enumerate(results):
                if result['success']:
                    print(f"[{i+1}] Success: {result['merged_path']}")
        """
        if not self.is_initialized:
            ColorPrint.red('[AutomationController] Controller not initialized')
            return []

        if not url_list:
            ColorPrint.red('[AutomationController] URL list is empty')
            return []

        ColorPrint.blue(f'[AutomationController] Starting batch workflow for {len(url_list)} URLs')

        results = []
        for i, url in enumerate(url_list):
            ColorPrint.blue(f'[AutomationController] Processing URL {i+1}/{len(url_list)}: {url}')

            # Generate output path
            if output_dir:
                output_path = str(Path(output_dir) / f'merged_{i+1:04d}.png')
            else:
                output_path = None

            # Navigate, screenshot, and merge
            result = self.navigate_screenshot_merge(
                url=url,
                reference_image=reference_image,
                output_path=output_path,
                merge_mode=merge_mode,
                spacing=spacing
            )

            result['url'] = url
            result['index'] = i
            results.append(result)

        successful_count = sum(1 for r in results if r['success'])
        ColorPrint.green(f'[AutomationController] Batch workflow completed: {successful_count}/{len(url_list)} successful')

        return results

    def _get_current_page_wrapper(self):
        """
        Get a minimal page wrapper for screenshot

        Uses PageWrapper from pycore.pyutils.pybrowser.utils.page_utils

        Returns:
            PageWrapper instance, or None if failed
        """
        if not hasattr(self.browser, 'driver'):
            ColorPrint.red('[AutomationController] Browser does not have driver attribute')
            return None

        # Use extracted PageWrapper from page_utils
        return PageWrapper(self.browser.driver)

    def get_page_switcher(self) -> PageSwitcher:
        """Get PageSwitcher instance"""
        return self.page_switcher

    def get_screenshot_manager(self) -> ScreenshotManager:
        """Get ScreenshotManager instance"""
        return self.screenshot_manager

    def cleanup(self):
        """Cleanup resources"""
        ColorPrint.blue('[AutomationController] Cleaning up')

        # Close browser if needed
        if self.browser and hasattr(self.browser, 'close'):
            self.browser.close()
            ColorPrint.green('[AutomationController] Browser closed')

        self.is_initialized = False
        ColorPrint.green('[AutomationController] Cleanup complete')

    def get_stats(self) -> Dict[str, Any]:
        """
        Get automation controller statistics

        Returns:
            Statistics dictionary
        """
        stats = {
            'is_initialized': self.is_initialized
        }

        if self.page_switcher:
            stats['page_switcher'] = self.page_switcher.get_stats()

        if self.screenshot_manager:
            stats['screenshot_manager'] = self.screenshot_manager.get_stats()

        return stats


__all__ = ['AutomationController']
