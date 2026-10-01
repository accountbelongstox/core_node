#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PySide6 system tray icon rendering the shared TrayMenuItem model."""

from pathlib import Path
from typing import List, Optional

from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtGui import QAction, QIcon
from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.native_ui.step1_config.tray_config import TRAY_EVENT_SOURCE, TrayMenuItem
from pycore.pyutils.native_ui.step11_desktop.system_notification import copy_notification_text



class PySide6SystemTray(QObject):
    """
    System tray icon manager for PySide6.

    Features:
    - System tray icon with custom icon
    - Context menu with custom items
    - Click/double-click handling
    - Show/hide window integration
    - Notifications
    """

    # Signals
    tray_clicked = Signal()
    tray_double_clicked = Signal()
    tray_activated = Signal(QSystemTrayIcon.ActivationReason)

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        parent: Optional[QObject] = None
    ):
        """
        Initialize system tray.

        Args:
            app_name: Application name
            icon_path: Path to tray icon
            parent: Parent QObject
        """
        super().__init__(parent)

        self.app_name = app_name
        self.icon_path = icon_path

        # System tray icon
        self.tray_icon: Optional[QSystemTrayIcon] = None
        self.tray_menu: Optional[QMenu] = None

        # Menu items storage
        self.menu_items: List[TrayMenuItem] = []
        self._menu_signature = {'value': None}

        # Create tray icon
        self._create_tray_icon()

    def _create_tray_icon(self):
        """Create system tray icon."""
        # Create tray icon
        self.tray_icon = QSystemTrayIcon()

        # Set icon
        if self.icon_path and Path(self.icon_path).exists():
            icon = QIcon(self.icon_path)
            self.tray_icon.setIcon(icon)
        else:
            # Use default application icon
            app = QApplication.instance()
            if app and not app.windowIcon().isNull():
                self.tray_icon.setIcon(app.windowIcon())

        # Set tooltip
        self.tray_icon.setToolTip(self.app_name)

        # Connect signals
        self.tray_icon.activated.connect(self._on_tray_activated)
        self._message_copy_text = ""
        self.tray_icon.messageClicked.connect(self._on_message_clicked)

        # Create context menu
        self._create_menu()

    def _create_menu(self):
        """Create tray context menu."""
        self.tray_menu = QMenu()
        self.tray_icon.setContextMenu(self.tray_menu)

    def set_menu_items(self, items: List[TrayMenuItem]):
        """
        Set tray menu items.

        Args:
            items: List of menu item configurations
        """
        signature = self._menu_signature_value(items)
        if signature == self._menu_signature.get('value'):
            return
        self._menu_signature['value'] = signature
        self.menu_items = items
        self._rebuild_menu()

    @staticmethod
    def _menu_signature_value(items: List[TrayMenuItem]) -> str:
        """Stable menu-signature helper for dedupe."""
        def normalize(item):
            if item.is_separator():
                return {"separator": True}
            return {
                "text": item.get_display_text(),
                "signal": item.action_signal,
                "enabled": item.is_enabled(),
                "submenu": [normalize(child) for child in item.submenu] if item.submenu else [],
            }

        normalized = [normalize(item) for item in items]
        return str(normalized)

    def _rebuild_menu(self):
        """Rebuild menu from menu items."""
        if not self.tray_menu:
            return

        # Clear existing menu
        self.tray_menu.clear()

        # Add items
        for item in self.menu_items:
            self._add_menu_item(self.tray_menu, item)

    def _add_menu_item(self, menu: QMenu, item: TrayMenuItem):
        """
        Add menu item to menu.

        Args:
            menu: Menu to add item to
            item: Menu item configuration
        """
        if item.is_separator():
            menu.addSeparator()
            return
        text = item.get_display_text()
        if item.submenu:
            submenu = menu.addMenu(text)
            if item.icon_name and Path(item.icon_name).exists():
                submenu.setIcon(QIcon(item.icon_name))
            for subitem in item.submenu:
                self._add_menu_item(submenu, subitem)
            return
        action = QAction(text, menu)
        if item.icon_name and Path(item.icon_name).exists():
            action.setIcon(QIcon(item.icon_name))
        if item.checked is not None:
            action.setCheckable(True)
            action.setChecked(item.checked)
        action.setEnabled(item.is_enabled())
        if item.action_signal:
            action.triggered.connect(
                lambda checked=False, signal=item.action_signal: THREAD_BUS.trigger_event(signal, {"signal": signal, "source": TRAY_EVENT_SOURCE})
            )
        menu.addAction(action)

    def show(self):
        """Show tray icon."""
        if self.tray_icon:
            self.tray_icon.show()

    def hide(self):
        """Hide tray icon."""
        if self.tray_icon:
            self.tray_icon.hide()

    def is_visible(self) -> bool:
        """Check if tray icon is visible."""
        return self.tray_icon.isVisible() if self.tray_icon else False

    def show_message(
        self,
        title: str,
        message: str,
        icon: QSystemTrayIcon.MessageIcon = QSystemTrayIcon.Information,
        duration: int = 3000,
        copy_text: str = "",
    ):
        """
        Show notification message.

        Args:
            title: Notification title
            message: Notification message
            icon: Notification icon type
            duration: Duration in milliseconds
        """
        if self.tray_icon and self.tray_icon.isVisible():
            # Only the latest message is clickable, so it owns the copy payload.
            self._message_copy_text = str(copy_text or "")
            self.tray_icon.showMessage(title, message, icon, duration)

    def _on_message_clicked(self):
        copy_text, self._message_copy_text = self._message_copy_text, ""
        if copy_text:
            copy_notification_text(copy_text)

    def update_tooltip(self, tooltip: str):
        """
        Update tray icon tooltip.

        Args:
            tooltip: New tooltip text
        """
        if self.tray_icon:
            self.tray_icon.setToolTip(tooltip)

    def update_icon(self, icon_path: str):
        """
        Update tray icon.

        Args:
            icon_path: Path to new icon
        """
        if self.tray_icon and Path(icon_path).exists():
            icon = QIcon(icon_path)
            self.tray_icon.setIcon(icon)

    @Slot(QSystemTrayIcon.ActivationReason)
    def _on_tray_activated(self, reason: QSystemTrayIcon.ActivationReason):
        """
        Handle tray icon activation.

        Args:
            reason: Activation reason
        """
        # Emit specific signals
        if reason == QSystemTrayIcon.Trigger:
            # Single click
            self.tray_clicked.emit()
        elif reason == QSystemTrayIcon.DoubleClick:
            # Double click
            self.tray_double_clicked.emit()

        # Emit general activation signal
        self.tray_activated.emit(reason)

    def cleanup(self):
        """Cleanup tray icon."""
        if self.tray_icon:
            self.tray_icon.hide()
            self.tray_icon = None
