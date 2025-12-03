#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Title Bar - Custom Title Bar for Frameless Window

Custom title bar with window controls and drag support.
"""

from PySide6.QtCore import (
    Qt, QPoint, QSize, Signal, Slot,
    QPropertyAnimation, QEasingCurve, Property
)
from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QLabel, QPushButton,
    QSpacerItem, QSizePolicy, QGraphicsDropShadowEffect
)
from PySide6.QtGui import QIcon, QPixmap, QMouseEvent, QPainter, QColor

from typing import Optional, Dict, Any
from pathlib import Path

# 导入样式系统
from .title_bar_styles import (
    TitleBarStyles,
    get_default_style,
    StyleSheetGenerator,
    merge_styles
)


class TitleBarButton(QPushButton):
    """Custom styled button for title bar with modern design."""

    def __init__(
        self,
        icon_text: str = "",
        tooltip: str = "",
        button_type: str = "normal",
        styles: Optional[TitleBarStyles] = None,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize title bar button.

        Args:
            icon_text: Text to display (or icon)
            tooltip: Tooltip text
            button_type: Button type ("normal", "minimize", "maximize", "close")
            styles: Style configuration (use default if None)
            parent: Parent widget
        """
        super().__init__(icon_text, parent)

        self.button_type = button_type
        self.styles = styles or get_default_style()

        # Button properties
        self.setFixedSize(self.styles.button_width, self.styles.button_height)
        self.setToolTip(tooltip)
        self.setFlat(True)
        self.setCursor(Qt.PointingHandCursor)

        # Add shadow effect for close button
        if button_type == "close":
            shadow = QGraphicsDropShadowEffect()
            shadow.setBlurRadius(8)
            shadow.setColor(QColor(0, 0, 0, 80))
            shadow.setOffset(0, 2)
            self.setGraphicsEffect(shadow)

        # Apply stylesheet
        self.update_stylesheet()

    def update_stylesheet(self):
        """Update button stylesheet using style generator."""
        stylesheet = StyleSheetGenerator.generate_button_stylesheet(
            self.styles,
            self.button_type
        )
        self.setStyleSheet(stylesheet)


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
        show_menu: bool = True,
        logo_path: Optional[str] = None,
        menu_icon_path: Optional[str] = None,
        styles: Optional[TitleBarStyles] = None,
        custom_styles: Optional[Dict[str, Any]] = None,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize title bar.

        Args:
            app_name: Application name to display
            show_menu: Show menu button (deprecated, use menu_icon_path instead)
            logo_path: Path to logo image
            menu_icon_path: Path to menu icon (if provided, menu button will be shown)
            styles: Base style configuration (use default if None)
            custom_styles: Custom style overrides (dict format)
            parent: Parent widget

        Example:
            # Use default style
            title_bar = PySide6TitleBar("My App")

            # Use predefined style
            from title_bar_styles import get_light_style
            title_bar = PySide6TitleBar("My App", styles=get_light_style())

            # Use custom overrides
            title_bar = PySide6TitleBar(
                "My App",
                custom_styles={"bar_height": 50, "title_color": "#00ff00"}
            )

            # Combine base style + custom overrides
            title_bar = PySide6TitleBar(
                "My App",
                styles=get_dark_style(),
                custom_styles={"close_hover_color": "#ff0000"}
            )
        """
        super().__init__(parent)

        self.app_name = app_name
        self.show_menu = show_menu
        self.logo_path = logo_path
        self.menu_icon_path = menu_icon_path

        # Merge styles: base style + custom overrides
        base_style = styles or get_default_style()
        self.styles = base_style.merge(custom_styles)

        # Mouse dragging
        self._drag_position: Optional[QPoint] = None
        self._dragging = False

        # Setup UI
        self._setup_ui()

    def _setup_ui(self):
        """Setup title bar UI using style system."""
        # Set fixed height from styles
        self.setFixedHeight(self.styles.bar_height)

        # Apply title bar stylesheet
        stylesheet = StyleSheetGenerator.generate_title_bar_stylesheet(self.styles)
        self.setStyleSheet(stylesheet)

        # Main layout with padding from styles
        layout = QHBoxLayout(self)
        layout.setContentsMargins(
            self.styles.bar_padding_left, 0,
            self.styles.bar_padding_right, 0
        )
        layout.setSpacing(self.styles.bar_spacing)

        # Logo (if provided) using styles
        if self.logo_path and Path(self.logo_path).exists():
            logo_label = QLabel()
            logo_stylesheet = StyleSheetGenerator.generate_logo_stylesheet(self.styles)
            logo_label.setStyleSheet(logo_stylesheet)

            pixmap = QPixmap(self.logo_path)
            if not pixmap.isNull():
                scaled_pixmap = pixmap.scaled(
                    self.styles.logo_size, self.styles.logo_size,
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
                logo_label.setPixmap(scaled_pixmap)
                layout.addWidget(logo_label)
                layout.addSpacing(self.styles.logo_spacing_right)

        # Menu button (optional, only if menu_icon_path is provided)
        if self.menu_icon_path and Path(self.menu_icon_path).exists():
            self.menu_btn = QPushButton()
            self.menu_btn.setFixedSize(self.styles.button_width, self.styles.button_height)
            self.menu_btn.setToolTip("Menu")
            self.menu_btn.setFlat(True)
            self.menu_btn.setCursor(Qt.PointingHandCursor)

            # Load and set icon
            icon = QIcon(self.menu_icon_path)
            self.menu_btn.setIcon(icon)
            self.menu_btn.setIconSize(QSize(16, 16))

            # Apply stylesheet
            self.menu_btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: transparent;
                    border: none;
                    border-radius: 4px;
                }}
                QPushButton:hover {{
                    background-color: rgba(255, 255, 255, 0.1);
                }}
                QPushButton:pressed {{
                    background-color: rgba(255, 255, 255, 0.2);
                }}
            """)

            self.menu_btn.clicked.connect(self.menu_clicked.emit)
            layout.addWidget(self.menu_btn)
            layout.addSpacing(4)

        # Application name with typography from styles
        self.title_label = QLabel(self.app_name)
        title_stylesheet = StyleSheetGenerator.generate_title_label_stylesheet(self.styles)
        self.title_label.setStyleSheet(title_stylesheet)
        layout.addWidget(self.title_label)

        # Spacer
        layout.addStretch()

        # Window control buttons using styles
        # Minimize button
        self.minimize_btn = TitleBarButton(
            self.styles.minimize_icon,
            "Minimize",
            button_type="minimize",
            styles=self.styles
        )
        self.minimize_btn.clicked.connect(self.minimize_clicked.emit)
        layout.addWidget(self.minimize_btn)

        # Maximize/Restore button
        self.maximize_btn = TitleBarButton(
            self.styles.maximize_icon,
            "Maximize",
            button_type="maximize",
            styles=self.styles
        )
        self.maximize_btn.clicked.connect(self.maximize_clicked.emit)
        layout.addWidget(self.maximize_btn)

        # Close button
        self.close_btn = TitleBarButton(
            self.styles.close_icon,
            "Close",
            button_type="close",
            styles=self.styles
        )
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
            self.maximize_btn.setText(self.styles.maximize_icon_restore)
            self.maximize_btn.setToolTip("Restore")
        else:
            self.maximize_btn.setText(self.styles.maximize_icon)
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
