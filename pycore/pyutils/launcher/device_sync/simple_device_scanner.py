# -*- coding: utf-8 -*-
"""Compatibility exports for the canonical device-sync scanner."""

from pycore.pyutils.launcher.device_sync.core.scanner import (
    DEVICE_SYNC_PORT,
    MAX_THREADS,
    SCAN_TIMEOUT,
    SimpleDeviceScanner,
    get_network_scanner,
)


__all__ = [
    "DEVICE_SYNC_PORT",
    "MAX_THREADS",
    "SCAN_TIMEOUT",
    "SimpleDeviceScanner",
    "get_network_scanner",
]
