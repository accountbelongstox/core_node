#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TkinterStartupThread - Thread-Safe Startup Window (orchestrator)

Follows project multi-threading standards:
- Directly inherits threading.Thread without target-based construction
- Uses THREAD_BUS for all communication (no callbacks or parameters)
- Signals ready/closed states via THREAD_BUS
- Main thread can wait for signals without blocking

Standard thread lifecycle:
1. __init__() - Initialize (no start)
2. start() - Start thread (from main thread)
3. run() - Thread execution (automatic)
4. THREAD_BUS signals:
   - 'TkinterStartup_ready' - Window is visible and running
   - 'TkinterStartup_closed' - Window closed by user or programmatically
   - 'TkinterStartup_stopped' - Thread finished

This module is the orchestrator. Pure Tkinter widget construction lives in
``startup_ui_builder`` and the tray-mode handoff lives in ``startup_tray_runner``.
Both are invoked from ``run()`` on the Tkinter thread (widgets are never created
at import time and never from a foreign thread).

Usage:
    from pycore import THREAD_BUS
    from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread

    # Start window
    startup = TkinterStartupThread(app_name="My App")
    startup.start()

    # Wait for ready
    if THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=3.0):
        print("Window is ready")

    # Add logs
    startup.log("Installing dependencies...")
    startup.set_status("Working...")

    # Close window
    startup.request_close()

    # Wait for closed
    THREAD_BUS.wait_signal('TkinterStartup_closed', timeout=3.0)
"""

import os
import threading
from typing import Optional, Any

from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_tkinter

# tkinter is needed here for type hints (tk.Tk / tk.Text / ttk.Progressbar ...) and
# for the tk constants used in _append_log / _cleanup. Resolved via third_party manager.
tk = get_third_package_tkinter()
ttk = tk.ttk

from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import BusSignals
from pycore.pyutils.native_ui.step4_startup import startup_ui_builder, startup_tray_runner


class TkinterStartupThread(threading.Thread):
    """
    Tkinter startup window thread

    Follows project standards:
    - Direct Thread inheritance
    - THREAD_BUS communication
    - No parameter passing
    - Clear state signals
    """

    def __init__(
        self,
        app_name: str = "Application",
        width: int = 500,
        height: int = 400,
        icon_path: Optional[str] = None,
        logo_path: Optional[str] = None,
        enable_language_selector: bool = True,
        enable_tray: bool = False
    ):
        """
        Initialize startup window thread

        Args:
            app_name: Application name to display
            width: Window width
            height: Window height
            icon_path: Path to window icon (.ico or .png)
            logo_path: Path to logo image (.png)
            enable_language_selector: Show language selector
            enable_tray: Enable system tray menu (persists after debug window closes)
        """
        super().__init__(name="TkinterStartupThread", daemon=False)

        # Thread control
        self._control_prefix = f'pyutils.native_ui.startup.{id(self)}'
        self._config_queue = f'{self._control_prefix}.config'
        self._stop_signal = f'{self._control_prefix}.stop'
        self._close_signal = f'{self._control_prefix}.close'
        self._running_signal = f'{self._control_prefix}.running'
        self._log_queue_name = f'{self._control_prefix}.logs'
        THREAD_BUS.send_message(self._config_queue, {
            "app_name": app_name,
            "width": width,
            "height": height,
            "icon_path": icon_path,
            "logo_path": logo_path,
            "enable_language_selector": bool(enable_language_selector),
            "enable_tray": bool(enable_tray),
        })
        THREAD_BUS.signal(self._running_signal, False)

    def run(self):
        """Thread execution (called automatically by start())"""
        thread_name = self.__class__.__name__
        config = THREAD_BUS.receive_message(self._config_queue) or {}
        self.app_name = config.get("app_name", "Application")
        self.width = int(config.get("width") or 500)
        self.height = int(config.get("height") or 400)
        self.icon_path = config.get("icon_path")
        self.logo_path = config.get("logo_path")
        self.enable_language_selector = bool(config.get("enable_language_selector", True))
        self.enable_tray = bool(config.get("enable_tray", False))
        self.root: Optional[tk.Tk] = None
        self.text_widget: Optional[tk.Text] = None
        self.progress_bar: Optional[ttk.Progressbar] = None
        self.status_label: Optional[tk.Label] = None
        self.language_var: Optional[tk.StringVar] = None
        self.language_frame: Optional[tk.Frame] = None
        self.tray: Optional[Any] = None

        # 1. Log startup
        ColorPrint.print_info(f"[{thread_name}] Thread starting")

        # 2. Set starting state
        THREAD_BUS.set_thread_state(thread_name, 'starting',
                                     pid=os.getpid(),
                                     thread_id=threading.get_ident())

        # 3. Set _running=True BEFORE initializing UI
        # CRITICAL: Must be set before initialize_ui() calls _process_logs()
        THREAD_BUS.signal(self._running_signal, True)

        # 4. Initialize UI (will call _process_logs() which needs _running=True).
        #    Called on the Tkinter thread - widgets are created here, not at import.
        startup_ui_builder.initialize_ui(self)

        # 5. Register THREAD_BUS handler for request_close (so singleton/shutdown can close window)
        def on_request_close(event_data):
            ColorPrint.print_info("[TkinterStartupThread] Received ui.startup.request_close via THREAD_BUS")
            THREAD_BUS.signal(self._stop_signal, True)
            self.request_close()

        THREAD_BUS.register_event_handler(BusSignals.STARTUP_REQUEST_CLOSE, on_request_close, priority=20)
        self._request_close_handler = on_request_close

        # 6. Set running state + send ready signal
        THREAD_BUS.set_thread_state(thread_name, 'running')
        THREAD_BUS.signal('TkinterStartup_ready', {
            'app_name': self.app_name,
            'window_size': (self.width, self.height)
        })

        # 7. Run mainloop (blocks until window closes)
        self.root.mainloop()

        # 8. Unregister request_close handler
        if getattr(self, '_request_close_handler', None):
            try:
                THREAD_BUS.unregister_event_handler(BusSignals.STARTUP_REQUEST_CLOSE, self._request_close_handler)
            except Exception:
                pass
            self._request_close_handler = None

        # 9. Cleanup window resources
        self._cleanup()

        # 10. Check if tray should be started
        ColorPrint.print_info(f"[{thread_name}] Mainloop ended, checking tray status...")
        ColorPrint.print_info(f"  enable_tray={self.enable_tray}")
        ColorPrint.print_info(f"  stop_requested={THREAD_BUS.has_signal(self._stop_signal)}")

        if self.enable_tray and not THREAD_BUS.has_signal(self._stop_signal):
            ColorPrint.print_info(f"[{thread_name}] Debug window closed, starting tray menu...")
            startup_tray_runner.run_tray_mode(self)
        else:
            if not self.enable_tray:
                ColorPrint.print_warn(f"[{thread_name}] Tray not enabled, skipping tray mode")
            if THREAD_BUS.has_signal(self._stop_signal):
                ColorPrint.print_warn(f"[{thread_name}] Stop event set, skipping tray mode")

        # 11. Set stopped state + send stopped signal
        THREAD_BUS.set_thread_state(thread_name, 'stopped')
        THREAD_BUS.signal('TkinterStartup_stopped', True)

        # 12. Log completion
        ColorPrint.print_info(f"[{thread_name}] Thread stopped")

    def _process_logs(self):
        """Process log messages from queue"""
        # Debug: Log every call to track execution
        # ColorPrint.print_info(f"[_process_logs] Called - running={self._running}, root={self.root is not None}, close_requested={self._close_requested.is_set()}")

        # IMPORTANT: Check close request FIRST, before checking _running
        # This ensures external close requests are processed even if window was closed by user
        if THREAD_BUS.has_signal(self._close_signal):
            running = bool(THREAD_BUS.get_signal(self._running_signal, False))
            ColorPrint.print_info(f"[TkinterStartupThread] Close requested, closing window... (root={self.root is not None}, running={running})")
            if self.root and running:
                ColorPrint.print_info("[TkinterStartupThread] Calling _close_window()...")
                self._close_window()
            else:
                ColorPrint.print_warn(f"[TkinterStartupThread] Cannot close: root={self.root is not None}, running={running}")
            return

        # Now check if we should continue processing
        if not THREAD_BUS.get_signal(self._running_signal, False) or not self.root:
            # ColorPrint.print_warn(f"[_process_logs] Stopping: running={self._running}, root={self.root is not None}")
            return

        # Process all pending logs
        while True:
            log_data = THREAD_BUS.receive_message(self._log_queue_name)
            if not isinstance(log_data, dict):
                break
            if log_data.get("kind") == "status":
                self._update_status_label(str(log_data.get("status") or ""))
            else:
                self._append_log(log_data['message'], log_data['level'])

        # Schedule next check
        if THREAD_BUS.get_signal(self._running_signal, False) and self.root:
            self.root.after(100, self._process_logs)

    def _append_log(self, message: str, level: str = "info"):
        """Append log message to text widget"""
        if not self.text_widget:
            return

        self.text_widget.config(state=tk.NORMAL)
        self.text_widget.insert(tk.END, message + "\n", level)
        self.text_widget.see(tk.END)
        self.text_widget.config(state=tk.DISABLED)

    def _cleanup(self):
        """Cleanup resources"""
        THREAD_BUS.signal(self._running_signal, False)

        # Stop progress bar BEFORE destroying window
        if self.progress_bar:
            try:
                self.progress_bar.stop()
            except:
                pass

        # Cancel all pending after callbacks
        if self.root:
            try:
                # Get all after callbacks and cancel them
                for after_id in self.root.tk.call('after', 'info'):
                    try:
                        self.root.after_cancel(after_id)
                    except:
                        pass
            except:
                pass

        # CRITICAL: Explicitly clean up Tkinter variables BEFORE destroying root
        # This prevents "RuntimeError: main thread is not in main loop" error
        # when Python's garbage collector tries to clean up StringVar.__del__
        # after the Tcl interpreter context has been destroyed
        if self.language_var:
            try:
                # Delete the variable while Tcl context is still valid
                del self.language_var
                self.language_var = None
            except:
                pass

    def _on_user_close(self):
        """
        Handle user attempting to close window

        Triggers global app.close event to ensure all components shut down properly.
        """
        self.log("User closed debug window, triggering global app shutdown...", "warning")

        # Trigger global app.close event (synchronous to ensure proper cleanup)
        THREAD_BUS.trigger_event('app.close', {
            'source': 'debug_window_close',
            'window': 'TkinterStartupThread'
        }, async_mode=False)

        # Close this window
        self._close_window()

    def _close_window(self):
        """Actually close the window"""
        ColorPrint.print_info("[TkinterStartupThread] _close_window() called")
        THREAD_BUS.signal(self._running_signal, False)

        # Send closed signal
        THREAD_BUS.signal('TkinterStartup_closed', True)
        ColorPrint.print_info("[TkinterStartupThread] Sent TkinterStartup_closed signal")

        # Destroy window
        if self.root:
            ColorPrint.print_info("[TkinterStartupThread] Destroying window...")
            self.root.quit()
            self.root.destroy()
            ColorPrint.print_info("[TkinterStartupThread] Window destroyed")
        else:
            ColorPrint.print_warn("[TkinterStartupThread] No root window to destroy")

    # ============ Public API (thread-safe) ============

    def log(self, message: str, level: str = "info"):
        """
        Add log message (thread-safe)

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        THREAD_BUS.send_message(self._log_queue_name, {
            'message': message,
            'level': level
        })

    def _colorprint_callback(self, message: str, color_type: str, log_level: str = None):
        """
        ColorPrint callback - receives all ColorPrint output.

        This is a bound method on purpose: callers register it via
        ``ColorPrint.register_callback(startup_thread._colorprint_callback)`` and
        unregister the same bound object (see launcher_with_startup,
        launch_native_app, startup_controller, ui_thread). It must stay a method
        on TkinterStartupThread so the registered/unregistered objects match.
        ``ColorPrintCapture`` (startup_window.py) is a separate stdout/stderr
        stream redirector and is NOT a replacement for this callback contract.

        Args:
            message: Message text
            color_type: Color type (green, red, yellow, blue, white, gray)
            log_level: Log level (SUCCESS, ERROR, WARNING, INFO, DEBUG)
        """
        # Map ColorPrint levels to startup window levels
        level_map = {
            "SUCCESS": "success",
            "ERROR": "error",
            "WARNING": "warning",
            "INFO": "info",
            "DEBUG": "debug",
        }
        level = level_map.get(log_level, "info") if log_level else "info"
        self.log(message, level)

    def set_status(self, status: str):
        """
        Update status label (thread-safe)

        Args:
            status: Status text
        """
        THREAD_BUS.send_message(self._log_queue_name, {
            "kind": "status",
            "status": status,
        })

    def _update_status_label(self, status: str):
        """
        Update status label text
        Called by set_status via root.after()

        Args:
            status: Status text
        """
        if self.status_label:
            self.status_label.config(text=status)

    def request_close(self):
        """
        Request window to close (thread-safe)
        Can be called from any thread

        IMPORTANT: Does not use root.after() to avoid "main thread is not in main loop" error.
        Instead, sets a flag that is checked by _process_logs() which runs in the Tkinter thread.

        ALSO: If this startup thread owns a tray, stop that tray immediately
        (the independent runtime tray must remain alive).
        """
        ColorPrint.print_info("[TkinterStartupThread] Close request received from external thread")
        THREAD_BUS.signal(self._close_signal, True)
        if getattr(self, "enable_tray", False) and getattr(self, "tray", None) is not None:
            THREAD_BUS.trigger_event("tray.request_stop", {})

    def stop(self):
        """
        Stop thread (window and tray if running)

        This will:
        1. Set stop event flag (prevents entering tray mode after window closes)
        2. Close debug window if still open
        3. Stop tray if it's running
        4. Terminate thread
        """
        ColorPrint.print_info("[TkinterStartupThread] Stop requested")

        # Signal stop event (prevents entering tray mode after window closes)
        THREAD_BUS.signal(self._stop_signal, True)

        if getattr(self, "enable_tray", False) and getattr(self, "tray", None) is not None:
            THREAD_BUS.trigger_event("tray.request_stop", {})
        self.request_close()

    def is_running(self) -> bool:
        """Check if window is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))


# Test
if __name__ == "__main__":
    import time
    from pycore import THREAD_BUS
    from pycore.pyutils.native_ui.step0_i18n import i18n, I18nKeys

    ColorPrint.print_info("=== Testing TkinterStartupThread ===")

    # Start window thread
    startup = TkinterStartupThread(app_name="Test Application")
    startup.start()

    # Wait for ready
    ColorPrint.print_warn("Waiting for window to be ready...")
    if THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=3.0):
        ColorPrint.print_success("Window is ready!")
    else:
        ColorPrint.print_error("Window startup timeout!")

    # Add logs
    startup.log("Checking dependencies...", "info")
    time.sleep(1)
    startup.log("Installing packages...", "info")
    time.sleep(1)
    startup.log("✓ Installation complete", "success")
    time.sleep(1)
    startup.set_status(i18n.get(I18nKeys.STARTUP_STATUS_READY))
    time.sleep(2)

    # Close window
    ColorPrint.print_warn("Closing window...")
    startup.request_close()

    # Wait for closed
    if THREAD_BUS.wait_signal('TkinterStartup_closed', timeout=3.0):
        ColorPrint.print_success("Window closed!")
    else:
        ColorPrint.print_error("Window close timeout!")

    # Wait for thread to stop
    if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
        ColorPrint.print_success("Thread stopped!")

    ColorPrint.print_info("\n=== Test Complete ===")
    ColorPrint.print_info(f"THREAD_BUS stats: {THREAD_BUS.stats()}")
