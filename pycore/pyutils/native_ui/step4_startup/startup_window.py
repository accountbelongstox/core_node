#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import time
from pycore import THREAD_BUS
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
"""
Startup Window Helpers - ColorPrintCapture only

The only tk debug window implementation is TkinterStartupThread (startup_window_thread.py).
This file keeps ColorPrintCapture for redirecting ColorPrint/stdout/stderr to any object with log().
"""

import sys
import io

from pycore import ColorPrint


class ColorPrintCapture:
    """
    Capture ColorPrint output and redirect to TkinterStartupThread (or any object with log()).

    Usage:
        from pycore.pyutils.native_ui.startup_window_thread import TkinterStartupThread
        startup_thread = TkinterStartupThread(app_name="My App")
        startup_thread.start()
        capture = ColorPrintCapture(startup_thread)
        capture.start()

        ColorPrint.blue("Installing...")
        capture.stop()
        startup_thread.request_close()
    """

    def __init__(self, startup_window):
        """
        Args:
            startup_window: TkinterStartupThread or any instance with log(message, level) method
        """
        self.startup_window = startup_window
        self._original_stdout = None
        self._original_stderr = None
        self._capturing = False

    def start(self):
        """Start capturing ColorPrint output."""
        if self._capturing:
            return

        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr
        sys.stdout = self._StreamCapture(self.startup_window, "info")
        sys.stderr = self._StreamCapture(self.startup_window, "error")
        self._capturing = True

    def stop(self):
        """Stop capturing and restore original streams."""
        if not self._capturing:
            return
        sys.stdout = self._original_stdout
        sys.stderr = self._original_stderr
        self._capturing = False

    class _StreamCapture(io.StringIO):
        """Custom stream that captures output to startup window."""

        def __init__(self, startup_window, level: str):
            super().__init__()
            self.startup_window = startup_window
            self.level = level

        def write(self, text: str):
            if text and text.strip():
                self.startup_window.log(text.strip(), self.level)
            return len(text)


if __name__ == "__main__":

    def test():
        startup = TkinterStartupThread(app_name="Test Application")
        startup.start()
        if not THREAD_BUS.wait_signal("TkinterStartup_ready", timeout=3.0):
            print("Window ready timeout")
            return
        time.sleep(1)
        startup.log("Checking dependencies...", "info")
        time.sleep(1)
        startup.log("Done.", "success")
        time.sleep(1)
        startup.request_close()
        THREAD_BUS.wait_signal("TkinterStartup_closed", timeout=3.0)

    test()
