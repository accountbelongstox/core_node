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
from typing import Dict, Any, Optional, Callable
from pycore import ColorPrint


class ThreadedBrowser(threading.Thread):
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
            thread_name: Custom name for thread (default: auto-generated)
            daemon: Whether thread is daemon (default: True)
        """
        # Initialize Thread parent class
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Configuration
        self.config = config or {}
        self.browser_type = None  # Set by subclass (chrome/edge/firefox)

        # Thread control
        self._running = False
        self._command_queue = Queue()
        self._result_queue = Queue()
        self._lock = threading.Lock()

        # Browser state
        self.driver = None
        self.is_launched = False
        self.launch_time = None

        ColorPrint.blue(f"ThreadedBrowser initialized: {self.name}")

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

    def _cleanup(self):
        """Cleanup browser resources"""
        ColorPrint.blue(f"Cleaning up {self.name}...")

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
