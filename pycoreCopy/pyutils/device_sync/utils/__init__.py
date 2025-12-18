# -*- coding: utf-8 -*-
"""
Utils Module - Utility tools for Device Sync

Contains status checking, diagnostics, shortcuts, and daemon functionality.
"""

from .status import check_status, diagnose, check_ipc_server, check_pystray, check_process, view_log
from .shortcut import create_desktop_shortcut
from .daemon import run_in_background

__all__ = [
    # Status and diagnostics
    'check_status',
    'diagnose',
    'check_ipc_server',
    'check_pystray',
    'check_process',
    'view_log',

    # Shortcuts
    'create_desktop_shortcut',

    # Daemon
    'run_in_background',
]
