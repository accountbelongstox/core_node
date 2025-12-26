#!/usr/bin/env python3
"""
Chrome Browser Implementation - Thread Mode

Chrome browser running in dedicated thread.
Each instance is a self-contained thread that manages its own Selenium driver.
"""

import os
import shutil
import time
from typing import Dict, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_selenium_webdriver,
    get_third_package_selenium_by,
    get_third_package_webdriver_manager_chrome
)
from pycore.pyutils.pybrowser.core.threaded_browser import ThreadedBrowser

webdriver = get_third_package_selenium_webdriver()
By = get_third_package_selenium_by()
ChromeDriverManager = get_third_package_webdriver_manager_chrome()
Service = webdriver.chrome.service.Service
Options = webdriver.chrome.options.Options


class ChromeBrowser(ThreadedBrowser):
    """
    Chrome browser running in dedicated thread

    Each ChromeBrowser instance is a threading.Thread that:
    - Launches and manages its own Chrome WebDriver
    - Processes commands via internal queue
    - Provides thread-safe API for browser operations
    - Supports cookie persistence with multiple profiles

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
                - profile_dir: Browser profile directory (unified parameter)
                - user_data_dir: Alias for profile_dir (Chrome-specific, deprecated)
                - download_dir: Download directory
                - window_size: tuple (width, height)
                - driver_mode: str (auto, local, system_path, auto_download)
                - driver_path: str (path to chromedriver)
                - cookie_config: Cookie persistence configuration (see ThreadedBrowser)
            thread_name: Custom thread name (default: auto-generated)
        """
        super().__init__(config, thread_name or 'ChromeBrowser', daemon=True)
        self.browser_type = 'chrome'
        self.version = None

    def _get_driver_service(self):
        """
        Get ChromeDriver service with fallback chain

        Priority:
            1. Auto mode: Try local paths -> download
            2. Local path (if configured)
            3. System PATH
            4. Auto-download (requires internet)

        Returns:
            Service instance

        Note:
            Errors propagate naturally for easier debugging.
            If offline and no local driver, will fail with clear message.
        """
        driver_mode = self.config.get('driver_mode', 'auto')
        driver_path = self.config.get('driver_path')

        # Mode 0: Auto mode (智能查找)
        if driver_mode == 'auto':
            ColorPrint.blue(f"{self.name}: Auto-detecting ChromeDriver...")

            # Try find_driver utility
            from pycore.pyutils.pybrowser.utils.browser_finder import find_driver
            found_driver = find_driver('chrome')
            if found_driver:
                ColorPrint.green(f"{self.name}: Auto-found driver: {found_driver}")
                return Service(found_driver)

            # Fallback to auto-download
            ColorPrint.yellow(f"{self.name}: Driver not found locally, attempting download...")
            ColorPrint.yellow(f"{self.name}: Note: This requires internet connection")

            # Let download errors propagate naturally
            downloaded_path = ChromeDriverManager().install()
            ColorPrint.green(f"{self.name}: Downloaded driver: {downloaded_path}")
            return Service(downloaded_path)

        # Mode 1: Local driver path
        if driver_mode == 'local' and driver_path:
            if os.path.exists(driver_path):
                ColorPrint.green(f"{self.name}: Using local driver: {driver_path}")
                return Service(driver_path)
            else:
                ColorPrint.red(f"{self.name}: Local driver not found: {driver_path}")
                ColorPrint.yellow(f"{self.name}: Falling back to system PATH...")

        # Mode 2: System PATH
        if driver_mode == 'system_path' or (driver_mode == 'local' and not driver_path):
            system_driver = shutil.which('chromedriver')
            if system_driver:
                ColorPrint.green(f"{self.name}: Using system PATH driver: {system_driver}")
                return Service(system_driver)
            else:
                ColorPrint.red(f"{self.name}: ChromeDriver not found in system PATH")

        # Mode 3: Auto-download (requires internet)
        if driver_mode == 'auto_download':
            ColorPrint.blue(f"{self.name}: Attempting to download ChromeDriver...")
            from webdriver_manager.chrome import ChromeDriverManager
            downloaded_path = ChromeDriverManager().install()
            ColorPrint.green(f"{self.name}: Downloaded driver: {downloaded_path}")
            return Service(downloaded_path)

        # All methods failed - provide clear guidance
        error_msg = self._get_driver_not_found_error('ChromeDriver', driver_path, driver_mode)
        ColorPrint.red(error_msg)
        raise RuntimeError(error_msg)

    def _get_driver_not_found_error(self, driver_name: str, driver_path: str, driver_mode: str) -> str:
        """Generate driver not found error message (unified)"""
        return (
            f"\n"
            f"=================================================================\n"
            f" {driver_name} Not Found - Configuration Required\n"
            f"=================================================================\n"
            f"\n"
            f"Attempted methods:\n"
            f"  1. Local path: {driver_path if driver_path else 'Not configured'}\n"
            f"  2. System PATH: Not found\n"
            f"  3. Auto-download: Not attempted (driver_mode={driver_mode})\n"
            f"\n"
            f"SOLUTIONS:\n"
            f"\n"
            f"Option 1 (Recommended): Use 'auto' mode\n"
            f"  Config: {{\"driver_mode\": \"auto\"}}\n"
            f"  - First run requires internet to download driver\n"
            f"  - Subsequent runs use cached driver (offline)\n"
            f"\n"
            f"Option 2 (Offline): Manual driver installation\n"
            f"  1. Download {driver_name} from appropriate source\n"
            f"  2. Place at: D:\\drivers\\{driver_name.lower()}.exe (Windows)\n"
            f"  3. Config: {{\"driver_mode\": \"local\", \"driver_path\": \"D:/drivers/{driver_name.lower()}.exe\"}}\n"
            f"\n"
            f"Option 3: System PATH\n"
            f"  1. Download driver and add to system PATH\n"
            f"  2. Config: {{\"driver_mode\": \"system_path\"}}\n"
            f"\n"
            f"For diagnostic help, run:\n"
            f"  python pyapps/selenium_test/diagnose_v2.py\n"
            f"\n"
            f"================================================================="
        )

    def _launch_browser(self):
        """
        Launch Chrome browser (runs in thread context)

        This is called automatically when thread starts via start()

        Note:
            All errors propagate naturally for debugging.
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

        # Profile directory (unified parameter)
        # Support both 'profile_dir' (unified) and 'user_data_dir' (Chrome-specific, deprecated)
        profile_dir = self.config.get('profile_dir') or self.config.get('user_data_dir')
        if profile_dir:
            chrome_options.add_argument(f'--user-data-dir={profile_dir}')
            ColorPrint.blue(f"{self.name}: Using profile directory: {profile_dir}")

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

        # Get driver service with fallback chain (errors propagate)
        service = self._get_driver_service()

        # Launch Chrome (errors propagate)
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

        # Load cookies after browser launch
        self._load_cookies_on_launch()

    # ============================================
    # All common methods moved to ThreadedBrowser base class:
    # - new_tab, close_current_tab, switch_to_tab, get_tab_count
    # - screenshot, execute_script
    # - find_element, find_elements
    # - set_window_size, maximize_window
    # - get_cookies, add_cookie, delete_all_cookies
    # - save_cookies_manual, load_cookies_manual, list_cookie_profiles, delete_cookie_profile
    # ============================================

    def __repr__(self) -> str:
        """String representation"""
        status = "running" if self._running else "stopped"
        launched = "launched" if self.is_launched else "not launched"
        version = f"v{self.version}" if self.version else "unknown"
        return f"<ChromeBrowser name={self.name} status={status} browser={launched} version={version}>"
