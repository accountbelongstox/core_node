#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Selenium Test Application - Main Entry Point

Demonstrates PyBrowser ThreadedBrowser library integration with UnifiedLauncher.
Tests browser automation capabilities in threaded mode.

Usage:
    python main.py
    # Or from project root:
    python pymain.py app=selenium_test
"""

import sys
import time
import json
import signal
from pathlib import Path
from typing import Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pylauncher import UnifiedLauncher, LauncherConfig


class SeleniumTestApp:
    """
    Selenium Test Application

    Demonstrates ThreadedBrowser usage through UnifiedLauncher service architecture.
    """

    def __init__(self):
        """Initialize application"""
        self.app_dir = Path(__file__).parent
        self.config_dir = self.app_dir / "config"
        self.screenshot_dir = self.app_dir / "screenshots"

        self.launcher: Optional[UnifiedLauncher] = None
        self.browser_config = None
        self.running = False

        # Signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle termination signals"""
        ColorPrint.yellow(f"\nReceived signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)

    def load_config(self):
        """Load application configuration"""
        ColorPrint.blue("=" * 60)
        ColorPrint.blue(" Loading Configuration")
        ColorPrint.blue("=" * 60)

        # Load launcher config
        launcher_config_path = self.config_dir / "launcher_config.json"
        if not launcher_config_path.exists():
            ColorPrint.red(f"Config file not found: {launcher_config_path}")
            raise FileNotFoundError(f"Missing config: {launcher_config_path}")

        ColorPrint.blue(f"Loading launcher config: {launcher_config_path}")
        launcher_config = LauncherConfig.from_json_file(str(launcher_config_path))

        # Load browser test config
        browser_config_path = self.config_dir / "browser_test_config.json"
        if browser_config_path.exists():
            ColorPrint.blue(f"Loading browser test config: {browser_config_path}")
            with open(browser_config_path, 'r', encoding='utf-8') as f:
                self.browser_config = json.load(f)
        else:
            ColorPrint.yellow(f"Browser test config not found, using defaults")
            self.browser_config = {
                'test_urls': ['https://google.com'],
                'screenshot_dir': 'screenshots',
                'test_duration': 30,
                'enable_screenshots': True,
                'navigation_delay': 3
            }

        ColorPrint.green("Configuration loaded successfully!\n")
        return launcher_config

    def setup_screenshot_dir(self):
        """Create screenshot directory if needed"""
        if self.browser_config.get('enable_screenshots', False):
            screenshot_dir = self.app_dir / self.browser_config.get('screenshot_dir', 'screenshots')
            screenshot_dir.mkdir(exist_ok=True)
            ColorPrint.blue(f"Screenshot directory: {screenshot_dir}")
            return screenshot_dir
        return None

    def run_browser_tests(self):
        """
        Run browser automation tests

        NOTE: This is a demonstration - the browser runs in the selenium_service thread.
        In a real application, you would interact with the browser through the service.
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue(" Running Browser Tests")
        ColorPrint.blue("=" * 60 + "\n")

        test_urls = self.browser_config.get('test_urls', ['https://google.com'])
        test_duration = self.browser_config.get('test_duration', 30)

        ColorPrint.blue(f"Test URLs: {', '.join(test_urls)}")
        ColorPrint.blue(f"Test duration: {test_duration} seconds")
        ColorPrint.yellow(f"\nNote: Browser is running in selenium_service thread")
        ColorPrint.yellow(f"The browser will remain open for {test_duration} seconds\n")

        # Wait for test duration
        start_time = time.time()
        try:
            while time.time() - start_time < test_duration:
                elapsed = int(time.time() - start_time)
                remaining = test_duration - elapsed

                if elapsed % 5 == 0 and elapsed > 0:
                    ColorPrint.blue(f"[{elapsed}s] Browser running... ({remaining}s remaining)")

                time.sleep(1)

                if not self.running:
                    break

        except KeyboardInterrupt:
            ColorPrint.yellow("\nTest interrupted by user")

        ColorPrint.green("\nBrowser tests completed!")

    def start(self):
        """
        Start application

        Main entry point for the application.
        """
        self.running = True

        try:
            ColorPrint.green("\n" + "=" * 60)
            ColorPrint.green(" Selenium Test Application")
            ColorPrint.green("=" * 60 + "\n")

            # Load configuration
            launcher_config = self.load_config()

            # Setup screenshot directory
            screenshot_dir = self.setup_screenshot_dir()

            # Print configuration summary
            ColorPrint.blue("\nConfiguration Summary:")
            ColorPrint.blue(f"  Browser Type: {launcher_config.selenium_service.browser_type}")
            ColorPrint.blue(f"  Headless: {launcher_config.selenium_service.headless}")
            ColorPrint.blue(f"  Test URLs: {len(self.browser_config.get('test_urls', []))}")
            ColorPrint.blue(f"  Screenshots: {'Enabled' if self.browser_config.get('enable_screenshots') else 'Disabled'}")

            # Create launcher
            ColorPrint.blue("\n" + "=" * 60)
            ColorPrint.blue(" Initializing Launcher")
            ColorPrint.blue("=" * 60 + "\n")

            self.launcher = UnifiedLauncher(launcher_config)

            # Start all enabled services (selenium_service in this case)
            ColorPrint.blue("\n" + "=" * 60)
            ColorPrint.blue(" Starting Services")
            ColorPrint.blue("=" * 60 + "\n")

            self.launcher.start_all()

            # Give browser time to fully initialize
            ColorPrint.yellow("\nWaiting for browser to be ready...")
            time.sleep(2)

            # Check if service is running
            status = self.launcher.get_status()
            if 'selenium_service' in status['services']:
                service_status = status['services']['selenium_service']
                if service_status.get('alive', False):
                    ColorPrint.green("✓ Selenium service is running!")
                else:
                    ColorPrint.red("✗ Selenium service failed to start")
                    return

            # Run browser tests
            self.run_browser_tests()

        except KeyboardInterrupt:
            ColorPrint.yellow("\nApplication interrupted by user")
        except Exception as e:
            ColorPrint.red(f"Application error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.stop()

    def stop(self):
        """Stop application and cleanup resources"""
        if not self.running:
            return

        self.running = False

        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue(" Shutting Down Application")
        ColorPrint.blue("=" * 60 + "\n")

        if self.launcher:
            self.launcher.stop_all()

        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" Application Stopped Successfully")
        ColorPrint.green("=" * 60 + "\n")


def start():
    """
    Entry point function

    This is the standard entry point called by pymain.py
    """
    app = SeleniumTestApp()
    app.start()


def main():
    """
    Main function for direct execution
    """
    start()


if __name__ == '__main__':
    main()
