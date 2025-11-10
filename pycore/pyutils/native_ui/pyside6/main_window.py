#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Main Window - Frameless Window with Custom Title Bar

This is the main window framework using PySide6.
IMPORTANT: This should be used AFTER dependencies are installed.
"""

from PySide6.QtCore import Qt, QPoint, QSize, Signal, Slot, QTimer
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QApplication, QFrame
)
from PySide6.QtGui import QMouseEvent, QIcon, QPalette, QColor

from typing import Optional, Tuple
from pathlib import Path


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

    def __init__(
        self,
        app_name: str = "Application",
        width: int = 1280,
        height: int = 800,
        frameless: bool = True,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize main window.

        Args:
            app_name: Application name
            width: Window width
            height: Window height
            frameless: Enable frameless window
            parent: Parent widget
        """
        super().__init__(parent)

        self.app_name = app_name
        self._frameless = frameless
        self._is_maximized = False

        # Window dragging
        self._drag_pos: Optional[QPoint] = None
        self._dragging = False

        # Setup window
        self._setup_window(width, height)
        self._create_ui()

    def _setup_window(self, width: int, height: int):
        """Setup window properties."""
        # Set window title
        self.setWindowTitle(self.app_name)

        # Set window size
        self.resize(width, height)

        # Enable frameless if configured
        if self._frameless:
            self.setWindowFlags(
                Qt.Window |
                Qt.FramelessWindowHint |
                Qt.WindowMinimizeButtonHint |
                Qt.WindowMaximizeButtonHint |
                Qt.WindowCloseButtonHint
            )

        # Set window attributes
        self.setAttribute(Qt.WA_TranslucentBackground, self._frameless)

        # Center window
        self._center_window()

    def _center_window(self):
        """Center window on screen."""
        screen = QApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            window_geometry = self.frameGeometry()
            center_point = screen_geometry.center()
            window_geometry.moveCenter(center_point)
            self.move(window_geometry.topLeft())

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

    # ========== Window Events ==========

    def closeEvent(self, event):
        """Handle window close event."""
        # Emit closing signal
        self.window_closing.emit()

        # Accept close
        event.accept()

        # Emit closed signal
        self.window_closed.emit()

    def changeEvent(self, event):
        """Handle window state change event."""
        if event.type() == event.WindowStateChange:
            if self.windowState() & Qt.WindowMaximized:
                self._is_maximized = True
            elif self.windowState() & Qt.WindowNoState:
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
