#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Utilities

Cross-platform clipboard operations with history and monitoring.
"""

from pycore.pyutils.clipboard.clipboard_manager import clipboard_manager
from pycore.pyutils.clipboard.clipboard_history import ClipboardHistory, get_clipboard_history
from pycore.pyutils.clipboard.clipboard_monitor import ClipboardMonitor, get_clipboard_monitor
from pycore.pyutils.clipboard.clipboard_sync import add_recognition_to_clipboard, get_recognition_sync_callback

__all__ = [
    'clipboard_manager',
    'ClipboardHistory',
    'get_clipboard_history',
    'ClipboardMonitor',
    'get_clipboard_monitor',
    'add_recognition_to_clipboard',
    'get_recognition_sync_callback'
]
