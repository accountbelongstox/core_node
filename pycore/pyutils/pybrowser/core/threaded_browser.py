#!/usr/bin/env python3
"""
Threaded Browser Base Class

Base class for browser instances that run in dedicated threads.
Each browser instance inherits from threading.Thread and manages its own lifecycle.

Pattern inspired by seleniumThread.py - each browser is a self-contained thread.
"""

import threading
import time
from queue import Queue, Empty
from typing import Dict, Any, Optional, Callable, List
from pathlib import Path
from pycore import ColorPrint
from pycore.pyutils.pybrowser.interfaces.ibrowser import IBrowser
from pycore.pyutils.pybrowser.utils.cookie_manager import CookieManager, LoadStrategy, SaveStrategy

# Import Selenium By for common element finding
try:
    from selenium.webdriver.common.by import By
except ImportError:
    By = None


class ThreadedBrowser(threading.Thread, IBrowser):
    """
    Base class for threaded browser instances

    Each browser instance runs in its own thread with:
    - Independent Selenium driver instance
    - Command queue for thread-safe operations
    - Event-driven lifecycle management
    - Automatic resource cleanup

    Usage:
        browser = ChromeBrowser(config={'headless': False})
        browser.start()  # Starts thread and launches browser
        browser.navigate('https://google.com')
        browser.stop()
        browser.join()  # Wait for cleanup
    """

    def __init__(self, config: Dict[str, Any] = None,
                 thread_name: str = None, daemon: bool = True):
        """
        Initialize threaded browser

        Args:
            config: Browser configuration dictionary
                Common options:
                - headless: bool (default: False)
                - profile_dir: Browser profile directory (unified for all browsers)
                - download_dir: Download directory
                - window_size: tuple (width, height)
                - cookie_config: Cookie persistence configuration
                    - enabled: bool (default: True)
                    - storage_dir: Custom cookie storage directory
                    - load_strategy: 'default', 'latest', 'specified', 'none'
                    - load_profile: Profile name (for 'specified' strategy)
                    - save_strategy: 'default', 'new', 'specified'
                    - save_profile: Profile name (for 'specified' strategy)
                    - auto_save: bool (default: True) - Save on shutdown
                    - realtime_save: bool (default: False) - Save after each navigation
                    - include_session_cookies: bool (default: True) - Load session cookies
                    - save_session_cookies: bool (default: True) - Save session cookies
            thread_name: Custom name for thread (default: auto-generated)
            daemon: Whether thread is daemon (default: True)
        """
        # Initialize Thread parent class
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Initialize IBrowser parent class
        IBrowser.__init__(self)

        # Configuration
        self.config = config or {}
        self.browser_type = None  # Set by subclass (chrome/edge/firefox)
        self.version = None  # Set by subclass after launch

        # Thread control
        self._running = False
        self._command_queue = Queue()
        self._result_queue = Queue()
        self._lock = threading.Lock()

        # Browser state (override IBrowser defaults)
        self.driver = None
        self.is_launched = False
        self.launch_time = None

        # Cookie management
        self._init_cookie_manager()

        ColorPrint.blue(f"ThreadedBrowser initialized: {self.name}")

    def _init_cookie_manager(self):
        """Initialize cookie manager with configuration"""
        cookie_config = self.config.get('cookie_config', {})

        # Default: cookie persistence is enabled
        if cookie_config.get('enabled', True):
            storage_dir = cookie_config.get('storage_dir')
            self.cookie_manager = CookieManager(storage_dir)

            # Load strategy configuration
            self.cookie_load_strategy: LoadStrategy = cookie_config.get('load_strategy', 'default')
            self.cookie_load_profile: Optional[str] = cookie_config.get('load_profile')

            # Save strategy configuration
            self.cookie_save_strategy: SaveStrategy = cookie_config.get('save_strategy', 'default')
            self.cookie_save_profile: Optional[str] = cookie_config.get('save_profile')

            # Auto-save and real-time save flags
            self.cookie_auto_save: bool = cookie_config.get('auto_save', True)
            self.cookie_realtime_save: bool = cookie_config.get('realtime_save', False)

            # Session cookie handling (new)
            # Default: Load and save ALL cookies (including session) for maximum compatibility
            self.cookie_include_session: bool = cookie_config.get('include_session_cookies', True)
            self.cookie_save_session: bool = cookie_config.get('save_session_cookies', True)

            ColorPrint.blue(
                f"{self.name}: Cookie persistence enabled "
                f"(load: {self.cookie_load_strategy}, save: {self.cookie_save_strategy}, "
                f"include_session: {self.cookie_include_session}, save_session: {self.cookie_save_session})"
            )
        else:
            self.cookie_manager = None
            ColorPrint.blue(f"{self.name}: Cookie persistence disabled")

    def run(self):
        """
        Thread entry point (called by start())

        Lifecycle:
            1. Launch browser
            2. Enter event loop (process commands)
            3. Cleanup on exit
        """
        try:
            self._running = True
            ColorPrint.green(f"Thread started: {self.name}")

            # Launch browser in this thread
            self._launch_browser()

            # Process commands until stopped
            self._event_loop()

        except Exception as e:
            ColorPrint.red(f"Thread error in {self.name}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self._cleanup()

    def _launch_browser(self):
        """
        Launch browser (implemented by subclass)

        Subclasses must override this to:
        1. Create Selenium driver
        2. Set self.driver
        3. Set self.is_launched = True
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement _launch_browser()"
        )

    def _event_loop(self):
        """
        Process commands from command queue

        Runs until _running is set to False.
        Commands are processed with timeout to allow checking _running flag.
        """
        while self._running:
            try:
                # Get command with timeout to allow exit check
                command = self._command_queue.get(timeout=0.1)
                self._process_command(command)
            except Empty:
                # Timeout - no command, continue loop
                pass
            except Exception as e:
                ColorPrint.red(f"Event loop error: {e}")

    def _process_command(self, command: Dict[str, Any]):
        """
        Process a single command

        Supported commands:
            - navigate: Navigate to URL
            - execute: Execute function in browser context
            - stop: Stop thread
            - custom: Subclass-specific commands

        Args:
            command: Command dictionary with 'type' and parameters
        """
        cmd_type = command.get('type')

        try:
            if cmd_type == 'navigate':
                self._cmd_navigate(command)
            elif cmd_type == 'execute':
                self._cmd_execute(command)
            elif cmd_type == 'get_attribute':
                self._cmd_get_attribute(command)
            elif cmd_type == 'stop':
                self._running = False
            else:
                # Allow subclass to handle custom commands
                self._process_custom_command(command)
        except Exception as e:
            ColorPrint.red(f"Command error ({cmd_type}): {e}")
            self._result_queue.put({'success': False, 'error': str(e)})

    def _cmd_navigate(self, command: Dict[str, Any]):
        """Navigate to URL"""
        url = command['url']
        if self.driver:
            self.driver.get(url)
            ColorPrint.blue(f"{self.name} navigated to: {url}")

            # Update cookies in real-time if enabled
            self._update_cookies_realtime()

            self._result_queue.put({'success': True, 'url': url})
        else:
            raise RuntimeError("Driver not initialized")

    def _cmd_execute(self, command: Dict[str, Any]):
        """Execute function in browser thread context"""
        func = command['function']
        args = command.get('args', ())
        kwargs = command.get('kwargs', {})

        # Execute function with driver as first arg
        result = func(self.driver, *args, **kwargs)
        self._result_queue.put({'success': True, 'result': result})

    def _cmd_get_attribute(self, command: Dict[str, Any]):
        """Get browser/driver attribute"""
        attr_name = command['attribute']
        result = getattr(self.driver, attr_name, None)
        self._result_queue.put({'success': True, 'result': result})

    def _process_custom_command(self, command: Dict[str, Any]):
        """
        Process custom command (override in subclass)

        Args:
            command: Command dictionary
        """
        ColorPrint.yellow(
            f"Unknown command type: {command.get('type')}"
        )

    def _load_cookies_on_launch(self):
        """Load cookies after browser launch (optimized with domain grouping)"""
        if not self.cookie_manager:
            return

        try:
            # Load cookies using configured strategy (with session cookie option)
            cookies = self.cookie_manager.load_cookies(
                strategy=self.cookie_load_strategy,
                profile_name=self.cookie_load_profile,
                include_session=self.cookie_include_session
            )

            if cookies and self.driver:
                # Group cookies by domain for optimized loading
                domain_groups = {}
                for cookie in cookies:
                    domain = cookie.get('domain', '')
                    if domain not in domain_groups:
                        domain_groups[domain] = []
                    domain_groups[domain].append(cookie)

                ColorPrint.blue(f"{self.name}: Loading cookies from {len(domain_groups)} domains...")

                # Navigate to a page first (cookies need domain context)
                current_url = self.driver.current_url
                if not current_url or current_url == 'data:,':
                    self.driver.get('about:blank')

                # Load cookies grouped by domain
                loaded_count = 0
                skipped_count = 0

                for domain, domain_cookies in domain_groups.items():
                    for cookie in domain_cookies:
                        try:
                            self.driver.add_cookie(cookie)
                            loaded_count += 1
                        except Exception as e:
                            # Cookie might be domain-specific, silently skip
                            skipped_count += 1
                            ColorPrint.debug(f"Skipped cookie {cookie.get('name')} (domain: {domain}): {e}")

                if loaded_count > 0:
                    ColorPrint.green(
                        f"{self.name}: Loaded {loaded_count}/{len(cookies)} cookies "
                        f"(skipped: {skipped_count}, domains: {len(domain_groups)})"
                    )

        except Exception as e:
            ColorPrint.yellow(f"{self.name}: Failed to load cookies: {e}")

    def _save_cookies_on_cleanup(self):
        """Save cookies before browser shutdown"""
        if not self.cookie_manager or not self.cookie_auto_save:
            return

        try:
            if self.driver:
                cookies = self.driver.get_cookies()

                if cookies:
                    # Determine save profile
                    save_profile = self.cookie_save_profile if self.cookie_save_strategy == 'specified' else None

                    # Save cookies (with session cookie option)
                    profile_name = self.cookie_manager.save_cookies(
                        cookies,
                        strategy=self.cookie_save_strategy,
                        profile_name=save_profile,
                        metadata={
                            'browser_type': self.browser_type,
                            'browser_version': self.version,
                            'thread_name': self.name
                        },
                        save_session_cookies=self.cookie_save_session
                    )

                    ColorPrint.green(
                        f"{self.name}: Saved cookies to profile: {profile_name}"
                    )

        except Exception as e:
            ColorPrint.red(f"{self.name}: Failed to save cookies on cleanup: {e}")

    def _update_cookies_realtime(self):
        """Update cookies in real-time (called after navigation if enabled)"""
        if not self.cookie_manager or not self.cookie_realtime_save:
            return

        try:
            if self.driver:
                cookies = self.driver.get_cookies()
                self.cookie_manager.update_cookies_realtime(
                    cookies,
                    save_session_cookies=self.cookie_save_session
                )

        except Exception as e:
            ColorPrint.debug(f"{self.name}: Real-time cookie update failed: {e}")

    def _cleanup(self):
        """Cleanup browser resources"""
        ColorPrint.blue(f"Cleaning up {self.name}...")

        # Save cookies before cleanup
        self._save_cookies_on_cleanup()

        with self._lock:
            if self.driver:
                try:
                    self.driver.quit()
                    ColorPrint.green(f"{self.name} driver closed")
                except Exception as e:
                    ColorPrint.red(f"Error closing driver: {e}")
                finally:
                    self.driver = None
                    self.is_launched = False

        ColorPrint.blue(f"{self.name} thread stopped")

    # ============================================
    # Public API (Thread-Safe Methods)
    # ============================================

    def navigate(self, url: str, wait_result: bool = False) -> Optional[Dict]:
        """
        Navigate to URL (thread-safe)

        Args:
            url: URL to navigate to
            wait_result: Wait for result (default: False)

        Returns:
            Result dict if wait_result=True, else None
        """
        self._command_queue.put({'type': 'navigate', 'url': url})

        if wait_result:
            return self._result_queue.get()
        return None

    def execute(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function in browser thread context

        The function will receive driver as first argument.

        Args:
            func: Function to execute (first arg will be driver)
            *args: Additional arguments
            **kwargs: Keyword arguments

        Returns:
            Function result

        Example:
            def get_title(driver):
                return driver.title

            title = browser.execute(get_title)
        """
        self._command_queue.put({
            'type': 'execute',
            'function': func,
            'args': args,
            'kwargs': kwargs
        })

        result = self._result_queue.get()
        if result.get('success'):
            return result.get('result')
        else:
            raise RuntimeError(result.get('error', 'Unknown error'))

    def get_driver_attribute(self, attribute: str) -> Any:
        """
        Get driver attribute (thread-safe)

        Args:
            attribute: Attribute name

        Returns:
            Attribute value
        """
        self._command_queue.put({
            'type': 'get_attribute',
            'attribute': attribute
        })

        result = self._result_queue.get()
        if result.get('success'):
            return result.get('result')
        return None

    def stop(self):
        """Stop browser thread (graceful shutdown)"""
        ColorPrint.blue(f"Stopping {self.name}...")
        self._command_queue.put({'type': 'stop'})

    def get_current_url(self) -> str:
        """Get current URL"""
        return self.get_driver_attribute('current_url')

    def get_title(self) -> str:
        """Get page title"""
        return self.get_driver_attribute('title')

    def is_running(self) -> bool:
        """Check if thread is running"""
        return self._running and self.is_alive()

    def wait_until_ready(self, timeout: float = 10.0) -> bool:
        """
        Wait until browser is ready

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            True if ready, False if timeout
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.is_launched and self.driver:
                return True
            time.sleep(0.1)
        return False

    def __repr__(self) -> str:
        """String representation"""
        status = "running" if self._running else "stopped"
        launched = "launched" if self.is_launched else "not launched"
        return f"<{self.__class__.__name__} name={self.name} status={status} browser={launched}>"

    # ============================================
    # IBrowser Interface Implementation
    # ============================================

    def launch(self, options: Dict[str, Any] = None) -> Any:
        """
        Launch the browser (starts the thread)

        Args:
            options: Browser launch options (merged with existing config)

        Returns:
            Browser driver instance (once ready)
        """
        if options:
            self.config.update(options)

        # Start the thread which will call _launch_browser
        self.start()

        # Wait until browser is ready
        if not self.wait_until_ready(timeout=30):
            raise RuntimeError(f"Browser failed to launch within timeout")

        return self.driver

    def close(self):
        """Close the browser (graceful shutdown)"""
        self.stop()
        self.join(timeout=10)

    def new_page(self, options: Dict[str, Any] = None) -> 'IPage':
        """
        Create a new page/tab

        Args:
            options: Page options

        Returns:
            IPage instance

        Note:
            For ThreadedBrowser, page creation is typically handled by Session.
            This method creates a new window/tab in the browser.
        """
        def _create_page(driver):
            # Open new tab
            driver.execute_script("window.open('about:blank', '_blank');")
            # Switch to new tab
            driver.switch_to.window(driver.window_handles[-1])

            # Create StandardPage wrapper
            from pycore.pyutils.pybrowser.implementations.pages.standard_page import StandardPage
            page = StandardPage(driver, options or {})
            page.initialize()
            return page

        return self.execute(_create_page)

    def get_version(self) -> Optional[str]:
        """
        Get browser version

        Returns:
            Version string or None
        """
        return self.version

    def get_pages(self) -> List['IPage']:
        """
        Get all open pages

        Returns:
            List of IPage instances

        Note:
            For ThreadedBrowser, this returns page wrappers for all window handles.
        """
        def _get_all_pages(driver):
            from pycore.pyutils.pybrowser.implementations.pages.standard_page import StandardPage
            pages = []
            original_handle = driver.current_window_handle

            for handle in driver.window_handles:
                driver.switch_to.window(handle)
                page = StandardPage(driver, {})
                page.is_initialized = True
                pages.append(page)

            # Switch back to original
            driver.switch_to.window(original_handle)
            return pages

        return self.execute(_get_all_pages)

    def is_connected(self) -> bool:
        """
        Check if browser is connected

        Returns:
            True if connected
        """
        return self.is_launched and self._running and self.driver is not None

    # ============================================
    # Common Browser Methods (Extracted from subclasses)
    # ============================================

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

        return self.execute(_open_tab, url)

    def close_current_tab(self) -> bool:
        """
        Close current tab (thread-safe)

        Returns:
            True if successful, False if only one tab
        """
        def _close_tab(driver):
            if len(driver.window_handles) > 1:
                driver.close()
                # Switch to first tab
                driver.switch_to.window(driver.window_handles[0])
                return True
            return False

        return self.execute(_close_tab)

    def switch_to_tab(self, index: int) -> bool:
        """
        Switch to tab by index (thread-safe)

        Args:
            index: Tab index (0-based)

        Returns:
            True if successful, False if index out of range
        """
        def _switch_tab(driver, tab_index):
            handles = driver.window_handles
            if 0 <= tab_index < len(handles):
                driver.switch_to.window(handles[tab_index])
                return True
            return False

        return self.execute(_switch_tab, index)

    def get_tab_count(self) -> int:
        """
        Get number of open tabs (thread-safe)

        Returns:
            Number of tabs
        """
        def _count_tabs(driver):
            return len(driver.window_handles)

        return self.execute(_count_tabs)

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

        return self.execute(_take_screenshot, filepath)

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
            WebElement or None if not found
        """
        def _find_elem(driver, locator_by, locator_value):
            if not By:
                raise ImportError("selenium.webdriver.common.by.By not available")

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

            # Check if element exists before finding
            elements = driver.find_elements(by_method, locator_value)
            if elements:
                return elements[0]
            return None

        return self.execute(_find_elem, by, value)

    def find_elements(self, by: str, value: str) -> list:
        """
        Find elements (thread-safe)

        Args:
            by: Locator strategy
            value: Locator value

        Returns:
            List of WebElements (empty list if none found)
        """
        def _find_elems(driver, locator_by, locator_value):
            if not By:
                raise ImportError("selenium.webdriver.common.by.By not available")

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
            return driver.find_elements(by_method, locator_value)

        return self.execute(_find_elems, by, value)

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

        return self.execute(_set_size, width, height)

    def maximize_window(self) -> bool:
        """
        Maximize window (thread-safe)

        Returns:
            True if successful
        """
        def _maximize(driver):
            driver.maximize_window()
            return True

        return self.execute(_maximize)

    def get_cookies(self) -> list:
        """
        Get all cookies (thread-safe)

        Returns:
            List of cookie dictionaries
        """
        def _get_cookies(driver):
            return driver.get_cookies()

        return self.execute(_get_cookies)

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

        return self.execute(_add_cookie, cookie_dict)

    def delete_all_cookies(self) -> bool:
        """
        Delete all cookies (thread-safe)

        Returns:
            True if successful
        """
        def _delete_cookies(driver):
            driver.delete_all_cookies()
            return True

        return self.execute(_delete_cookies)

    # ============================================
    # Cookie Management API (High-level)
    # ============================================

    def save_cookies_manual(self, profile_name: Optional[str] = None, save_session: Optional[bool] = None) -> str:
        """
        Manually save current cookies to profile

        Args:
            profile_name: Target profile name (None = use save_strategy)
            save_session: Whether to save session cookies (None = use configured value)

        Returns:
            Profile name that was saved to
        """
        if not self.cookie_manager:
            ColorPrint.yellow(f"{self.name}: Cookie persistence is disabled")
            return ""

        cookies = self.get_cookies()
        save_session_cookies = save_session if save_session is not None else self.cookie_save_session

        if profile_name:
            # Save to specified profile
            return self.cookie_manager.save_cookies(
                cookies,
                strategy='specified',
                profile_name=profile_name,
                metadata={'browser_type': self.browser_type},
                save_session_cookies=save_session_cookies
            )
        else:
            # Use configured strategy
            save_profile = self.cookie_save_profile if self.cookie_save_strategy == 'specified' else None
            return self.cookie_manager.save_cookies(
                cookies,
                strategy=self.cookie_save_strategy,
                profile_name=save_profile,
                metadata={'browser_type': self.browser_type},
                save_session_cookies=save_session_cookies
            )

    def load_cookies_manual(self, profile_name: str, include_session: Optional[bool] = None) -> bool:
        """
        Manually load cookies from profile

        Args:
            profile_name: Source profile name
            include_session: Whether to load session cookies (None = use configured value)

        Returns:
            True if successful
        """
        if not self.cookie_manager:
            ColorPrint.yellow(f"{self.name}: Cookie persistence is disabled")
            return False

        include_session_cookies = include_session if include_session is not None else self.cookie_include_session

        cookies = self.cookie_manager.load_cookies(
            strategy='specified',
            profile_name=profile_name,
            include_session=include_session_cookies
        )

        if cookies:
            # Delete existing cookies first
            self.delete_all_cookies()

            # Add loaded cookies
            success_count = 0
            for cookie in cookies:
                try:
                    self.add_cookie(cookie)
                    success_count += 1
                except Exception as e:
                    ColorPrint.debug(f"Failed to add cookie {cookie.get('name')}: {e}")

            ColorPrint.green(f"{self.name}: Loaded {success_count}/{len(cookies)} cookies")
            return success_count > 0

        return False

    def list_cookie_profiles(self) -> List[str]:
        """
        List available cookie profiles

        Returns:
            List of profile names
        """
        if not self.cookie_manager:
            return []

        return self.cookie_manager.list_profiles()

    def delete_cookie_profile(self, profile_name: str) -> bool:
        """
        Delete a cookie profile

        Args:
            profile_name: Profile name to delete

        Returns:
            True if successful
        """
        if not self.cookie_manager:
            return False

        return self.cookie_manager.delete_profile(profile_name)
