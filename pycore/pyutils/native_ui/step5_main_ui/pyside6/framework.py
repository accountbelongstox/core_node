#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Native UI Framework - Main Application Framework

Main framework class that integrates all components:
- Startup window (tkinter, shows before dependencies)
- Main window (PySide6, frameless with custom title bar)
- System tray
- WebView
- Tick timer thread

Thread Model:
- Main thread: Qt event loop (UI) - All GUI operations execute here
- Tick thread: Periodic tasks timer - Background timer thread
- Tray thread: System tray event loop - Separate thread for tray operations
- RPC v2 thread: FastAPI/Uvicorn server - HTTP/WebSocket server thread
- THREAD_BUS: Cross-thread event bus - Routes events safely between threads

IMPORTANT: All GUI operations (show/hide/move/resize) MUST execute in Qt main thread.
THREAD_BUS events use Qt signals to ensure thread safety.
"""

import sys
import os
import signal
import threading
import time
from typing import Optional, Callable, List
from pathlib import Path

from PySide6.QtCore import QObject, Signal, Slot, QTimer, Qt
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QIcon

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step4_startup.startup_window import StartupWindow, ColorPrintCapture

# Import PySide6 components
from .config import PySide6UIConfig, StartupWindowConfig, ActionType
from .main_window import PySide6MainWindow
from .title_bar import PySide6TitleBar
from .system_tray import (
    PySide6SystemTray,
    PySide6TrayMenuItem,
    create_default_tray_menu,
    create_i18n_event_driven_tray_menu
)
from .webview import PySide6WebView


class TickTimer(QObject):
    """
    Tick timer for periodic tasks.
    Runs in a separate thread.
    """

    # Signal to emit on each tick
    tick = Signal()

    def __init__(self, interval: float = 1.0, parent: Optional[QObject] = None):
        """
        Initialize tick timer.

        Args:
            interval: Tick interval in seconds
            parent: Parent QObject
        """
        super().__init__(parent)

        self.interval = interval
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Start tick timer thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop tick timer thread."""
        self._running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _run(self):
        """Tick timer thread main loop."""
        while self._running:
            # Emit tick signal
            self.tick.emit()

            # Sleep
            time.sleep(self.interval)


class PySide6Framework(QObject):
    """
    Main PySide6 UI Framework.

    This framework provides:
    1. Startup window (tkinter) - shows during dependency installation
    2. Main window (PySide6) - frameless with custom title bar
    3. System tray integration
    4. WebView for web-based UI
    5. Tick timer for periodic tasks

    Thread model:
    - Main thread: Qt event loop
    - Tick thread: Periodic timer (optional)

    Usage:
        # Create configuration
        config = PySide6UIConfig(
            app_name="My App",
            webview_url="http://localhost:3000"
        )

        # Create framework
        app = PySide6Framework(config)

        # Show startup window during initialization
        app.show_startup()
        # ... install dependencies ...
        app.close_startup()

        # Start main application
        app.start()
    """

    # Signals
    ready = Signal()
    closing = Signal()
    closed = Signal()
    tick = Signal()  # Forwarded from tick timer

    # Internal signals for thread-safe THREAD_BUS control
    # These signals ensure GUI operations execute in Qt main thread
    _thread_bus_show_signal = Signal()
    _thread_bus_hide_signal = Signal()
    _thread_bus_toggle_signal = Signal()
    _thread_bus_move_signal = Signal(int, int)  # x, y
    _thread_bus_resize_signal = Signal(int, int)  # width, height
    _thread_bus_close_signal = Signal()
    _thread_bus_minimize_signal = Signal()
    _thread_bus_maximize_signal = Signal()

    def __init__(
        self,
        config: Optional[PySide6UIConfig] = None,
        startup_config: Optional[StartupWindowConfig] = None
    ):
        """
        Initialize framework.

        Args:
            config: Main UI configuration
            startup_config: Startup window configuration
        """
        super().__init__()

        # Configuration
        self.config = config or PySide6UIConfig()
        # Default: No startup window (use TkinterStartupThread via launcher_with_startup.py instead)
        self.startup_config = startup_config or StartupWindowConfig(
            app_name=self.config.app_name,
<<<<<<< HEAD
            show_startup=True,  # Default: show startup window
            auto_close=True  # Default: auto-close when PySide6 starts
=======
            show_startup=False,  # Default: False (changed to avoid duplicate windows)
            auto_close=True
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        )

        # Qt Application
        self.qt_app: Optional[QApplication] = None

        # Components
        self.startup_window: Optional[StartupWindow] = None
        self.main_window: Optional[PySide6MainWindow] = None
        self.title_bar: Optional[PySide6TitleBar] = None
        self.webview: Optional[PySide6WebView] = None
        self.system_tray: Optional[PySide6SystemTray] = None
        self.tick_timer: Optional[TickTimer] = None

        # State
        self._started = False
        self._qt_app_created_internally = False

        # Register event handler for auto-closing startup window
        self._register_startup_autoclose_handler()

    # ========== Startup Window (Tkinter) ==========

    def _register_startup_autoclose_handler(self):
        """Register event handler to auto-close startup window when third-party packages are loaded."""
        def handle_packages_loaded(event_data):
            """Handle system.third_party_packages_loaded event"""
            # Set signal to mark initialization complete (thread-safe via THREAD_BUS)
            # StartupWindow will check this signal when user tries to close
            THREAD_BUS.signal('startup_window.initialization_complete', True)
            ColorPrint.green("[PySide6Framework] Set startup_window.initialization_complete signal")

            if self.startup_config.auto_close and self.startup_window:
                ColorPrint.blue("[PySide6Framework] Third-party packages loaded, auto-closing startup window...")
                self.close_startup()
                ColorPrint.green("[PySide6Framework] Startup window auto-closed")
            else:
                if not self.startup_config.auto_close:
                    ColorPrint.yellow("[PySide6Framework] auto_close=False, keeping startup window as debug window")

        THREAD_BUS.register_event_handler('system.third_party_packages_loaded', handle_packages_loaded, priority=50)

    def show_startup(self):
        """Show startup window (tkinter) for dependency installation."""
        if not self.startup_config.show_startup:
            return

        if not self.startup_window:
            self.startup_window = StartupWindow(
                app_name=self.startup_config.app_name,
                width=self.startup_config.width,
                height=self.startup_config.height,
                icon_path=self.startup_config.icon_path,
                on_complete=self.startup_config.on_complete,
                daemon=self.startup_config.daemon
            )

        self.startup_window.show()

    def close_startup(self):
        """Close startup window."""
        if self.startup_window:
            self.startup_window.close()
            self.startup_window = None

    def log_startup(self, message: str, level: str = "info"):
        """
        Log message to startup window.

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        if self.startup_window:
            self.startup_window.log(message, level)

    # ========== Main Application ==========

    def start(self):
        """Start main application (PySide6)."""
        ColorPrint.blue(f"[PySide6Framework] ========== START SEQUENCE BEGIN ==========")
        ColorPrint.blue(f"[PySide6Framework] Config: app_name={self.config.app_name}, app_id={self.config.app_id}")
        ColorPrint.blue(f"[PySide6Framework] Window size: {self.config.window_size}")
        ColorPrint.blue(f"[PySide6Framework] show_on_start: {self.config.show_on_start}")
        ColorPrint.blue(f"[PySide6Framework] enable_webview: {self.config.enable_webview}")
        ColorPrint.blue(f"[PySide6Framework] webview_url: {self.config.webview_url}")
        ColorPrint.blue(f"[PySide6Framework] enable_tray: {self.config.enable_tray}")
        ColorPrint.blue(f"[PySide6Framework] trigger_shutdown_on_close: {self.config.trigger_shutdown_on_close}")
        ColorPrint.blue(f"[PySide6Framework] Startup window: show={self.startup_config.show_startup}, auto_close={self.startup_config.auto_close}")

        if self._started:
            ColorPrint.yellow("[PySide6Framework] Already started, skipping")
            return

        # Show startup window if configured (for debug/log output)
        if self.startup_config.show_startup and not self.startup_window:
            ColorPrint.blue("[PySide6Framework] Step 0: Showing tk startup/debug window...")
            self.show_startup()
            ColorPrint.green("[PySide6Framework] Tk startup window is now visible (will capture ColorPrint output)")

        # Note: Startup window will auto-close when 'system.third_party_packages_loaded' event is received
        # This event is triggered by launcher after all services start (i.e., when next step begins)
        ColorPrint.blue("[PySide6Framework] Step 1: Startup window will auto-close after third-party packages loaded")
        ColorPrint.blue(f"[PySide6Framework] auto_close={self.startup_config.auto_close}")

        # Create Qt application if not exists
        ColorPrint.blue("[PySide6Framework] Step 2: Creating Qt application...")
<<<<<<< HEAD
=======

        # CRITICAL: Configure QtWebEngine BEFORE QApplication creation
        # This enables WebCodecs, WebGL, hardware acceleration for H.264 video streaming
        ColorPrint.blue("[PySide6Framework] Step 2.1: Configuring QtWebEngine (multi-tier redundant)...")
        from .webengine_config import configure_webengine_all_tiers
        webengine_results = configure_webengine_all_tiers()
        ColorPrint.green(f"[PySide6Framework] QtWebEngine configuration completed: {webengine_results}")

        # Suppress Qt CSS warnings for unsupported properties
        os.environ.setdefault('QT_LOGGING_RULES', 'qt.qpa.*.warning=false;*.debug=false')

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        if not QApplication.instance():
            self.qt_app = QApplication(sys.argv)
            self._qt_app_created_internally = True
            ColorPrint.green("[PySide6Framework] Created new QApplication instance")
        else:
            self.qt_app = QApplication.instance()
            ColorPrint.green("[PySide6Framework] Using existing QApplication instance")

        # Set application properties
        self.qt_app.setApplicationName(self.config.app_name)
        ColorPrint.blue(f"[PySide6Framework] Set app name: {self.config.app_name}")

        # Set Windows AppUserModelID for taskbar icon (Windows only)
        if sys.platform == 'win32':
            try:
                import ctypes
                # Use custom AppUserModelID if provided, otherwise auto-generate
                if self.config.app_user_model_id:
                    myappid = self.config.app_user_model_id
                else:
                    app_id = self.config.app_id or self.config.app_name.lower().replace(' ', '_')
                    myappid = f'pycore.{app_id}.1.0'
                ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
                ColorPrint.green(f"[PySide6Framework] Set Windows AppUserModelID: {myappid}")
            except Exception as e:
                ColorPrint.yellow(f"[PySide6Framework] Failed to set AppUserModelID: {e}")

        if self.config.icon_path and Path(self.config.icon_path).exists():
            icon = QIcon(self.config.icon_path)
            if icon.isNull():
                ColorPrint.red(f"[PySide6Framework] Failed to load icon from: {self.config.icon_path}")
            else:
                self.qt_app.setWindowIcon(icon)
                ColorPrint.green(f"[PySide6Framework] Set app icon: {self.config.icon_path}")
                ColorPrint.green(f"[PySide6Framework] Icon loaded successfully, available sizes: {icon.availableSizes()}")
        else:
            ColorPrint.yellow(f"[PySide6Framework] No icon path provided or file not found: {self.config.icon_path}")

        # Create components
        ColorPrint.blue("[PySide6Framework] Step 3: Creating components...")
        self._create_components()
        ColorPrint.green("[PySide6Framework] Components created")

        # Setup signal connections
        ColorPrint.blue("[PySide6Framework] Step 4: Setting up signal connections...")
        self._setup_connections()
        ColorPrint.green("[PySide6Framework] Signal connections established")

        # Show window if configured
        ColorPrint.blue("[PySide6Framework] Step 5: Checking if window should be shown...")
        if self.config.show_on_start:
            ColorPrint.green("[PySide6Framework] show_on_start=True, showing window now")
            self.main_window.show()
        else:
            ColorPrint.yellow("[PySide6Framework] show_on_start=False, window will NOT be shown automatically")
            ColorPrint.yellow("[PySide6Framework] Use tray menu 'Toggle Voice Subtitle' to show window")

        # Start tick timer if enabled
        if self.config.enable_tick_timer:
            ColorPrint.blue("[PySide6Framework] Starting tick timer...")
            self.tick_timer.start()

        # Emit ready signal
        ColorPrint.blue("[PySide6Framework] Step 6: Emitting ready signal...")
        self.ready.emit()

        # Call ready callback
        if self.config.on_ready:
            ColorPrint.blue("[PySide6Framework] Calling on_ready callback...")
            self.config.on_ready()

        self._started = True
        ColorPrint.green(f"[PySide6Framework] ========== START SEQUENCE COMPLETE ==========")
        ColorPrint.green(f"[PySide6Framework] Framework is now running")
        ColorPrint.green(f"[PySide6Framework] Window visible: {self.main_window.isVisible() if self.main_window else False}")

        # Start Qt event loop (blocking)
        if self._qt_app_created_internally:
            ColorPrint.blue("[PySide6Framework] Starting Qt event loop (blocking)...")
<<<<<<< HEAD
=======

            # Install signal handler for Ctrl+C (SIGINT)
            # This allows KeyboardInterrupt to properly close the application
            def signal_handler(signum, frame):
                """Handle Ctrl+C - trigger app.close event and quit Qt"""
                ColorPrint.yellow("\n[PySide6Framework] Ctrl+C received, closing application...")
                # Trigger app.close event for cleanup
                THREAD_BUS.trigger_event('app.close', {
                    'source': 'signal_interrupt',
                    'signal': signum
                }, async_mode=False)
                # Quit Qt application
                self.qt_app.quit()

            signal.signal(signal.SIGINT, signal_handler)

            # Use a timer to allow Python signal handlers to run periodically
            # Qt event loop needs to yield control for Python signal handling
            timer = QTimer()
            timer.timeout.connect(lambda: None)  # Empty slot to process signals
            timer.start(500)  # Check every 500ms

            ColorPrint.blue("[PySide6Framework] Signal handlers installed (Ctrl+C support enabled)")

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
            sys.exit(self.qt_app.exec())

    def _create_components(self):
        """Create UI components."""
        ColorPrint.blue("[PySide6Framework] Creating main window...")
        # Main window
        self.main_window = PySide6MainWindow(
            app_name=self.config.app_name,
            app_id=self.config.app_id or self.config.app_name.lower().replace(' ', '_'),
            width=self.config.window_size[0],
            height=self.config.window_size[1],
            frameless=self.config.frameless,
            icon_path=self.config.icon_path,
            cache_window_state=self.config.cache_window_state
        )
        ColorPrint.green(f"[PySide6Framework] Main window created: {self.config.window_size[0]}x{self.config.window_size[1]}, frameless={self.config.frameless}")

        # Title bar
        if self.config.enable_title_bar:
            ColorPrint.blue("[PySide6Framework] Creating title bar...")
            # Create custom styles from config
            custom_styles = {
                'bar_height': self.config.title_bar_height,
                'bar_bg_color': self.config.title_bar_bg,
                'title_color': self.config.title_bar_fg,
            }

            self.title_bar = PySide6TitleBar(
                app_name=self.config.app_name,
                logo_path=self.config.logo_path,
                menu_icon_path=self.config.menu_icon_path,
                custom_styles=custom_styles
            )
            self.main_window.set_title_bar(self.title_bar)
            ColorPrint.green("[PySide6Framework] Title bar created and attached")
        else:
            ColorPrint.yellow("[PySide6Framework] Title bar disabled")

        # WebView
        if self.config.enable_webview:
            ColorPrint.blue("[PySide6Framework] Creating WebView...")
            self.webview = PySide6WebView(
                enable_dev_tools=self.config.enable_dev_tools,
                enable_javascript=self.config.enable_javascript
            )
            ColorPrint.green(f"[PySide6Framework] WebView created: dev_tools={self.config.enable_dev_tools}")

            # Show loading page
            if self.config.enable_loading_page:
                ColorPrint.blue("[PySide6Framework] Showing loading page...")
                self.webview.show_loading_page(
                    html_path=self.config.loading_page_path,
                    style=self.config.loading_style,
                    text=self.config.loading_text,
                    background=self.config.loading_background
                )

            # Load URL with minimal delay (100ms for UI initialization)
            if self.config.webview_url:
<<<<<<< HEAD
                ColorPrint.blue(f"[PySide6Framework] Scheduling URL load (500ms delay): {self.config.webview_url}")
                QTimer.singleShot(500, lambda: self.webview.load_url(self.config.webview_url))
=======
                ColorPrint.blue(f"[PySide6Framework] Scheduling URL load (100ms delay): {self.config.webview_url}")
                QTimer.singleShot(100, lambda: self.webview.load_url(self.config.webview_url))
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798

            self.main_window.set_content(self.webview)
            ColorPrint.green("[PySide6Framework] WebView attached to main window")
        else:
            ColorPrint.yellow("[PySide6Framework] WebView disabled")

        # System tray
        if self.config.enable_tray:
            ColorPrint.blue("[PySide6Framework] Creating system tray...")
            self.system_tray = PySide6SystemTray(
                app_name=self.config.app_name,
                icon_path=self.config.tray_icon_path or self.config.icon_path
            )

            # Create default menu if no custom items
            if not self.config.tray_menu_items:
<<<<<<< HEAD
                ColorPrint.blue("[PySide6Framework] Creating default tray menu...")
                menu_items = create_default_tray_menu(
                    show_callback=self.show_window,
                    hide_callback=self.hide_window,
                    quit_callback=self.quit
=======
                ColorPrint.blue("[PySide6Framework] Creating default i18n event-driven tray menu...")
                # Use i18n + event-driven menu (automatically updates with language changes)
                menu_items = create_i18n_event_driven_tray_menu(
                    app_name=self.config.app_name,
                    enable_show_hide=True,
                    enable_maximize=True,
                    enable_restart=False  # Restart not implemented yet
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
                )
                self.system_tray.set_menu_items(menu_items)

            self.system_tray.show()
            ColorPrint.green("[PySide6Framework] System tray created and shown")
        else:
            ColorPrint.yellow("[PySide6Framework] System tray disabled (using external tray)")

        # Tick timer
        if self.config.enable_tick_timer:
            ColorPrint.blue(f"[PySide6Framework] Creating tick timer (interval={self.config.tick_interval}s)...")
            self.tick_timer = TickTimer(interval=self.config.tick_interval)
            ColorPrint.green("[PySide6Framework] Tick timer created")

    def _setup_connections(self):
        """Setup signal connections."""
        # Title bar connections
        if self.title_bar:
            self.title_bar.minimize_clicked.connect(self._on_minimize)
            self.title_bar.maximize_clicked.connect(self._on_maximize)
            self.title_bar.close_clicked.connect(self._on_close)

        # Main window connections
        if self.main_window:
            self.main_window.window_closing.connect(self._on_window_closing)
            self.main_window.window_closed.connect(self._on_window_closed)
            self.main_window.window_maximized.connect(
                lambda: self.title_bar.set_maximized(True) if self.title_bar else None
            )
            self.main_window.window_restored.connect(
                lambda: self.title_bar.set_maximized(False) if self.title_bar else None
            )

        # System tray connections
        if self.system_tray:
            self.system_tray.tray_double_clicked.connect(self.toggle_window)

        # Tick timer connections
        if self.tick_timer:
            self.tick_timer.tick.connect(self._on_tick)

        # THREAD_BUS internal signal connections (thread-safe)
        # These signals are emitted from THREAD_BUS event handlers (any thread)
        # and execute their slots in the Qt main thread automatically
        self._thread_bus_show_signal.connect(self.show_window)
        self._thread_bus_hide_signal.connect(self.hide_window)
        self._thread_bus_toggle_signal.connect(self.toggle_window)
        self._thread_bus_move_signal.connect(self._do_move_window)
        self._thread_bus_resize_signal.connect(self._do_resize_window)
        self._thread_bus_close_signal.connect(self.quit)
        self._thread_bus_minimize_signal.connect(self._do_minimize_window)
        self._thread_bus_maximize_signal.connect(self._do_maximize_window)

        # THREAD_BUS event listeners (always enabled)
        self._setup_thread_bus_listeners()

    # ========== Window Actions ==========

    @Slot()
    def _on_minimize(self):
        """Handle minimize action."""
        if self.config.minimize_to_tray:
            self.hide_window()
        else:
            self.main_window.minimize_window()

    @Slot()
    def _on_maximize(self):
        """Handle maximize/restore action."""
        self.main_window.toggle_maximize()

    @Slot()
    def _on_close(self):
        """Handle close action."""
        self.quit()

    @Slot()
    def _on_window_closing(self):
        """Handle window closing event."""
        self.closing.emit()

        # Call closing callback
        if self.config.on_closing:
            self.config.on_closing()

    @Slot()
    def _on_window_closed(self):
        """Handle window closed event."""
        self.closed.emit()

        # Call closed callback
        if self.config.on_closed:
            self.config.on_closed()

    @Slot()
    def _on_tick(self):
        """Handle tick timer event."""
        self.tick.emit()

    # ========== THREAD_BUS Signal Slots (Thread-Safe Helpers) ==========

    @Slot(int, int)
    def _do_move_window(self, x: int, y: int):
        """Move window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.move(x, y)

    @Slot(int, int)
    def _do_resize_window(self, width: int, height: int):
        """Resize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.resize(width, height)

    @Slot()
    def _do_minimize_window(self):
        """Minimize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.minimize_window()

    @Slot()
    def _do_maximize_window(self):
        """Toggle maximize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.toggle_maximize()

    # ========== Public Methods ==========

    def show_window(self):
        """Show main window."""
        if self.main_window:
            self.main_window.show_window()

    def hide_window(self):
        """Hide main window."""
        if self.main_window:
            self.main_window.hide_window()

    def toggle_window(self):
        """Toggle window visibility."""
        if self.main_window:
            if self.main_window.isVisible():
                self.hide_window()
            else:
                self.show_window()

    def quit(self):
<<<<<<< HEAD
        """Quit application."""
        # Trigger global shutdown if configured
=======
        """
        Quit application.

        This method can be called in two scenarios:
        1. Programmatically (e.g., tray menu exit) - triggers shutdown first
        2. After THREAD_BUS shutdown complete (cleanup and close window)
        """
        # Trigger global shutdown if configured and not already requested
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        if self.config.trigger_shutdown_on_close and not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[PySide6Framework] Triggering global shutdown via THREAD_BUS...")
            THREAD_BUS.request_shutdown(
                reason="UI window closed",
                execute_handlers=True
            )
<<<<<<< HEAD
            # Return early - shutdown handlers will clean up everything
            return

=======
            # Return early - shutdown handlers will call quit() again after shutdown complete
            return

        # Shutdown already complete or not needed - proceed with cleanup
        ColorPrint.blue("[PySide6Framework] Shutdown complete, cleaning up UI...")

>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        # Stop tick timer
        if self.tick_timer:
            self.tick_timer.stop()

        # Cleanup tray (hide and release resources)
        if self.system_tray:
            ColorPrint.blue("[PySide6Framework] Cleaning up system tray...")
            self.system_tray.cleanup()

        # Close window with force flag (bypasses close event protection)
        if self.main_window:
            ColorPrint.blue("[PySide6Framework] Closing main window (force_close=True)...")
            self.main_window._force_close = True  # Set flag to allow real close
            self.main_window.close()

        # Quit Qt application
        if self.qt_app:
            ColorPrint.blue("[PySide6Framework] Quitting Qt application...")
            self.qt_app.quit()

    def is_running(self) -> bool:
        """Check if application is running."""
        return self._started

    # ========== THREAD_BUS Integration ==========

    def _setup_thread_bus_listeners(self):
        """
        Setup THREAD_BUS event listeners for window control (always enabled).

        IMPORTANT: These event handlers may be called from ANY thread (Tray, RPC v2, etc.).
        They emit Qt signals which automatically execute in the Qt main thread for thread safety.
        """
        # Determine namespace: use thread_bus_namespace if provided, else use app_id, else 'ui'
        namespace = self.config.thread_bus_namespace
        if not namespace:
            namespace = self.config.app_id if self.config.app_id else "ui"

        # Define event names
        events = {
            f"{namespace}.show": self._on_thread_bus_show,
            f"{namespace}.hide": self._on_thread_bus_hide,
            f"{namespace}.toggle": self._on_thread_bus_toggle,
            f"{namespace}.move": self._on_thread_bus_move,
            f"{namespace}.resize": self._on_thread_bus_resize,
            f"{namespace}.close": self._on_thread_bus_close,
            f"{namespace}.minimize": self._on_thread_bus_minimize,
            f"{namespace}.maximize": self._on_thread_bus_maximize,
        }

        # Register event handlers
        for event_name, handler in events.items():
            THREAD_BUS.register_event_handler(event_name, handler)

        if self.config.debug:
            ColorPrint.green(f"[PySide6Framework] Registered THREAD_BUS listeners with namespace: {namespace}")

    def _on_thread_bus_show(self, event_data):
        """
        Handle show event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_show_signal.emit()

    def _on_thread_bus_hide(self, event_data):
        """
        Handle hide event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_hide_signal.emit()

    def _on_thread_bus_toggle(self, event_data):
        """
        Handle toggle event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_toggle_signal.emit()

    def _on_thread_bus_move(self, event_data):
        """
        Handle move event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.

        event_data expected format:
        {
            'x': int,  # X coordinate
            'y': int   # Y coordinate
        }
        """
        if isinstance(event_data, dict):
            x = event_data.get('x')
            y = event_data.get('y')
            if x is not None and y is not None:
                self._thread_bus_move_signal.emit(int(x), int(y))

    def _on_thread_bus_resize(self, event_data):
        """
        Handle resize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.

        event_data expected format:
        {
            'width': int,   # Width
            'height': int   # Height
        }
        """
        if isinstance(event_data, dict):
            width = event_data.get('width')
            height = event_data.get('height')
            if width is not None and height is not None:
                self._thread_bus_resize_signal.emit(int(width), int(height))

    def _on_thread_bus_close(self, event_data):
        """
        Handle close event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_close_signal.emit()

    def _on_thread_bus_minimize(self, event_data):
        """
        Handle minimize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_minimize_signal.emit()

    def _on_thread_bus_maximize(self, event_data):
        """
        Handle maximize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_maximize_signal.emit()

    # ========== WebView Methods ==========

    def load_url(self, url: str):
        """Load URL in webview."""
        if self.webview:
            self.webview.load_url(url)

    def load_html(self, html: str, base_url: Optional[str] = None):
        """Load HTML in webview."""
        if self.webview:
            self.webview.load_html(html, base_url)

    def execute_javascript(self, script: str, callback: Optional[callable] = None):
        """Execute JavaScript in webview."""
        if self.webview:
            self.webview.execute_javascript(script, callback)


# Convenience function
def create_framework(
    app_name: str = "Application",
    window_size: tuple = (1280, 800),
    webview_url: Optional[str] = None,
    enable_tray: bool = True,
    show_startup: bool = True,
    **kwargs
) -> PySide6Framework:
    """
    Create PySide6 framework with simple configuration.

    Args:
        app_name: Application name
        window_size: Window size (width, height)
        webview_url: URL to load in webview
        enable_tray: Enable system tray
        show_startup: Show startup window
        **kwargs: Additional configuration options

    Returns:
        PySide6Framework instance
    """
    config = PySide6UIConfig(
        app_name=app_name,
        window_size=window_size,
        webview_url=webview_url,
        enable_tray=enable_tray,
        **kwargs
    )

    startup_config = StartupWindowConfig(
        app_name=app_name,
        show_startup=show_startup
    )

    return PySide6Framework(config, startup_config)
