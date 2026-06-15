#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Main Window - Frameless Window with Custom Title Bar

This is the main window framework using PySide6.
IMPORTANT: This should be used AFTER dependencies are installed.
"""

from PySide6.QtCore import Qt, QPoint, QSize, QRect, Signal, Slot, QTimer, QEvent
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QApplication, QFrame
)
from PySide6.QtGui import QMouseEvent, QIcon, QPalette, QColor, QCursor

from typing import Optional, Tuple
from pathlib import Path
from enum import Enum

# Import THREAD_BUS for event-driven architecture
try:
    from pycore import THREAD_BUS, ColorPrint
    HAS_THREAD_BUS = True
except ImportError:
    THREAD_BUS = None
    HAS_THREAD_BUS = False
    from pycore import ColorPrint

# Import window state manager
from .window_state import WindowStateManager


class ResizeEdge(Enum):
    """Window resize edge enumeration"""
    NONE = 0
    LEFT = 1
    RIGHT = 2
    BOTTOM = 3
    BOTTOM_LEFT = 4
    BOTTOM_RIGHT = 5


class PySide6MainWindow(QMainWindow):
    """
    PySide6-based main window with frameless design and custom title bar.

    Features:
    - Frameless window (no OS title bar)
    - Custom title bar with min/max/close buttons
    - Resizable with drag handles
    - System tray integration
    - WebView content area
    """

    # Signals
    window_closing = Signal()
    window_closed = Signal()
    window_minimized = Signal()
    window_maximized = Signal()
    window_restored = Signal()
    window_hidden = Signal()  # emitted when hidden to tray (close_to_tray)

    def __init__(
        self,
        app_name: str = "Application",
        app_id: str = "default",
        width: int = 1280,
        height: int = 800,
        frameless: bool = True,
        icon_path: Optional[str] = None,
        cache_window_state: bool = True,
        close_to_tray: bool = False,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize main window.

        Args:
            app_name: Application name
            app_id: Unique app identifier for state persistence
            width: Default window width (used if no cached state)
            height: Default window height (used if no cached state)
            frameless: Enable frameless window
            icon_path: Path to window icon file (.png or .ico)
            cache_window_state: Enable window state caching
            parent: Parent widget
        """
        super().__init__(parent)

        self.app_name = app_name
        self.app_id = app_id
        self._frameless = frameless
        self._icon_path = icon_path
        self._is_maximized = False
        self._cache_window_state = cache_window_state
        self._close_to_tray = close_to_tray  # hide to tray on close instead of quitting

        # Window state manager
        self._state_manager = WindowStateManager(app_id=app_id) if cache_window_state else None

        # Window dragging
        self._drag_pos: Optional[QPoint] = None
        self._dragging = False

        # Resize handling
        self._resize_edge: ResizeEdge = ResizeEdge.NONE
        self._resize_start_pos: Optional[QPoint] = None
        self._resize_start_geometry: Optional[QRect] = None
        self._resize_margin = 8  # Pixel margin for edge detection
        self._min_width = 800
        self._min_height = 600

        # Close handling - prevent multiple shutdown triggers
        self._close_requested = False  # Tracks if app.close event was triggered
        self._force_close = False  # Allows forced close after shutdown complete

        # Setup window (will load cached state if available)
        self._setup_window(width, height)
        self._create_ui()

        # Enable mouse tracking for resize cursor
        self.setMouseTracking(True)

        # Register event handlers for event-driven architecture
        self._register_event_handlers()

    def _setup_window(self, width: int, height: int):
        """Setup window properties."""
        # Set window title
        self.setWindowTitle(self.app_name)

        # Set window icon if provided
        if self._icon_path and Path(self._icon_path).exists():
            icon = QIcon(self._icon_path)
            if not icon.isNull():
                self.setWindowIcon(icon)
            else:
                ColorPrint.red(f"[MainWindow] Failed to load window icon from: {self._icon_path}")

        # Load cached window state if available
        loaded_state = None
        if self._state_manager and self._state_manager.has_state():
            loaded_state = self._state_manager.load_state()

        # Set window size (use cached or default)
        if loaded_state:
            self.resize(loaded_state.width, loaded_state.height)
            if loaded_state.x is not None and loaded_state.y is not None:
                self.move(loaded_state.x, loaded_state.y)
            self._is_maximized = loaded_state.is_maximized
        else:
            self.resize(width, height)

        # Set minimum size
        self.setMinimumSize(self._min_width, self._min_height)

        # Set maximum size to screen size to prevent window from exceeding screen
        screen = QApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            max_width = screen_geometry.width()
            max_height = screen_geometry.height()
            self.setMaximumSize(max_width, max_height)
            ColorPrint.print_info(f"[MainWindow] Maximum size set to screen: {max_width}x{max_height}")

        # Enable frameless if configured
        if self._frameless:
            self.setWindowFlags(
                Qt.Window |
                Qt.FramelessWindowHint |
                Qt.WindowMinimizeButtonHint |
                Qt.WindowMaximizeButtonHint |
                Qt.WindowCloseButtonHint
            )

        # Set window attributes - ensure opaque background
        # DO NOT use WA_TranslucentBackground as it causes transparency issues
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        # Set opaque background color
        palette = self.palette()
        palette.setColor(QPalette.Window, QColor("#0f1419"))  # Dark background
        self.setPalette(palette)
        self.setAutoFillBackground(True)

        # Center window if no cached position
        if not (loaded_state and loaded_state.x is not None):
            self._center_window()

    def _center_window(self):
        """Center window on screen if position is negative."""
        screen = QApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            window_geometry = self.frameGeometry()
            current_pos = window_geometry.topLeft()

            # Only adjust if position is negative (outside screen bounds)
            if current_pos.x() < 0 or current_pos.y() < 0:
                # Check if window size is equal or greater than screen size (fullscreen mode)
                if (window_geometry.width() >= screen_geometry.width() - 20 and
                    window_geometry.height() >= screen_geometry.height() - 20):
                    # Fullscreen or near-fullscreen: position at screen origin
                    self.move(screen_geometry.topLeft())
                    ColorPrint.print_info(
                        f"[MainWindow] Position negative, fullscreen detected, "
                        f"positioning at screen origin: {screen_geometry.topLeft()}"
                    )
                else:
                    # Normal window: center on screen
                    center_point = screen_geometry.center()
                    window_geometry.moveCenter(center_point)
                    self.move(window_geometry.topLeft())
                    ColorPrint.print_info(
                        f"[MainWindow] Position negative, centering window"
                    )
            else:
                # Position is valid (>= 0), keep as is
                ColorPrint.print_info(
                    f"[MainWindow] Position valid ({current_pos.x()}, {current_pos.y()}), keeping original position"
                )

    def _create_ui(self):
        """Create UI components."""
        # Central widget
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)

        # Main layout
        self.main_layout = QVBoxLayout(self.central_widget)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)

        # Title bar will be added by external component
        # Content area will be added by external component

    def _register_event_handlers(self):
        """Register global event handlers for event-driven architecture."""
        if not HAS_THREAD_BUS:
            return

        # Window show/hide events
        THREAD_BUS.register_event_handler('window.show', lambda e: self.show_window(), priority=50)
        THREAD_BUS.register_event_handler('window.hide', lambda e: self.hide_window(), priority=50)

        # Window state events
        THREAD_BUS.register_event_handler('window.maximize', lambda e: self.maximize_window(), priority=50)
        THREAD_BUS.register_event_handler('window.minimize', lambda e: self.minimize_window(), priority=50)
        THREAD_BUS.register_event_handler('window.restore', lambda e: self.restore_window(), priority=50)

        # App events - close will be handled by closeEvent

    def set_title_bar(self, title_bar: QWidget):
        """
        Set custom title bar widget.

        Args:
            title_bar: Title bar widget
        """
        self.main_layout.insertWidget(0, title_bar)

    def set_content(self, content: QWidget):
        """
        Set main content widget.

        Args:
            content: Content widget (typically WebView)
        """
        self.main_layout.addWidget(content)

    # ========== Window State Management ==========

    def toggle_maximize(self):
        """Toggle between maximized and normal state."""
        if self._is_maximized:
            self.restore_window()
        else:
            self.maximize_window()

    def maximize_window(self):
        """Maximize window."""
        if not self._is_maximized:
            self.showMaximized()
            self._is_maximized = True
            self.window_maximized.emit()

    def restore_window(self):
        """Restore window to normal size."""
        if self._is_maximized:
            self.showNormal()
            self._is_maximized = False
            self.window_restored.emit()

    def minimize_window(self):
        """Minimize window."""
        self.showMinimized()
        self.window_minimized.emit()

    def hide_window(self):
        """Hide window (for minimize to tray)."""
        self.hide()

    def show_window(self):
        """Show window."""
        self.show()
        self.activateWindow()
        self.raise_()

    # ========== Mouse Events for Dragging ==========

    def start_drag(self, pos: QPoint):
        """
        Start window drag operation.
        Should be called from title bar mouse press.

        Args:
            pos: Mouse position
        """
        if not self._is_maximized:
            self._drag_pos = pos
            self._dragging = True

    def do_drag(self, global_pos: QPoint):
        """
        Perform window drag.
        Should be called from title bar mouse move.

        Args:
            global_pos: Global mouse position
        """
        if self._dragging and self._drag_pos:
            self.move(global_pos - self._drag_pos)

    def end_drag(self):
        """
        End window drag operation.
        Should be called from title bar mouse release.
        """
        self._dragging = False
        self._drag_pos = None

    # ========== Window Resize Handling ==========

    def _get_resize_edge(self, pos: QPoint) -> ResizeEdge:
        """
        Determine which resize edge the mouse is on.

        Args:
            pos: Mouse position relative to window

        Returns:
            ResizeEdge enum value
        """
        if self._is_maximized or not self._frameless:
            return ResizeEdge.NONE

        rect = self.rect()
        margin = self._resize_margin

        # Check corners first (higher priority)
        if pos.x() <= margin and pos.y() >= rect.height() - margin:
            return ResizeEdge.BOTTOM_LEFT
        if pos.x() >= rect.width() - margin and pos.y() >= rect.height() - margin:
            return ResizeEdge.BOTTOM_RIGHT

        # Check edges
        if pos.x() <= margin:
            return ResizeEdge.LEFT
        if pos.x() >= rect.width() - margin:
            return ResizeEdge.RIGHT
        if pos.y() >= rect.height() - margin:
            return ResizeEdge.BOTTOM

        return ResizeEdge.NONE

    def _update_cursor_shape(self, edge: ResizeEdge):
        """
        Update cursor shape based on resize edge.

        Args:
            edge: Resize edge
        """
        cursor_map = {
            ResizeEdge.LEFT: Qt.CursorShape.SizeHorCursor,
            ResizeEdge.RIGHT: Qt.CursorShape.SizeHorCursor,
            ResizeEdge.BOTTOM: Qt.CursorShape.SizeVerCursor,
            ResizeEdge.BOTTOM_LEFT: Qt.CursorShape.SizeBDiagCursor,
            ResizeEdge.BOTTOM_RIGHT: Qt.CursorShape.SizeFDiagCursor,
        }

        if edge in cursor_map:
            self.setCursor(cursor_map[edge])
        else:
            self.unsetCursor()

    def _save_window_state(self):
        """Save current window state to cache"""
        if not self._state_manager or self._is_maximized:
            return

        geometry = self.geometry()
        self._state_manager.save_state(
            width=geometry.width(),
            height=geometry.height(),
            x=geometry.x(),
            y=geometry.y(),
            is_maximized=self._is_maximized
        )

    # ========== Mouse Events for Resize ==========

    def mousePressEvent(self, event: QMouseEvent):
        """Handle mouse press for resize start"""
        if event.button() == Qt.MouseButton.LeftButton:
            self._resize_edge = self._get_resize_edge(event.pos())

            if self._resize_edge != ResizeEdge.NONE:
                self._resize_start_pos = event.globalPos()
                self._resize_start_geometry = self.geometry()
                event.accept()
                return

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent):
        """Handle mouse move for resize cursor and operation"""
        # If resizing, perform resize
        if self._resize_edge != ResizeEdge.NONE and self._resize_start_pos:
            self._perform_resize(event.globalPos())
            event.accept()
            return

        # Update cursor based on edge
        edge = self._get_resize_edge(event.pos())
        self._update_cursor_shape(edge)

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent):
        """Handle mouse release for resize end"""
        if event.button() == Qt.MouseButton.LeftButton:
            if self._resize_edge != ResizeEdge.NONE:
                self._resize_edge = ResizeEdge.NONE
                self._resize_start_pos = None
                self._resize_start_geometry = None

                # Save window state after resize
                self._save_window_state()

                event.accept()
                return

        super().mouseReleaseEvent(event)

    def _perform_resize(self, global_pos: QPoint):
        """
        Perform window resize operation.

        Args:
            global_pos: Global mouse position
        """
        if not self._resize_start_geometry or not self._resize_start_pos:
            return

        delta = global_pos - self._resize_start_pos
        geo = self._resize_start_geometry
        new_geo = QRect(geo)

        edge = self._resize_edge

        # Left edge
        if edge in (ResizeEdge.LEFT, ResizeEdge.BOTTOM_LEFT):
            new_width = max(self._min_width, geo.width() - delta.x())
            new_x = geo.x() + (geo.width() - new_width)
            new_geo.setLeft(new_x)

        # Right edge
        if edge in (ResizeEdge.RIGHT, ResizeEdge.BOTTOM_RIGHT):
            new_width = max(self._min_width, geo.width() + delta.x())
            new_geo.setWidth(new_width)

        # Bottom edge
        if edge in (ResizeEdge.BOTTOM, ResizeEdge.BOTTOM_LEFT, ResizeEdge.BOTTOM_RIGHT):
            new_height = max(self._min_height, geo.height() + delta.y())
            new_geo.setHeight(new_height)

        self.setGeometry(new_geo)

    # ========== Window Events ==========

    def closeEvent(self, event):
        """
        Handle window close event.

        Implements proper shutdown flow:
        1. First close attempt: Trigger app.close event and ignore close (prevent window from closing)
        2. THREAD_BUS shutdown handlers execute (stop services, cleanup)
        3. After shutdown complete: Framework calls window.close() with _force_close=True
        4. Second close attempt: Accept close and window closes gracefully
        """
        # If force close is set, directly close window (called after shutdown complete)
        if self._force_close:
            ColorPrint.blue("[MainWindow] Force close enabled, closing window...")
            self._save_window_state()
            self.window_closing.emit()
            event.accept()
            self.window_closed.emit()
            return

        # Close-to-tray: the window lives in the tray, so the close button hides it
        # instead of quitting the whole app. The tray "Exit" is the real quit path.
        if self._close_to_tray:
            ColorPrint.blue("[MainWindow] close_to_tray: hiding window instead of quitting")
            self.hide()
            self.window_hidden.emit()
            event.ignore()
            return

        # First close attempt: Trigger shutdown flow
        if not self._close_requested:
            ColorPrint.blue("[MainWindow] Close button clicked, triggering app.close event...")
            self._close_requested = True

            # Save window state before shutdown
            self._save_window_state()

            # Trigger app.close event (THREAD_BUS will handle shutdown flow)
            if HAS_THREAD_BUS:
                # Use async mode to avoid blocking Qt event loop
                THREAD_BUS.trigger_event('app.close', {
                    'source': 'window_close_button',
                    'window': self
                }, async_mode=True)
                ColorPrint.blue("[MainWindow] app.close event triggered, waiting for shutdown...")

            # IMPORTANT: Ignore this close event to prevent window from closing immediately
            # Window will be closed later by framework.quit() after shutdown completes
            event.ignore()
            ColorPrint.blue("[MainWindow] Close event ignored, waiting for shutdown to complete...")
            return

        # If we reach here without force_close, something went wrong
        # Just accept the close to prevent window from becoming unresponsive
        ColorPrint.yellow("[MainWindow] Close event without force_close flag, accepting anyway...")
        event.accept()

    def changeEvent(self, event):
        """Handle window state change event."""
        if event.type() == QEvent.Type.WindowStateChange:
            if self.windowState() & Qt.WindowState.WindowMaximized:
                self._is_maximized = True
            elif self.windowState() & Qt.WindowState.WindowNoState:
                self._is_maximized = False

        super().changeEvent(event)


class MainWindowContainer(QFrame):
    """
    Container frame for main window with rounded corners and shadow.
    Used for frameless windows to provide visual boundaries.
    """

    def __init__(self, parent: Optional[QWidget] = None):
        """
        Initialize container.

        Args:
            parent: Parent widget
        """
        super().__init__(parent)

        # Setup frame style
        self.setObjectName("MainWindowContainer")
        self.setFrameShape(QFrame.StyledPanel)

        # Apply stylesheet for rounded corners and shadow
        self.setStyleSheet("""
            #MainWindowContainer {
                background-color: #ffffff;
                border-radius: 8px;
                border: 1px solid #d0d0d0;
            }
        """)

        # Layout
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        self.layout.setSpacing(0)

    def set_content(self, widget: QWidget):
        """
        Set content widget.

        Args:
            widget: Content widget
        """
        self.layout.addWidget(widget)
