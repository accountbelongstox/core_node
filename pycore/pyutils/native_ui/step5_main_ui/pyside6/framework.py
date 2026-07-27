#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Native UI Framework - Main Application Framework

Main framework class that integrates all components:
- Startup window (tkinter, shows before dependencies)  [startup_controller.StartupControllerMixin]
- Main window (PySide6, frameless with custom title bar)
- System tray
- WebView
- Tick timer thread                                       [tick_timer.TickTimer]

Thread Model:
- Main thread: Qt event loop (UI) - All GUI operations execute here
- Tick thread: Periodic tasks timer - Background timer thread
- Tray thread: System tray event loop - Separate thread for tray operations
- RPC v2 thread: FastAPI/Uvicorn server - HTTP/WebSocket server thread
- THREAD_BUS: Cross-thread event bus - Routes events safely between threads

IMPORTANT: All GUI operations (show/hide/move/resize) MUST execute in Qt main thread.
THREAD_BUS events use Qt signals to ensure thread safety. The THREAD_BUS window-control
signals, listeners and slots live in thread_bus_bridge.ThreadBusBridgeMixin (a QObject
base mixin this class inherits) so the Signals are declared in a QObject class body and
bind correctly. The tk startup window lifecycle lives in startup_controller.

This module re-exports TickTimer / create_framework for backwards compatibility with
``from .framework import PySide6Framework, TickTimer, create_framework``.
"""

import sys
import os
import signal
import threading
from typing import Optional, TYPE_CHECKING
from pathlib import Path

from PySide6.QtCore import QObject, Signal, Slot, QTimer
from PySide6.QtWidgets import QApplication, QSystemTrayIcon
from PySide6.QtGui import QIcon

from pycore import THREAD_BUS, ColorPrint

if TYPE_CHECKING:
    from pycore.pyutils.native_ui.step4_startup.startup_window_thread import TkinterStartupThread

# Import PySide6 components
from .config import PySide6UIConfig, StartupWindowConfig, ActionType
from .main_window import PySide6MainWindow
from .title_bar import PySide6TitleBar
from .system_tray import (
    PySide6SystemTray,
    PySide6TrayMenuItem,
    create_default_tray_menu,
    create_i18n_event_driven_tray_menu,
    build_pyside6_menu_from_dicts
)
from .webview import PySide6WebView

# Split-out sub-modules (re-exported for backwards compatibility)
from .tick_timer import TickTimer
from .thread_bus_bridge import ThreadBusBridgeMixin
from .startup_controller import StartupControllerMixin

from pycore.pyutils.native_ui.step5_main_ui.pyside6.webengine_config import configure_webengine_all_tiers

import ctypes




class PySide6Framework(ThreadBusBridgeMixin, StartupControllerMixin):
    """
    Main PySide6 UI Framework.

    Inherits:
        - ThreadBusBridgeMixin(QObject): carries the 10 THREAD_BUS control
          Signals + their wiring/handlers/slots. QObject base so Signals bind.
        - StartupControllerMixin: tk bootstrap window lifecycle methods.

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

    def __init__(
        self,
        config: Optional[PySide6UIConfig] = None,
        startup_config: Optional[StartupWindowConfig] = None,
        existing_startup_thread: Optional["TkinterStartupThread"] = None
    ):
        """
        Initialize framework.

        Args:
            config: Main UI configuration
            startup_config: Startup window configuration
            existing_startup_thread: If set, use this tk bootstrap window (already shown by ui_thread); do not create another
        """
        super().__init__()

        # Configuration
        self.config = config or PySide6UIConfig()
        # Default: No startup window (use TkinterStartupThread via launcher_with_startup.py instead)
        self.startup_config = startup_config or StartupWindowConfig(
            app_name=self.config.app_name,
            show_startup=False,  # Default: False (changed to avoid duplicate windows)
            auto_close=True
        )

        # Qt Application
        self.qt_app: Optional[QApplication] = None

        # Components (existing_startup_thread = tk shown first in ui_thread before PySide6 load)
        self.startup_thread = existing_startup_thread
        self.main_window: Optional[PySide6MainWindow] = None
        self.title_bar: Optional[PySide6TitleBar] = None
        self.webview: Optional[PySide6WebView] = None
        self.system_tray: Optional[PySide6SystemTray] = None
        self.tick_timer: Optional[TickTimer] = None

        # State
        self._started = False
        self._qt_app_created_internally = False

        # Register event handler for auto-closing startup window (StartupControllerMixin)
        self._register_startup_autoclose_handler()

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

        # Step 0: Tk bootstrap window first (no PySide6 needed). Use existing if ui_thread already showed it.
        if self.startup_thread:
            ColorPrint.green("[PySide6Framework] Using existing tk bootstrap window (shown before PySide6 load)")
        elif self.startup_config.show_startup:
            ColorPrint.blue("[PySide6Framework] Step 0: Showing tk bootstrap/debug window...")
            self.show_startup()
            # Wait for tk window to be visible before creating Qt/main window (correct order: tk first, then big window)
            if THREAD_BUS.wait_signal("TkinterStartup_ready", timeout=10.0):
                ColorPrint.green("[PySide6Framework] Tk bootstrap window ready (will capture ColorPrint output)")
            else:
                ColorPrint.yellow("[PySide6Framework] Tk bootstrap window ready timeout, continuing...")

        # Note: Startup window will auto-close when 'system.third_party_packages_loaded' event is received
        ColorPrint.blue("[PySide6Framework] Step 1: Startup window will auto-close after third-party packages loaded")
        ColorPrint.blue(f"[PySide6Framework] auto_close={self.startup_config.auto_close}")

        # Step 2: Create Qt application and main window (after tk bootstrap is visible)
        ColorPrint.blue("[PySide6Framework] Step 2: Creating Qt application...")

        # CRITICAL: Configure QtWebEngine BEFORE QApplication creation
        # This enables WebCodecs, WebGL, hardware acceleration for H.264 video streaming
        ColorPrint.blue("[PySide6Framework] Step 2.1: Configuring QtWebEngine (multi-tier redundant)...")
        webengine_results = configure_webengine_all_tiers()
        ColorPrint.green(f"[PySide6Framework] QtWebEngine configuration completed: {webengine_results}")

        # Suppress Qt CSS warnings for unsupported properties
        os.environ.setdefault('QT_LOGGING_RULES', 'qt.qpa.*.warning=false;*.debug=false')

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

        # CRITICAL: this is a tray-resident app whose lifecycle is owned by
        # THREAD_BUS, NOT by window visibility. Qt defaults quitOnLastWindowClosed
        # to True, which would end the event loop the moment the last visible
        # window closes (e.g. user closes the window expecting close_to_tray, or a
        # transient WebEngine window goes away) - and exec() returning in the UI
        # worker thread silently kills that thread. Disable it so only an explicit
        # THREAD_BUS shutdown (tray Exit / singleton takeover / Ctrl+C) tears down.
        self.qt_app.setQuitOnLastWindowClosed(False)
        ColorPrint.blue("[PySide6Framework] quitOnLastWindowClosed=False (lifecycle owned by THREAD_BUS)")

        # Set Windows AppUserModelID for taskbar icon (Windows only)
        if sys.platform == 'win32':
            try:
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

            # Install signal handler for Ctrl+C (SIGINT) only in main thread
            # signal.signal() raises ValueError if called from a non-main thread (e.g. PySide6UIThread)
            if threading.current_thread() is threading.main_thread():
                def signal_handler(signum, frame):
                    """Handle Ctrl+C - trigger app.close event and quit Qt"""
                    ColorPrint.yellow("\n[PySide6Framework] Ctrl+C received, closing application...")
                    THREAD_BUS.trigger_event('app.close', {
                        'source': 'signal_interrupt',
                        'signal': signum
                    }, async_mode=False)
                    self.qt_app.quit()
                signal.signal(signal.SIGINT, signal_handler)
                ColorPrint.blue("[PySide6Framework] Signal handlers installed (Ctrl+C support enabled)")
            else:
                ColorPrint.blue("[PySide6Framework] Running in worker thread, SIGINT handled by main process")

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
            cache_window_state=self.config.cache_window_state,
            close_to_tray=self.config.close_to_tray
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
                ColorPrint.blue(f"[PySide6Framework] Scheduling URL load (100ms delay): {self.config.webview_url}")
                QTimer.singleShot(100, lambda: self.webview.load_url(self.config.webview_url))

            self.main_window.set_content(self.webview)
            ColorPrint.green("[PySide6Framework] WebView attached to main window")
        else:
            ColorPrint.yellow("[PySide6Framework] WebView disabled")

        # System tray
        if self.config.enable_tray and not QSystemTrayIcon.isSystemTrayAvailable():
            # Native tray requested but the OS has no system tray available.
            # Hand off to the pystray fallback (kept as code-only; started on demand).
            ColorPrint.yellow("[PySide6Framework] Native system tray unavailable, requesting pystray fallback...")
            THREAD_BUS.trigger_event('tray.native_unavailable', {})
        elif self.config.enable_tray:
            ColorPrint.blue("[PySide6Framework] Creating system tray...")
            self.system_tray = PySide6SystemTray(
                app_name=self.config.app_name,
                icon_path=self.config.tray_icon_path or self.config.icon_path
            )

            if self.config.tray_menu_items:
                # Custom menu provided as canonical dicts (e.g. app-specific rich menu)
                ColorPrint.blue("[PySide6Framework] Building custom tray menu from config...")
                self.system_tray.set_menu_items(
                    build_pyside6_menu_from_dicts(self.config.tray_menu_items)
                )
            else:
                ColorPrint.blue("[PySide6Framework] Creating default i18n event-driven tray menu...")
                # Use i18n + event-driven menu (automatically updates with language changes)
                menu_items = create_i18n_event_driven_tray_menu(
                    app_name=self.config.app_name,
                    enable_show_hide=True,
                    enable_maximize=True,
                    enable_restart=False  # Restart not implemented yet
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
            # Hidden-to-tray (close_to_tray) also updates the published visibility state
            self.main_window.window_hidden.connect(lambda: self._publish_window_visible(False))

        # Web page title -> custom title bar + window title. This lets the embedded
        # web UI drive the native title: the React app sets document.title from its
        # i18n table, so switching language in the web also retitles the simulated
        # title bar (and the taskbar entry). No-op if the title is empty.
        if self.webview is not None:
            def _sync_web_title(title: str):
                if not title:
                    return
                if self.title_bar:
                    self.title_bar.update_title(title)
                if self.main_window:
                    self.main_window.setWindowTitle(title)
            self.webview.title_changed.connect(_sync_web_title)

        # System tray connections
        if self.system_tray:
            self.system_tray.tray_double_clicked.connect(self.toggle_window)

        # Tick timer connections
        if self.tick_timer:
            self.tick_timer.tick.connect(self._on_tick)

        # THREAD_BUS internal signal connections + event listeners (ThreadBusBridgeMixin).
        # Emits from any thread, slots run in the Qt main thread automatically.
        self._setup_thread_bus_bridge()

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
        """Handle close action (custom title-bar close button)."""
        # When the window lives in the tray, the close button hides it instead of
        # quitting; the tray "Exit" remains the real quit path. Consistent with
        # the native close button (MainWindow.closeEvent close_to_tray branch).
        if self.config.close_to_tray:
            ColorPrint.blue("[PySide6Framework] close_to_tray: hiding window instead of quitting")
            self.hide_window()
            return
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

    # ========== Public Methods ==========

    def _publish_window_visible(self, visible: bool):
        """Publish window visibility so the tray menu can reflect it (state_getter)."""
        namespace = self.config.thread_bus_namespace or self.config.app_id or "ui"
        THREAD_BUS.signal(f"{namespace}.window_visible", visible)

    def show_window(self):
        """Show main window."""
        if self.main_window:
            self.main_window.show_window()
            self._publish_window_visible(True)

    def hide_window(self):
        """Hide main window."""
        if self.main_window:
            self.main_window.hide_window()
            self._publish_window_visible(False)

    def toggle_window(self):
        """Toggle window visibility."""
        if self.main_window:
            if self.main_window.isVisible():
                self.hide_window()
            else:
                self.show_window()

    def quit(self):
        """
        Quit application.

        This method can be called in two scenarios:
        1. Programmatically (e.g., tray menu exit) - triggers shutdown first
        2. After THREAD_BUS shutdown complete (cleanup and close window)

        TODO: consider delegating the shutdown orchestration to
        step7_managers.shutdown_manager.ShutdownManager (register this quit() as
        the UI quit callback + add window/tick/tray cleanup as shutdown hooks).
        Deferred for now to keep this split behaviour-preserving.
        """
        # Trigger global shutdown if configured and not already requested
        if self.config.trigger_shutdown_on_close and not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[PySide6Framework] Triggering global shutdown via THREAD_BUS...")
            THREAD_BUS.request_shutdown(
                reason="UI window closed",
                execute_handlers=True
            )
            # Return early - shutdown handlers will call quit() again after shutdown complete
            return

        # Shutdown already complete or not needed - proceed with cleanup
        ColorPrint.blue("[PySide6Framework] Shutdown complete, cleaning up UI...")

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
