#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 UI Thread

Thread-safe PySide6 UI wrapper following project threading standards:
- Directly inherits threading.Thread (not using Thread(target=func))
- Uses THREAD_BUS for all communication
- No shared mutable state or cross-thread callbacks
"""

import threading
from typing import Optional, Dict, Any

from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_pyside6

# Ensure PySide6 is available before importing
get_third_package_pyside6()

from .framework import PySide6Framework
from .config import PySide6UIConfig, StartupWindowConfig


class PySide6UIThread(threading.Thread):
    """
    PySide6 UI Thread

    Follows project threading standards:
    - Direct Thread inheritance
    - THREAD_BUS communication
    - No parameter passing between threads
    - Clear state signals via THREAD_BUS
    """

    def __init__(
        self,
        ui_config: PySide6UIConfig,
        startup_config: Optional['StartupWindowConfig'] = None,
        daemon: bool = True
    ):
        """
        Initialize PySide6 UI thread

        Args:
            ui_config: PySide6 UI configuration
            startup_config: Startup window configuration (optional)
            daemon: Run as daemon thread (default: True)
        """
        super().__init__(name="PySide6UIThread", daemon=daemon)

        self.ui_config = ui_config
        self.startup_config = startup_config
        self.framework: Optional[PySide6Framework] = None
        self._started_event = threading.Event()

        ColorPrint.blue(f"[PySide6UIThread] Initialized - App: {ui_config.app_name}")

    def run(self):
        """Thread main execution - runs Qt event loop"""
        ColorPrint.green("[PySide6UIThread] Starting Qt event loop...")

        # Create framework instance
        self.framework = PySide6Framework(
            config=self.ui_config,
            startup_config=self.startup_config
        )

        # Signal that framework is created
        app_id = self.ui_config.app_id or self.ui_config.app_name.lower().replace(' ', '_')
        THREAD_BUS.trigger_event(f'{app_id}.thread.started', {
            'app_name': self.ui_config.app_name,
            'app_id': app_id
        })

        # Start framework (blocks until window closes)
        ColorPrint.green(f"[PySide6UIThread] Framework starting...")
        self.framework.start()

        # Signal that framework has stopped
        THREAD_BUS.trigger_event(f'{app_id}.thread.stopped', {})
        ColorPrint.yellow("[PySide6UIThread] Stopped")

    # ========== DEPRECATED METHODS (use THREAD_BUS events instead) ==========

    def request_stop(self):
        """
        DEPRECATED: Use THREAD_BUS.trigger_event('{app_id}.close', {}) instead

        Request thread to stop (called from other threads).
        This method actually uses THREAD_BUS internally, but direct usage is still discouraged.
        """
        ColorPrint.yellow(f"[PySide6UIThread] WARNING: request_stop() is deprecated, use THREAD_BUS event directly")
        if self.framework:
            # Get app_id for THREAD_BUS namespace
            app_id = self.ui_config.app_id or self.ui_config.app_name.lower().replace(' ', '_')
            ColorPrint.blue(f"[PySide6UIThread] Requesting stop via THREAD_BUS...")
            # Trigger close event (thread-safe via Qt signals)
            THREAD_BUS.trigger_event(f'{app_id}.close', {})

    def get_framework(self) -> Optional[PySide6Framework]:
        """
        DEPRECATED: Direct access to framework instance violates threading standards

        Get framework instance (for controlled access).
        This method is deprecated as it exposes internal state to other threads.
        """
        ColorPrint.yellow("[PySide6UIThread] WARNING: get_framework() is deprecated")
        return self.framework
