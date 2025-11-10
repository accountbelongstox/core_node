#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Title Bar - Custom Title Bar for Frameless Window

Custom title bar with window controls and drag support.
"""

from PySide6.QtCore import Qt, QPoint, QSize, Signal, Slot
from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QLabel, QPushButton,
    QSpacerItem, QSizePolicy
)
from PySide6.QtGui import QIcon, QPixmap, QMouseEvent, QPainter, QColor

from typing import Optional
from pathlib import Path


class TitleBarButton(QPushButton):
    """Custom styled button for title bar."""

    def __init__(
        self,
        icon_text: str = "",
        tooltip: str = "",
        hover_color: str = "#3d5569",
        parent: Optional[QWidget] = None
    ):
        """
        Initialize title bar button.

        Args:
            icon_text: Text to display (or icon)
            tooltip: Tooltip text
            hover_color: Hover background color
            parent: Parent widget
        """
        super().__init__(icon_text, parent)

        self.hover_color = hover_color
        self.normal_color = "transparent"

        # Button properties
        self.setFixedSize(45, 32)
        self.setToolTip(tooltip)
        self.setFlat(True)

        # Apply stylesheet
        self.update_stylesheet()

    def update_stylesheet(self):
        """Update button stylesheet."""
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {self.normal_color};
                border: none;
                color: #ecf0f1;
                font-size: 14px;
                font-family: 'Segoe MDL2 Assets', 'Microsoft YaHei UI';
            }}
            QPushButton:hover {{
                background-color: {self.hover_color};
            }}
            QPushButton:pressed {{
                background-color: #2c3e50;
            }}
        """)


class PySide6TitleBar(QWidget):
    """
    Custom title bar for frameless window.

    Features:
    - Application name/logo display
    - Window drag support
    - Minimize/Maximize/Close buttons
    - Optional menu button
    """

    # Signals
    minimize_clicked = Signal()
    maximize_clicked = Signal()
    close_clicked = Signal()
    menu_clicked = Signal()

    def __init__(
        self,
        app_name: str = "Application",
        height: int = 32,
        bg_color: str = "#2c3e50",
        fg_color: str = "#ecf0f1",
        show_menu: bool = True,
        logo_path: Optional[str] = None,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize title bar.

        Args:
            app_name: Application name to display
            height: Title bar height
            bg_color: Background color
            fg_color: Foreground/text color
            show_menu: Show menu button
            logo_path: Path to logo image
            parent: Parent widget
        """
        super().__init__(parent)

        self.app_name = app_name
        self.height = height
        self.bg_color = bg_color
        self.fg_color = fg_color
        self.show_menu = show_menu
        self.logo_path = logo_path

        # Mouse dragging
        self._drag_position: Optional[QPoint] = None
        self._dragging = False

        # Setup UI
        self._setup_ui()

    def _setup_ui(self):
        """Setup title bar UI."""
        # Set fixed height
        self.setFixedHeight(self.height)

        # Set background color
        self.setStyleSheet(f"""
            QWidget {{
                background-color: {self.bg_color};
            }}
        """)

        # Main layout
        layout = QHBoxLayout(self)
        layout.setContentsMargins(5, 0, 0, 0)
        layout.setSpacing(0)

        # Logo (if provided)
        if self.logo_path and Path(self.logo_path).exists():
            logo_label = QLabel()
            pixmap = QPixmap(self.logo_path)
            if not pixmap.isNull():
                scaled_pixmap = pixmap.scaled(
                    24, 24,
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
                logo_label.setPixmap(scaled_pixmap)
                layout.addWidget(logo_label)
                layout.addSpacing(8)

        # Menu button (optional)
        if self.show_menu:
            self.menu_btn = TitleBarButton("☰", "Menu")
            self.menu_btn.clicked.connect(self.menu_clicked.emit)
            layout.addWidget(self.menu_btn)
            layout.addSpacing(5)

        # Application name
        self.title_label = QLabel(self.app_name)
        self.title_label.setStyleSheet(f"""
            QLabel {{
                color: {self.fg_color};
                font-size: 10pt;
                font-family: 'Microsoft YaHei UI';
            }}
        """)
        layout.addWidget(self.title_label)

        # Spacer
        layout.addStretch()

        # Window control buttons
        # Minimize button
        self.minimize_btn = TitleBarButton("−", "Minimize")
        self.minimize_btn.clicked.connect(self.minimize_clicked.emit)
        layout.addWidget(self.minimize_btn)

        # Maximize/Restore button
        self.maximize_btn = TitleBarButton("□", "Maximize")
        self.maximize_btn.clicked.connect(self.maximize_clicked.emit)
        layout.addWidget(self.maximize_btn)

        # Close button (red hover)
        self.close_btn = TitleBarButton("✕", "Close", hover_color="#e74c3c")
        self.close_btn.clicked.connect(self.close_clicked.emit)
        layout.addWidget(self.close_btn)

    def update_title(self, title: str):
        """
        Update window title.

        Args:
            title: New title text
        """
        self.title_label.setText(title)

    def set_maximized(self, maximized: bool):
        """
        Update maximize button icon based on window state.

        Args:
            maximized: True if window is maximized
        """
        if maximized:
            self.maximize_btn.setText("❐")  # Restore icon
            self.maximize_btn.setToolTip("Restore")
        else:
            self.maximize_btn.setText("□")  # Maximize icon
            self.maximize_btn.setToolTip("Maximize")

    # ========== Mouse Events for Dragging ==========

    def mousePressEvent(self, event: QMouseEvent):
        """Handle mouse press for window dragging."""
        if event.button() == Qt.LeftButton:
            self._drag_position = event.globalPos()
            self._dragging = True

            # Notify parent window to start drag
            parent = self.window()
            if parent and hasattr(parent, 'start_drag'):
                parent.start_drag(event.pos())

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent):
        """Handle mouse move for window dragging."""
        if self._dragging and self._drag_position:
            # Notify parent window to perform drag
            parent = self.window()
            if parent and hasattr(parent, 'do_drag'):
                parent.do_drag(event.globalPos())

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent):
        """Handle mouse release to end dragging."""
        if event.button() == Qt.LeftButton:
            self._dragging = False
            self._drag_position = None

            # Notify parent window to end drag
            parent = self.window()
            if parent and hasattr(parent, 'end_drag'):
                parent.end_drag()

        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event: QMouseEvent):
        """Handle double-click to toggle maximize."""
        if event.button() == Qt.LeftButton:
            self.maximize_clicked.emit()

        super().mouseDoubleClickEvent(event)
