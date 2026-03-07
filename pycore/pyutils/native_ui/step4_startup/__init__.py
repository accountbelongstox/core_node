#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 4: Startup Window Module

Single tk debug window implementation: TkinterStartupThread (startup_window_thread.py).
Used by both launcher path (launch_native_app + show_debug_window) and framework (show_startup).
startup_window.py keeps only ColorPrintCapture helper.
"""

from pycore.pyutils.native_ui.step4_startup.startup_window import ColorPrintCapture
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread

__all__ = [
    "ColorPrintCapture",
    "TkinterStartupThread",
]
