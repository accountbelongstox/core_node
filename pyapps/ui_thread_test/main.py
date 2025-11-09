#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Thread Test Application

This application demonstrates using pylauncher with configuration files
to start NativeUIThread as an independent service.

Features:
- Configuration file-based launcher
- NativeUIThread integration
- Custom UI content
- Multi-service coordination

Usage:
    python -m pyapps.ui_thread_test.main
"""

import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pylauncher import UnifiedLauncher, LauncherConfig
from pyapps.ui_thread_test.controller.ui_controller import UIController


class UIThreadTestApp:
    """
    UI Thread Test Application

    Demonstrates:
    - Loading configuration from JSON file
    - Starting NativeUIThread via pylauncher
    - Custom UI content creation
    - Service lifecycle management
    """

    def __init__(self):
        """Initialize application"""
        self.app_name = "UI Thread Test"
        self.launcher = None
        self.ui_controller = None

        ColorPrint.green("=" * 80)
        ColorPrint.green(f" {self.app_name} - Initialized")
        ColorPrint.green("=" * 80)

    def load_configuration(self) -> LauncherConfig:
        """
        Load configuration from JSON file

        Returns:
            LauncherConfig instance
        """
        config_file = Path(__file__).parent / "config" / "launcher_config.json"

        ColorPrint.blue(f"\nLoading configuration from: {config_file}")

        if config_file.exists():
            # Load from JSON file
            config = LauncherConfig.from_json_file(str(config_file))
            ColorPrint.green("Configuration loaded from file")
        else:
            # Use default configuration
            ColorPrint.yellow("Config file not found, using defaults")
            config = self._create_default_config()

            # Save default config for future reference
            config.save_to_json_file(str(config_file))
            ColorPrint.green(f"Default configuration saved to: {config_file}")

        return config

    def _create_default_config(self) -> LauncherConfig:
        """
        Create default configuration

        Returns:
            LauncherConfig with default settings
        """
        from pycore.pylauncher import UIServiceConfig

        config = LauncherConfig(
            ui_service=UIServiceConfig(
                app_name="UI Thread Test Application",
                window_size=(1000, 700),
                min_window_size=(800, 600),
                frameless=True,
                show_on_start=True,
                resizable=True,
                theme="dark",
                debug=True,
                enabled=True
            ),
            auto_start_all=False,  # Manual control
            startup_delay=0.5
        )

        # Disable other services for this test
        config.web_service.enabled = False
        config.mcp_service.enabled = False
        config.selenium_service.enabled = False

        return config

    def start(self):
        """Start application"""
        try:
            ColorPrint.blue("\n" + "=" * 80)
            ColorPrint.blue(" Starting Application")
            ColorPrint.blue("=" * 80 + "\n")

            # Load configuration
            config = self.load_configuration()

            # Create launcher
            ColorPrint.blue("Creating unified launcher...")
            self.launcher = UnifiedLauncher(config)

            # Create UI controller
            ColorPrint.blue("Creating UI controller...")
            self.ui_controller = UIController()

            # Register custom UI content callback
            config.ui_service.enabled = False  # Disable default UI service
            self._register_custom_ui_service(config)

            # Start UI thread service
            ColorPrint.blue("\nStarting UI thread service...")
            self.launcher.start_service('custom_ui_thread')

            ColorPrint.green("\n" + "=" * 80)
            ColorPrint.green(" Application Started Successfully")
            ColorPrint.green("=" * 80 + "\n")

            # Wait for services
            self.wait()

        except KeyboardInterrupt:
            ColorPrint.yellow("\nKeyboard interrupt received")
            self.stop()
        except Exception as e:
            ColorPrint.red(f"\nApplication error: {e}")
            import traceback
            traceback.print_exc()
            self.stop()

    def _register_custom_ui_service(self, config):
        """
        Register custom UI service with custom content

        Args:
            config: Launcher configuration
        """
        from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig

        def custom_ui_entry(ui_config):
            """Custom UI service entry point"""
            ColorPrint.green(f"[CustomUIThread] Starting UI thread with custom content")

            # Create UI thread configuration
            ui_thread_config = NativeUIThreadConfig(
                app_name=ui_config.app_name,
                width=ui_config.window_size[0],
                height=ui_config.window_size[1],
                show_on_start=ui_config.show_on_start,
                resizable=ui_config.resizable,
                frameless=ui_config.frameless,
                theme=ui_config.theme,
                debug=ui_config.debug,
                # Custom content callback
                on_create_content=self.ui_controller.create_ui_content,
                on_ready=lambda: ColorPrint.green("[CustomUIThread] UI is ready!"),
                on_close=lambda: ColorPrint.yellow("[CustomUIThread] UI is closing...")
            )

            # Create and start UI thread
            ui_thread = NativeUIThread(
                config=ui_thread_config,
                thread_name="CustomUIThread"
            )

            ui_thread.start()
            ui_thread.wait_until_ready()

            ColorPrint.green(f"[CustomUIThread] UI thread ready")

            # Keep thread running
            try:
                while ui_thread.is_running():
                    time.sleep(0.1)
            except Exception as e:
                ColorPrint.red(f"[CustomUIThread] Thread error: {e}")

            return ui_thread

        # Register custom service
        self.launcher.register_custom_service(
            service_name='custom_ui_thread',
            entry_point=custom_ui_entry,
            config=config.ui_service,
            daemon=True
        )

        ColorPrint.green("[CustomUIThread] Custom UI service registered")

    def wait(self):
        """Wait for services to finish"""
        try:
            ColorPrint.blue("Application running... Press Ctrl+C to stop\n")
            self.launcher.wait()
        except KeyboardInterrupt:
            ColorPrint.yellow("\nStopping application...")
            self.stop()

    def stop(self):
        """Stop application"""
        ColorPrint.yellow("\n" + "=" * 80)
        ColorPrint.yellow(" Stopping Application")
        ColorPrint.yellow("=" * 80 + "\n")

        if self.launcher:
            self.launcher.stop_all()

        ColorPrint.green("Application stopped")

    def get_status(self):
        """Get application status"""
        if self.launcher:
            return self.launcher.get_status()
        return {'running': False}


def start():
    """Application entry point"""
    app = UIThreadTestApp()
    app.start()


if __name__ == '__main__':
    start()
