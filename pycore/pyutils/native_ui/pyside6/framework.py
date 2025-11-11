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
- Main thread: Qt event loop (UI)
- Tick thread: Periodic tasks timer
"""

import threading
import time
from typing import Optional, Callable, List
from pathlib import Path

from PySide6.QtCore import QObject, Signal, Slot, QTimer, Qt
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QIcon

# Import startup window (tkinter)
import sys
import os
sys.path.insert(0, str(Path(__file__).parent.parent))
from startup_window import StartupWindow, ColorPrintCapture

# Import PySide6 components
from .config import PySide6UIConfig, StartupWindowConfig, ActionType
from .main_window import PySide6MainWindow
from .title_bar import PySide6TitleBar
from .system_tray import PySide6SystemTray, PySide6TrayMenuItem, create_default_tray_menu
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
        self.startup_config = startup_config or StartupWindowConfig(
            app_name=self.config.app_name
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

    # ========== Startup Window (Tkinter) ==========

    def show_startup(self):
        """Show startup window (tkinter) for dependency installation."""
        if not self.startup_config.show_startup:
            return

        if not self.startup_window:
            self.startup_window = StartupWindow(
                app_name=self.startup_config.app_name,
                width=self.startup_config.width,
                height=self.startup_config.height,
                on_complete=self.startup_config.on_complete
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
        if self._started:
            return

        # Close startup window if still open
        self.close_startup()

        # Create Qt application if not exists
        if not QApplication.instance():
            self.qt_app = QApplication(sys.argv)
            self._qt_app_created_internally = True
        else:
            self.qt_app = QApplication.instance()

        # Set application properties
        self.qt_app.setApplicationName(self.config.app_name)

        if self.config.icon_path and Path(self.config.icon_path).exists():
            self.qt_app.setWindowIcon(QIcon(self.config.icon_path))

        # Create components
        self._create_components()

        # Setup signal connections
        self._setup_connections()

        # Show window if configured
        if self.config.show_on_start:
            self.main_window.show()

        # Start tick timer if enabled
        if self.config.enable_tick_timer:
            self.tick_timer.start()

        # Emit ready signal
        self.ready.emit()

        # Call ready callback
        if self.config.on_ready:
            self.config.on_ready()

        self._started = True

        # Start Qt event loop (blocking)
        if self._qt_app_created_internally:
            sys.exit(self.qt_app.exec())

    def _create_components(self):
        """Create UI components."""
        # Main window
        self.main_window = PySide6MainWindow(
            app_name=self.config.app_name,
            app_id=self.config.app_id or self.config.app_name.lower().replace(' ', '_'),
            width=self.config.window_size[0],
            height=self.config.window_size[1],
            frameless=self.config.frameless,
            cache_window_state=self.config.cache_window_state
        )

        # Title bar
        if self.config.enable_title_bar:
            # Create custom styles from config
            custom_styles = {
                'bar_height': self.config.title_bar_height,
                'bar_bg_color': self.config.title_bar_bg,
                'title_color': self.config.title_bar_fg,
            }

            self.title_bar = PySide6TitleBar(
                app_name=self.config.app_name,
                show_menu=self.config.show_menu_button,
                logo_path=self.config.logo_path,
                custom_styles=custom_styles
            )
            self.main_window.set_title_bar(self.title_bar)

        # WebView
        if self.config.enable_webview:
            self.webview = PySide6WebView(
                enable_dev_tools=self.config.enable_dev_tools,
                enable_javascript=self.config.enable_javascript
            )

            # Show loading page
            if self.config.enable_loading_page:
                self.webview.show_loading_page(
                    html_path=self.config.loading_page_path,
                    style=self.config.loading_style,
                    text=self.config.loading_text,
                    background=self.config.loading_background
                )

            # Load URL after a delay
            if self.config.webview_url:
                QTimer.singleShot(500, lambda: self.webview.load_url(self.config.webview_url))

            self.main_window.set_content(self.webview)

        # System tray
        if self.config.enable_tray:
            self.system_tray = PySide6SystemTray(
                app_name=self.config.app_name,
                icon_path=self.config.tray_icon_path or self.config.icon_path
            )

            # Create default menu if no custom items
            if not self.config.tray_menu_items:
                menu_items = create_default_tray_menu(
                    show_callback=self.show_window,
                    hide_callback=self.hide_window,
                    quit_callback=self.quit
                )
                self.system_tray.set_menu_items(menu_items)

            self.system_tray.show()

        # Tick timer
        if self.config.enable_tick_timer:
            self.tick_timer = TickTimer(interval=self.config.tick_interval)

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
        """Quit application."""
        # Stop tick timer
        if self.tick_timer:
            self.tick_timer.stop()

        # Hide tray
        if self.system_tray:
            self.system_tray.hide()

        # Close window
        if self.main_window:
            self.main_window.close()

        # Quit Qt application
        if self.qt_app:
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
