#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from .framework import PySide6Framework
"""
PySide6 UI Thread

Bootstrap order: show tk window first (no PySide6), wait ready, then load PySide6, then create main window.
"""

import threading
from typing import Optional, Dict, Any, TYPE_CHECKING

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from .config import PySide6UIConfig, StartupWindowConfig

from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
from pycore.pyfoundations.third_party.api import get_third_package_pyside6
from pycore.pyutils.native_ui.step5_main_ui.pyside6.framework import PySide6Framework


if TYPE_CHECKING:
    pass
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
        self._config_queue = f"native_ui.pyside6.config.{id(self)}"
        self._app_id_signal = f"native_ui.pyside6.app_id.{id(self)}"
        THREAD_BUS.send_message(self._config_queue, {
            "ui_config": ui_config,
            "startup_config": startup_config,
        })
        app_id = ui_config.app_id or ui_config.app_name.lower().replace(' ', '_')
        THREAD_BUS.signal(self._app_id_signal, app_id)

        ColorPrint.blue(f"[PySide6UIThread] Initialized - App: {ui_config.app_name}")

    def run(self):
        """Bootstrap: tk first (no PySide6), wait ready, then load PySide6, then create main window."""
        ColorPrint.green("[PySide6UIThread] Starting (tk bootstrap first, then PySide6)...")
        config = THREAD_BUS.receive_message(self._config_queue) or {}
        ui_config = config.get("ui_config")
        startup_config = config.get("startup_config")

        existing_startup_thread = None
        startup_config_for_framework = startup_config

        # 1. Show tk bootstrap window first (no PySide6 needed)
        if startup_config and startup_config.show_startup:
            ColorPrint.blue("[PySide6UIThread] Step 0: Showing tk bootstrap window (no PySide6 yet)...")
            existing_startup_thread = TkinterStartupThread(
                app_name=startup_config.app_name,
                width=getattr(startup_config, "width", 500),
                height=getattr(startup_config, "height", 400),
                icon_path=startup_config.icon_path,
                logo_path=None,
                enable_language_selector=True,
                enable_tray=False
            )
            existing_startup_thread.start()
            if THREAD_BUS.wait_signal("TkinterStartup_ready", timeout=10.0):
                ColorPrint.green("[PySide6UIThread] Tk bootstrap window ready")
            ColorPrint.register_callback(existing_startup_thread._colorprint_callback)
            # Framework will use this thread; do not show again
            startup_config_for_framework = StartupWindowConfig(
                app_name=startup_config.app_name,
                width=getattr(startup_config, "width", 500),
                height=getattr(startup_config, "height", 400),
                icon_path=startup_config.icon_path,
                show_startup=False,
                auto_close=startup_config.auto_close,
                daemon=startup_config.daemon
            )

        # 2. Load PySide6 (may install; logs go to tk window)
        ColorPrint.blue("[PySide6UIThread] Checking/installing PySide6...")
        get_third_package_pyside6()
        ColorPrint.green("[PySide6UIThread] PySide6 available")

        # 3. Create framework and main window (after tk is visible)
        framework = PySide6Framework(
            config=ui_config,
            startup_config=startup_config_for_framework,
            existing_startup_thread=existing_startup_thread
        )

        app_id = ui_config.app_id or ui_config.app_name.lower().replace(' ', '_')
        THREAD_BUS.trigger_event(f'{app_id}.thread.started', {
            'app_name': ui_config.app_name,
            'app_id': app_id
        })

        ColorPrint.green("[PySide6UIThread] Framework starting (main window)...")
        framework.start()

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
        app_id = THREAD_BUS.get_signal(self._app_id_signal, "")
        if app_id:
            ColorPrint.blue(f"[PySide6UIThread] Requesting stop via THREAD_BUS...")
            THREAD_BUS.trigger_event(f'{app_id}.close', {})

    def get_framework(self) -> Optional["PySide6Framework"]:
        """
        DEPRECATED: Direct access to framework instance violates threading standards

        Get framework instance (for controlled access).
        This method is deprecated as it exposes internal state to other threads.
        """
        ColorPrint.yellow("[PySide6UIThread] Direct framework access is unavailable")
        return None
