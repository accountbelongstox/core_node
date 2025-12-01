# -*- coding: utf-8 -*-
"""
Tray Menu Builder for Pycore Module Caller

Builds tray menu items with dynamic state getters.
This module only defines menu structure, does not start any threads.
"""

import platform
from typing import List

from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem
from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

IS_WINDOWS = platform.system() == 'Windows'


def build_tray_menu(port: int, singleton_port: int = None) -> List[TrayMenuItem]:
    """
    Build tray menu items with dynamic state getters

    Args:
        port: RPC v2 server port
        singleton_port: Singleton port (optional)

    Returns:
        List of TrayMenuItem objects
    """
    # State getter for Code Sync
    def get_code_sync_state():
        """Get current code sync mode state"""
        manager = get_code_sync_manager()
        mode = manager.get_mode()
        if mode == "server":
            return "[S]"  # Server mode
        elif mode == "client":
            return "[C]"  # Client mode
        else:
            return "[ ]"  # Disabled

    # State getter for Auto-Start
    def get_autostart_state():
        """Get current auto-start state"""
        if IS_WINDOWS:
            startup_manager = WindowsStartupManager()
            enabled = startup_manager.is_enabled()
            return "[X]" if enabled else "[ ]"
        return "[ ]"

    # Define menu items
    menu_items = [
        TrayMenuItem(
            text="Open Web Interface",
            action_signal="tray_action_open",
            default=True
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text=f"RPC v2 Server: {port}",
            action_signal="",
            enabled=False
        ),
    ]

    # Add singleton port info if available
    if singleton_port is not None:
        menu_items.append(
            TrayMenuItem(
                text=f"Singleton Port: {singleton_port}",
                action_signal="",
                enabled=False
            )
        )

    menu_items.extend([
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Code Sync (Disabled/Server/Client)",
            action_signal="tray_action_toggle_code_sync",
            state_getter=get_code_sync_state
        ),
        TrayMenuItem(
            text="Voice Subtitle Window",
            action_signal="tray_action_toggle_voice_subtitle"
        ),
        TrayMenuItem(
            text="Auto-Start on Boot",
            action_signal="tray_action_toggle_startup",
            state_getter=get_autostart_state
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Restart",
            action_signal="tray_action_restart"
        ),
        TrayMenuItem(
            text="Exit",
            action_signal="tray_action_exit"
        )
    ])

    return menu_items
