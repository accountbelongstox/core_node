#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 System Tray - System Tray Icon with Menu

System tray integration for PySide6 applications.
"""

from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtWidgets import QSystemTrayIcon, QMenu, QApplication
from PySide6.QtGui import QIcon, QAction

from typing import Optional, Callable, List, Dict, Any
from pathlib import Path
from dataclasses import dataclass

# Import THREAD_BUS for event-driven architecture
try:
    from pycore import THREAD_BUS
    HAS_THREAD_BUS = True
except ImportError:
    THREAD_BUS = None
    HAS_THREAD_BUS = False


@dataclass
class PySide6TrayMenuItem:
    """System tray menu item configuration for PySide6."""
    text: str
    callback: Optional[Callable] = None
    icon_path: Optional[str] = None
    checkable: bool = False
    checked: bool = False
    separator: bool = False
    submenu: Optional[List['PySide6TrayMenuItem']] = None
    enabled: bool = True


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
        self.menu_items: List[PySide6TrayMenuItem] = []

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

        # Create context menu
        self._create_menu()

    def _create_menu(self):
        """Create tray context menu."""
        self.tray_menu = QMenu()
        self.tray_icon.setContextMenu(self.tray_menu)

    def set_menu_items(self, items: List[PySide6TrayMenuItem]):
        """
        Set tray menu items.

        Args:
            items: List of menu item configurations
        """
        self.menu_items = items
        self._rebuild_menu()

    def _rebuild_menu(self):
        """Rebuild menu from menu items."""
        if not self.tray_menu:
            return

        # Clear existing menu
        self.tray_menu.clear()

        # Add items
        for item in self.menu_items:
            self._add_menu_item(self.tray_menu, item)

    def _add_menu_item(self, menu: QMenu, item: PySide6TrayMenuItem):
        """
        Add menu item to menu.

        Args:
            menu: Menu to add item to
            item: Menu item configuration
        """
        # Separator
        if item.separator:
            menu.addSeparator()
            return

        # Submenu
        if item.submenu:
            submenu = menu.addMenu(item.text)

            # Set icon if provided
            if item.icon_path and Path(item.icon_path).exists():
                submenu.setIcon(QIcon(item.icon_path))

            # Add submenu items
            for subitem in item.submenu:
                self._add_menu_item(submenu, subitem)

            return

        # Regular action
        action = QAction(item.text, menu)

        # Set icon if provided
        if item.icon_path and Path(item.icon_path).exists():
            action.setIcon(QIcon(item.icon_path))

        # Set checkable
        if item.checkable:
            action.setCheckable(True)
            action.setChecked(item.checked)

        # Set enabled
        action.setEnabled(item.enabled)

        # Connect callback
        if item.callback:
            action.triggered.connect(lambda checked=False: item.callback())

        # Add to menu
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
        duration: int = 3000
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
            self.tray_icon.showMessage(title, message, icon, duration)

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


# Convenience function to create default tray menu
def create_default_tray_menu(
    show_callback: Optional[Callable] = None,
    hide_callback: Optional[Callable] = None,
    quit_callback: Optional[Callable] = None
) -> List[PySide6TrayMenuItem]:
    """
    Create default tray menu items.

    Args:
        show_callback: Callback for "Show" action
        hide_callback: Callback for "Hide" action
        quit_callback: Callback for "Quit" action

    Returns:
        List of PySide6TrayMenuItem configurations
    """
    items = []

    if show_callback:
        items.append(PySide6TrayMenuItem(
            text="Show Window",
            callback=show_callback
        ))

    if hide_callback:
        items.append(PySide6TrayMenuItem(
            text="Hide Window",
            callback=hide_callback
        ))

    if show_callback or hide_callback:
        items.append(PySide6TrayMenuItem(text="---", separator=True))

    if quit_callback:
        items.append(PySide6TrayMenuItem(
            text="Quit",
            callback=quit_callback
        ))

    return items


def create_event_driven_tray_menu(
    app_name: str = "Application",
    enable_show_hide: bool = True,
    enable_maximize: bool = True,
    enable_restart: bool = True
) -> List[PySide6TrayMenuItem]:
    """
    Create event-driven tray menu items using THREAD_BUS.

    This function creates menu items that trigger global events through THREAD_BUS
    instead of calling functions directly. This follows the signal-driven architecture.

    Args:
        app_name: Application name for display
        enable_show_hide: Enable show/hide window options
        enable_maximize: Enable maximize/minimize options
        enable_restart: Enable restart option

    Returns:
        List of PySide6TrayMenuItem configurations

    Global Events Triggered:
        - window.show: Show window
        - window.hide: Hide window
        - window.maximize: Maximize window
        - window.minimize: Minimize window
        - window.restore: Restore window
        - app.restart: Restart application
        - app.close: Close application

    Example:
        menu_items = create_event_driven_tray_menu(app_name="MyApp")
        tray.set_menu_items(menu_items)

        # In main window, listen to events:
        THREAD_BUS.register_event_handler('window.show', lambda e: window.show())
        THREAD_BUS.register_event_handler('app.close', lambda e: app.quit())
    """
    if not HAS_THREAD_BUS:
        raise RuntimeError("THREAD_BUS not available. Cannot create event-driven menu.")

    items = []

    # Show/Hide actions
    if enable_show_hide:
        items.append(PySide6TrayMenuItem(
            text="Show Window",
            callback=lambda: THREAD_BUS.trigger_event('window.show')
        ))
        items.append(PySide6TrayMenuItem(
            text="Hide Window",
            callback=lambda: THREAD_BUS.trigger_event('window.hide')
        ))
        items.append(PySide6TrayMenuItem(text="---", separator=True))

    # Window state actions
    if enable_maximize:
        items.append(PySide6TrayMenuItem(
            text="Maximize",
            callback=lambda: THREAD_BUS.trigger_event('window.maximize')
        ))
        items.append(PySide6TrayMenuItem(
            text="Minimize to Tray",
            callback=lambda: THREAD_BUS.trigger_event('window.minimize')
        ))
        items.append(PySide6TrayMenuItem(
            text="Restore",
            callback=lambda: THREAD_BUS.trigger_event('window.restore')
        ))
        items.append(PySide6TrayMenuItem(text="---", separator=True))

    # Restart action
    if enable_restart:
        items.append(PySide6TrayMenuItem(
            text="Restart",
            callback=lambda: THREAD_BUS.trigger_event('app.restart')
        ))
        items.append(PySide6TrayMenuItem(text="---", separator=True))

    # Quit action (always enabled)
    items.append(PySide6TrayMenuItem(
        text=f"Quit {app_name}",
        callback=lambda: THREAD_BUS.trigger_event('app.close', {'source': 'tray_menu'})
    ))

    return items
