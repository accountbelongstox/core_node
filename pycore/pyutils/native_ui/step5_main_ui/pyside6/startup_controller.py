#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StartupController - Tk bootstrap/startup window lifecycle mixin.

Provides the tkinter bootstrap window lifecycle for the PySide6 framework:
registering the auto-close handler, showing, closing and logging to the tk
window. These methods operate on framework instance state (self.startup_thread,
self.startup_config, self.config) and are mixed into PySide6Framework so the
public API (app.show_startup() / app.close_startup() / app.log_startup()) is
preserved verbatim.

This is a plain (non-QObject) mixin: it carries no Qt Signals and only
contributes methods, so it composes safely with the QObject-derived
ThreadBusBridgeMixin via cooperative multiple inheritance.
"""

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step4_startup.startup_window import ColorPrintCapture  # noqa: F401  (kept for legacy import compatibility)
from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusSignals


class StartupControllerMixin:
    """
    Mixin providing the tk bootstrap/startup window lifecycle.

    Expected on the concrete framework instance:
        self.startup_config  (StartupWindowConfig)
        self.config          (PySide6UIConfig)
        self.startup_thread  (Optional[TkinterStartupThread])
    """

    # ========== Startup Window (Tkinter) ==========

    def _register_startup_autoclose_handler(self):
        """Register event handler to auto-close startup window when third-party packages are loaded."""
        completion_signal = 'system.third_party_packages_loaded.completed'

        def handle_packages_loaded(event_data):
            """Handle system.third_party_packages_loaded event."""
            THREAD_BUS.signal('startup_window.initialization_complete', True)

            if self.startup_config.auto_close and self.startup_thread:
                ColorPrint.blue("[PySide6Framework] Third-party packages loaded, auto-closing startup window...")
                self.close_startup()
                ColorPrint.green("[PySide6Framework] Startup window auto-closed")
            else:
                if not self.startup_config.auto_close:
                    ColorPrint.yellow("[PySide6Framework] auto_close=False, keeping startup window as debug window")

        THREAD_BUS.register_event_handler('system.third_party_packages_loaded', handle_packages_loaded, priority=50)

        if self.startup_config.auto_close and THREAD_BUS.has_signal(completion_signal):
            ColorPrint.blue("[PySide6Framework] Startup completion signal already set, closing startup window now.")
            handle_packages_loaded(None)

    def show_startup(self):
        """Show startup window (tkinter) for dependency installation. Uses TkinterStartupThread (single tk build)."""
        if not self.startup_config.show_startup:
            return

        if not self.startup_thread:
            self.startup_thread = TkinterStartupThread(
                app_name=self.startup_config.app_name,
                width=self.startup_config.width,
                height=self.startup_config.height,
                icon_path=self.startup_config.icon_path,
                logo_path=None,
                enable_language_selector=True,
                enable_tray=False
            )
            self.startup_thread.start()
            ColorPrint.register_callback(self.startup_thread._colorprint_callback)

        # No .show() - thread already running

    def close_startup(self):
        """Close startup window via THREAD_BUS (TkinterStartupThread listens)."""
        if self.startup_thread:
            try:
                ColorPrint.unregister_callback(self.startup_thread._colorprint_callback)
            except Exception:
                pass
            THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': 'framework'}, async_mode=False)
            self.startup_thread = None

    def log_startup(self, message: str, level: str = "info"):
        """
        Log message to startup window.

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        if self.startup_thread:
            self.startup_thread.log(message, level)
