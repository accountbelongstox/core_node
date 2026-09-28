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

Architecture (PyHeartbeat Driven):
- adb_executor.py: ADB command execution wrapper
- device_table.py: Device state management
- network_scanner.py: LAN device discovery
- usb_monitor.py: USB device monitoring
- adb_heartbeat_service.py: PyHeartbeat-driven service (no longer a thread)
"""

# ✅ 按正确的依赖顺序导入全局单例（避免循环依赖）
# 1. 无依赖的基础模块
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
from pyapps.matrix.adb_device_manager.device_table import device_table

# 2. 导入类定义
from pyapps.matrix.adb_device_manager.adb_executor import ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import DeviceTable, DeviceInfo, DeviceState, DeviceType

# 3. 导入服务（这些依赖上面的全局单例）
from pyapps.matrix.adb_device_manager.adb_heartbeat_service import (
    ADBHeartbeatService,
    init_adb_heartbeat_service,
    get_adb_heartbeat_service
)

__all__ = [
    # 类定义
    'ADBExecutor',
    'DeviceTable',
    'DeviceInfo',
    'DeviceState',
    'DeviceType',
    'ADBHeartbeatService',
    # 全局单例实例
    'network_scanner',
    'adb_executor',
    'device_table',
    # 服务函数
    'init_adb_heartbeat_service',
    'get_adb_heartbeat_service',
]

__version__ = '2.0.0'  # PyHeartbeat-driven architecture
