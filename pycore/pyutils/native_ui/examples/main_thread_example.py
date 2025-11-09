#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Main Thread Method Example
Demonstrates main thread method registration and invocation
"""

import sys
import os
import time
import threading

# Add project root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from pycore.pyutils.native_ui import (
    NativeUIFramework,
    UIConfig,
    SignalType,
    Signal
)
from pycore.pyfoundations.color_print import ColorPrint


class MainThreadDemoApp(NativeUIFramework):
    """Main thread method demonstration application"""

    def __init__(self):
        config = UIConfig(
            app_name="Main Thread Method Example",
            window_size=(800, 600),
            show_on_start=True,
            debug=True
        )

        super().__init__(config)

        # Application state
        self.custom_data = {"count": 0}

        # Register custom main thread methods
        self._register_custom_methods()

        # Register signal handlers
        self.register_signal_handler(SignalType.UI_READY, self._on_ui_ready)

    def _register_custom_methods(self):
        """Register custom main thread methods"""
        # Register a data update method
        self.register_main_method('update_data', self._main_update_data)

        # Register a message display method
        self.register_main_method('show_message', self._main_show_message)

    def _main_update_data(self, value: int):
        """Main thread method: Update data"""
        self.custom_data["count"] += value
        ColorPrint.green(f"[MainThread] Data updated: count = {self.custom_data['count']}")

    def _main_show_message(self, message: str):
        """Main thread method: Display message"""
        ColorPrint.cyan(f"[MainThread] Message: {message}")

    def _on_ui_ready(self, signal: Signal):
        """UI ready callback"""
        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" Main Thread Method Demo Application Started")
        ColorPrint.green("=" * 60)
        ColorPrint.cyan("\nDemo Description:")
        ColorPrint.cyan("- Background thread will periodically call main thread methods")
        ColorPrint.cyan("- Main thread methods execute safely in main thread")
        ColorPrint.green("\n" + "=" * 60 + "\n")

        # Start background thread to simulate calls
        self._start_background_thread()

    def _start_background_thread(self):
        """Start background thread to simulate main thread method calls"""
        def background_task():
            time.sleep(2)

            for i in range(5):
                # Call main thread method from background thread
                ColorPrint.yellow(f"\n[BackgroundThread] Calling main thread method #{i+1}")

                # Call update_data method
                self.call_main_method('update_data', value=10)

                time.sleep(1)

                # Call show_message method
                self.call_main_method('show_message', message=f"This is message #{i+1}")

                time.sleep(2)

        thread = threading.Thread(target=background_task, daemon=True)
        thread.start()


def main():
    """Main function"""
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(" Native UI Framework - Main Thread Method Example")
    ColorPrint.blue("=" * 60)

    app = MainThreadDemoApp()
    app.start()


if __name__ == '__main__':
    main()
