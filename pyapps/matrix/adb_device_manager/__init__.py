#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Device Manager - Automated Device Discovery and Management

Provides automated ADB device discovery, wireless conversion, and lifecycle management
for Android devices in the local network.

Features:
1. Network scanning for Root devices with port 5555 open
2. USB device auto-detection and wireless conversion
3. Device table maintenance (add/remove/update)
4. Heartbeat monitoring for device health

Architecture:
- adb_executor.py: ADB command execution wrapper
- device_table.py: Device state management
- network_scanner.py: LAN device discovery
- usb_monitor.py: USB device monitoring
- adb_heartbeat_thread.py: Main heartbeat loop
"""

from pyapps.matrix.adb_device_manager.adb_executor import ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import DeviceTable, DeviceInfo, DeviceState
from pyapps.matrix.adb_device_manager.adb_heartbeat_thread import ADBHeartbeatThread

__all__ = [
    'ADBExecutor',
    'DeviceTable',
    'DeviceInfo',
    'DeviceState',
    'ADBHeartbeatThread',
]

__version__ = '1.0.0'
