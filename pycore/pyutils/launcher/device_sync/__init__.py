# -*- coding: utf-8 -*-
"""
Device Sync - Independent Device Synchronization Module

This module provides device synchronization capabilities without
depending on other pycore.pyutils modules.

Architecture:
- Primary Device: Serves file updates and metadata
- Secondary Device: Syncs code from primary device
- Discovery: Auto-discover primary device on network
- IPC: Single instance control via socket

Features:
- Tkinter tray menu
- File synchronization
- Network discovery
- Single instance enforcement
- Remote control (restart, shutdown)
"""

from .tray_menu import DeviceSyncTrayMenu
from .sync_server import FileSyncServer
from .sync_client import FileSyncClient
from .discovery import DeviceDiscovery
from .ipc_server import IPCServer

__version__ = '1.0.0'

__all__ = [
    'DeviceSyncTrayMenu',
    'FileSyncServer',
    'FileSyncClient',
    'DeviceDiscovery',
    'IPCServer',
]
