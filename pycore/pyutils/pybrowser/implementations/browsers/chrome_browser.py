#!/usr/bin/env python3
"""
Chrome Browser Implementation - Thread Mode

Chrome browser running in dedicated thread.
Each instance is a self-contained thread that manages its own Selenium driver.
"""

import os
import shutil
import time
from typing import Dict, Any, Optional

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

from pycore import ColorPrint
from pycore.pyutils.pybrowser.core.threaded_browser import ThreadedBrowser


class ChromeBrowser(ThreadedBrowser):
    """
    Chrome browser running in dedicated thread

    Each ChromeBrowser instance is a threading.Thread that:
    - Launches and manages its own Chrome WebDriver
    - Processes commands via internal queue
    - Provides thread-safe API for browser operations

    Usage:
        browser = ChromeBrowser(config={'headless': False})
        browser.start()  # Launches Chrome in thread
        browser.wait_until_ready()
        browser.navigate('https://google.com')
        browser.stop()
        browser.join()
    """

    def __init__(self, config: Dict[str, Any] = None, thread_name: str = None):
        """
        Initialize Chrome browser thread

        Args:
            config: Browser configuration
                - headless: bool (default: False)
                - args: list of Chrome arguments
                - user_data_dir: Chrome profile directory
                - download_dir: Download directory
                - window_size: tuple (width, height)
            thread_name: Custom thread name (default: auto-generated)
        """
        super().__init__(config, thread_name or 'ChromeBrowser', daemon=True)
        self.browser_type = 'chrome'
        self.version = None

    def _get_driver_service(self):
        """
        Get ChromeDriver service with fallback chain

        Priority:
            1. Local path (if configured)
            2. System PATH
            3. Auto-download (requires internet)

        Returns:
            Service instance

        Raises:
            RuntimeError: If no driver found
        """
        driver_mode = self.config.get('driver_mode', 'auto_download')
        driver_path = self.config.get('driver_path')

        # Mode 1: Local driver path
        if driver_mode == 'local' and driver_path:
            if os.path.exists(driver_path):
                ColorPrint.green(f"{self.name}: Using local driver: {driver_path}")
                return Service(driver_path)
            else:
                ColorPrint.yellow(f"{self.name}: Local driver not found: {driver_path}")
                ColorPrint.yellow(f"{self.name}: Falling back to system PATH...")

        # Mode 2: System PATH
        if driver_mode == 'system_path' or (driver_mode == 'local' and not driver_path):
            system_driver = shutil.which('chromedriver')
            if system_driver:
                ColorPrint.green(f"{self.name}: Using system PATH driver: {system_driver}")
                return Service(system_driver)
            else:
                ColorPrint.yellow(f"{self.name}: ChromeDriver not found in system PATH")

        # Mode 3: Auto-download (requires internet)
        if driver_mode == 'auto_download':
            ColorPrint.blue(f"{self.name}: Attempting to download ChromeDriver...")
            from webdriver_manager.chrome import ChromeDriverManager
            downloaded_path = ChromeDriverManager().install()
            ColorPrint.green(f"{self.name}: Downloaded driver: {downloaded_path}")
            return Service(downloaded_path)

        # All methods failed
        error_msg = (
            f"Cannot find ChromeDriver. Tried:\n"
            f"  1. Local path: {driver_path if driver_path else 'Not configured'}\n"
            f"  2. System PATH: Not found\n"
            f"  3. Auto-download: Not attempted (driver_mode={driver_mode})\n"
            f"\nSolutions:\n"
            f"  - Set driver_mode='local' and driver_path='D:/drivers/chromedriver.exe'\n"
            f"  - Add chromedriver to system PATH and use driver_mode='system_path'\n"
            f"  - Use driver_mode='auto_download' (requires internet)"
        )
        raise RuntimeError(error_msg)

    def _launch_browser(self):
        """
        Launch Chrome browser (runs in thread context)

        This is called automatically when thread starts via start()
        """
        ColorPrint.blue(f"{self.name}: Launching Chrome browser...")

        # Configure Chrome options
        chrome_options = Options()

        # Headless mode
        if self.config.get('headless', False):
            chrome_options.add_argument('--headless=new')
            ColorPrint.blue(f"{self.name}: Headless mode enabled")

        # Custom arguments
        for arg in self.config.get('args', []):
            chrome_options.add_argument(arg)

        # Default arguments for stability
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')

        # User data directory (profile)
        user_data_dir = self.config.get('user_data_dir')
        if user_data_dir:
            chrome_options.add_argument(f'--user-data-dir={user_data_dir}')

        # Download directory
        download_dir = self.config.get('download_dir')
        if download_dir:
            prefs = {'download.default_directory': download_dir}
            chrome_options.add_experimental_option('prefs', prefs)

        # Window size
        window_size = self.config.get('window_size')
        if window_size:
            width, height = window_size
            chrome_options.add_argument(f'--window-size={width},{height}')

        # Get driver service with fallback chain
        service = self._get_driver_service()

        # Launch Chrome
        self.driver = webdriver.Chrome(service=service, options=chrome_options)

        # Mark as launched
        self.is_launched = True
        self.launch_time = time.time()

        # Get version (check safely)
        if self.driver and hasattr(self.driver, 'capabilities'):
            capabilities = self.driver.capabilities
            self.version = capabilities.get('browserVersion') or capabilities.get('version', 'unknown')
        else:
            self.version = 'unknown'

        ColorPrint.green(
            f"{self.name}: Chrome browser launched successfully (v{self.version})"
        )

    def new_tab(self, url: str = 'about:blank') -> bool:
        """
        Open new tab (thread-safe)

        Args:
            url: URL to open in new tab

        Returns:
            True if successful
        """
        def _open_tab(driver, target_url):
            driver.execute_script(f"window.open('{target_url}', '_blank');")
            # Switch to new tab
            driver.switch_to.window(driver.window_handles[-1])
            return True

        try:
            return self.execute(_open_tab, url)
        except:
            return False

    def close_current_tab(self) -> bool:
        """
        Close current tab (thread-safe)

        Returns:
            True if successful
        """
        def _close_tab(driver):
            if len(driver.window_handles) > 1:
                driver.close()
                # Switch to first tab
                driver.switch_to.window(driver.window_handles[0])
                return True
            return False

        try:
            return self.execute(_close_tab)
        except:
            return False

    def switch_to_tab(self, index: int) -> bool:
        """
        Switch to tab by index (thread-safe)

        Args:
            index: Tab index (0-based)

        Returns:
            True if successful
        """
        def _switch_tab(driver, tab_index):
            handles = driver.window_handles
            if 0 <= tab_index < len(handles):
                driver.switch_to.window(handles[tab_index])
                return True
            return False

        try:
            return self.execute(_switch_tab, index)
        except:
            return False

    def get_tab_count(self) -> int:
        """
        Get number of open tabs (thread-safe)

        Returns:
            Number of tabs
        """
        def _count_tabs(driver):
            return len(driver.window_handles)

        try:
            return self.execute(_count_tabs)
        except:
            return 0

    def screenshot(self, filepath: str) -> bool:
        """
        Take screenshot (thread-safe)

        Args:
            filepath: Path to save screenshot

        Returns:
            True if successful
        """
        def _take_screenshot(driver, path):
            return driver.save_screenshot(path)

        try:
            return self.execute(_take_screenshot, filepath)
        except:
            return False

    def execute_script(self, script: str, *args) -> Any:
        """
        Execute JavaScript (thread-safe)

        Args:
            script: JavaScript code
            *args: Arguments for script

        Returns:
            Script result
        """
        def _exec_script(driver, js_code, *js_args):
            return driver.execute_script(js_code, *js_args)

        return self.execute(_exec_script, script, *args)

    def find_element(self, by: str, value: str) -> Optional[Any]:
        """
        Find element (thread-safe)

        Args:
            by: Locator strategy (id, css, xpath, etc.)
            value: Locator value

        Returns:
            WebElement or None
        """
        def _find_elem(driver, locator_by, locator_value):
            by_mapping = {
                'id': By.ID,
                'name': By.NAME,
                'css': By.CSS_SELECTOR,
                'xpath': By.XPATH,
                'class': By.CLASS_NAME,
                'tag': By.TAG_NAME,
                'link_text': By.LINK_TEXT,
                'partial_link_text': By.PARTIAL_LINK_TEXT
            }
            by_method = by_mapping.get(locator_by.lower(), By.CSS_SELECTOR)
            try:
                return driver.find_element(by_method, locator_value)
            except:
                return None

        try:
            return self.execute(_find_elem, by, value)
        except:
            return None

    def find_elements(self, by: str, value: str) -> list:
        """
        Find elements (thread-safe)

        Args:
            by: Locator strategy
            value: Locator value

        Returns:
            List of WebElements
        """
        def _find_elems(driver, locator_by, locator_value):
            by_mapping = {
                'id': By.ID,
                'name': By.NAME,
                'css': By.CSS_SELECTOR,
                'xpath': By.XPATH,
                'class': By.CLASS_NAME,
                'tag': By.TAG_NAME,
                'link_text': By.LINK_TEXT,
                'partial_link_text': By.PARTIAL_LINK_TEXT
            }
            by_method = by_mapping.get(locator_by.lower(), By.CSS_SELECTOR)
            try:
                return driver.find_elements(by_method, locator_value)
            except:
                return []

        try:
            return self.execute(_find_elems, by, value)
        except:
            return []

    def set_window_size(self, width: int, height: int) -> bool:
        """
        Set window size (thread-safe)

        Args:
            width: Window width
            height: Window height

        Returns:
            True if successful
        """
        def _set_size(driver, w, h):
            driver.set_window_size(w, h)
            return True

        try:
            return self.execute(_set_size, width, height)
        except:
            return False

    def maximize_window(self) -> bool:
        """
        Maximize window (thread-safe)

        Returns:
            True if successful
        """
        def _maximize(driver):
            driver.maximize_window()
            return True

        try:
            return self.execute(_maximize)
        except:
            return False

    def get_cookies(self) -> list:
        """
        Get all cookies (thread-safe)

        Returns:
            List of cookie dictionaries
        """
        def _get_cookies(driver):
            return driver.get_cookies()

        try:
            return self.execute(_get_cookies)
        except:
            return []

    def add_cookie(self, cookie_dict: Dict[str, Any]) -> bool:
        """
        Add cookie (thread-safe)

        Args:
            cookie_dict: Cookie dictionary

        Returns:
            True if successful
        """
        def _add_cookie(driver, cookie):
            driver.add_cookie(cookie)
            return True

        try:
            return self.execute(_add_cookie, cookie_dict)
        except:
            return False

    def delete_all_cookies(self) -> bool:
        """
        Delete all cookies (thread-safe)

        Returns:
            True if successful
        """
        def _delete_cookies(driver):
            driver.delete_all_cookies()
            return True

        try:
            return self.execute(_delete_cookies)
        except:
            return False

    def __repr__(self) -> str:
        """String representation"""
        status = "running" if self._running else "stopped"
        launched = "launched" if self.is_launched else "not launched"
        version = f"v{self.version}" if self.version else "unknown"
        return f"<ChromeBrowser name={self.name} status={status} browser={launched} version={version}>"
