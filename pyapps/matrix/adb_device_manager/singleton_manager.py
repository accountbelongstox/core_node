#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全局单例管理器

统一管理所有ADB相关全局单例的初始化顺序，避免循环依赖。

初始化顺序：
1. NetworkScanner（无依赖）
2. ADBExecutor（无依赖）
3. DeviceTable（无依赖）
4. USBMonitor（依赖 ADBExecutor, DeviceTable）
"""

from typing import Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# 全局单例引用
_network_scanner = None
_adb_executor = None
_device_table = None
_usb_monitor = None

_initialized = False


def initialize_singletons():
    """
    初始化所有全局单例（按正确的依赖顺序）

    此函数应在应用启动时调用一次
    """
    global _network_scanner, _adb_executor, _device_table, _usb_monitor, _initialized

    if _initialized:
        ColorPrint.yellow("[SingletonManager] 单例已初始化，跳过")
        return

    ColorPrint.blue("[SingletonManager] 开始初始化全局单例...")

    # 1. NetworkScanner（无依赖）
    from pyapps.matrix.adb_device_manager.network_scanner import network_scanner
    _network_scanner = network_scanner
    ColorPrint.green("  ✓ NetworkScanner")

    # 2. ADBExecutor（无依赖）
    from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
    _adb_executor = adb_executor
    ColorPrint.green("  ✓ ADBExecutor")

    # 3. DeviceTable（无依赖）
    from pyapps.matrix.adb_device_manager.device_table import device_table
    _device_table = device_table
    ColorPrint.green("  ✓ DeviceTable")

    # 4. USBMonitor（依赖 ADBExecutor, DeviceTable）
    from pyapps.matrix.adb_device_manager.usb_monitor import get_usb_monitor
    _usb_monitor = get_usb_monitor()
    ColorPrint.green("  ✓ USBMonitor")

    _initialized = True
    ColorPrint.green("[SingletonManager] ✅ 所有单例初始化完成")


def get_network_scanner():
    """获取NetworkScanner全局实例"""
    if not _initialized:
        initialize_singletons()
    return _network_scanner


def get_adb_executor():
    """获取ADBExecutor全局实例"""
    if not _initialized:
        initialize_singletons()
    return _adb_executor


def get_device_table():
    """获取DeviceTable全局实例"""
    if not _initialized:
        initialize_singletons()
    return _device_table


def get_usb_monitor_instance():
    """获取USBMonitor全局实例"""
    if not _initialized:
        initialize_singletons()
    return _usb_monitor


__all__ = [
    'initialize_singletons',
    'get_network_scanner',
    'get_adb_executor',
    'get_device_table',
    'get_usb_monitor_instance',
]
