#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
USB Monitor - USB Device Detection and Wireless Conversion

Monitors USB-connected ADB devices and automatically converts them to wireless connections.
Implements the workflow: USB detection → Get IP → Enable tcpip 5555 → Connect wireless.
"""

import time
import threading
from typing import List, Set, Optional, Dict
from pycore import ColorPrint
from pyapps.matrix.adb_device_manager.adb_executor import ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import DeviceTable, DeviceInfo, DeviceState, DeviceType


class USBMonitor:
    """
    USB device monitor and wireless converter    """
    def __init__(
        self,
        adb_executor: ADBExecutor,
        device_table: DeviceTable,
        auto_convert: bool = True,
        conversion_delay: float = 2.0
    ):
        """
        Initialize USB monitor        Args:
            adb_executor: ADB executor instance
            device_table: Device table instance
            auto_convert: Auto-convert USB to wireless (default: True)
            conversion_delay: Delay after tcpip command (default: 2.0s)
        """
        self.adb = adb_executor
        self.device_table = device_table
        self.auto_convert = auto_convert
        self.conversion_delay = conversion_delay

        self._known_usb_devices: Set[str] = set()
        self._converting_devices: Dict[str, float] = {}  # serial -> start_time

    
    def scan_usb_devices(self) -> List[str]:
        """
        Scan for USB devices

        Returns:
            List of USB device serials
        """
        devices = self.adb.get_devices()
        usb_devices = []

        for serial, state in devices:
            if state != 'device':
                continue

            if not ADBExecutor.is_wifi_device(serial):
                usb_devices.append(serial)

        return usb_devices

    def detect_new_usb_devices(self) -> List[str]:
        """
        Detect new USB devices (not seen before)

        Returns:
            List of new USB device serials
        """
        current_devices = set(self.scan_usb_devices())
        new_devices = current_devices - self._known_usb_devices

        self._known_usb_devices = current_devices

        return list(new_devices)

    def convert_usb_to_wireless(self, serial: str) -> bool:
        """
        Convert USB device to wireless

        Workflow:
        1. Get device IP
        2. Enable tcpip 5555
        3. Wait for device to restart adbd
        4. Connect wireless
        5. Update device table

        Args:
            serial: USB device serial

        Returns:
            True if conversion successful
        """
        if serial in self._converting_devices:
            ColorPrint.yellow(f"[USBMonitor] Device {serial} is already being converted")
            return False

        ColorPrint.blue(f"[USBMonitor] Starting conversion: {serial} → wireless")

        self._converting_devices[serial] = time.time()

        try:
            device = self.device_table.get_device(serial)
            if device:
                self.device_table.update_device_state(serial, DeviceState.CONFIGURING)

            ip = self.adb.get_device_ip(serial)
            if not ip:
                ColorPrint.red(f"[USBMonitor] Failed to get IP for {serial}")
                if device:
                    device.mark_error("Failed to get IP")
                return False

            ColorPrint.green(f"[USBMonitor] Device IP: {ip}")

            if not self.adb.enable_tcpip(serial, 5555):
                ColorPrint.red(f"[USBMonitor] Failed to enable tcpip for {serial}")
                if device:
                    device.mark_error("Failed to enable tcpip")
                return False

            ColorPrint.blue(f"[USBMonitor] Waiting {self.conversion_delay}s for adbd restart...")
            time.sleep(self.conversion_delay)

            if not self.adb.connect_wireless(ip, 5555):
                ColorPrint.red(f"[USBMonitor] Failed to connect wireless to {ip}:5555")
                if device:
                    device.mark_error("Failed to connect wireless")
                return False

            wifi_serial = f"{ip}:5555"
            ColorPrint.green(f"[USBMonitor] Conversion successful: {serial} → {wifi_serial}")

            if device:
                self.device_table.update_device(
                    serial,
                    usb_serial=serial,
                    wifi_ip=ip,
                    conversion_time=time.time(),
                    state=DeviceState.WIFI_CONNECTED
                )

                wifi_device = DeviceInfo(
                    serial=wifi_serial,
                    device_type=DeviceType.WIFI,
                    state=DeviceState.WIFI_CONNECTED,
                    ip_address=ip,
                    usb_serial=serial,
                    wifi_ip=ip,
                    conversion_time=time.time()
                )
                self.device_table.add_device(wifi_device)

                # ✅ Also register wireless device in global DeviceManager's device_states
                from pycore.pyutils.device_manager import device_manager, DeviceState as DMDeviceState
                if wifi_serial not in device_manager.device_states:
                    minimal_state = DMDeviceState(
                        serial=wifi_serial,
                        info=None,
                        connected=False,
                        streaming=False,
                        controllable=False
                    )
                    device_manager.device_states[wifi_serial] = minimal_state
                    ColorPrint.blue(f"[USBMonitor] Registered {wifi_serial} in DeviceManager.device_states")

            return True

        except Exception as e:
            ColorPrint.red(f"[USBMonitor] Conversion error for {serial}: {e}")
            device = self.device_table.get_device(serial)
            if device:
                device.mark_error(str(e))
            return False

        finally:
            if serial in self._converting_devices:
                del self._converting_devices[serial]

    def process_usb_devices(self) -> Dict[str, bool]:
        """
        Process all USB devices (detect and convert new ones)

        Returns:
            Dictionary of {serial: conversion_success}
        """
        new_devices = self.detect_new_usb_devices()
        results = {}

        if not new_devices:
            return results

        ColorPrint.blue(f"[USBMonitor] Detected {len(new_devices)} new USB device(s)")

        for serial in new_devices:
            device_info = DeviceInfo(
                serial=serial,
                device_type=DeviceType.USB,
                state=DeviceState.USB_CONNECTED
            )

            self.device_table.add_device(device_info)

            # ✅ Also register in global DeviceManager's device_states
            from pycore.pyutils.device_manager import device_manager, DeviceState as DMDeviceState
            if serial not in device_manager.device_states:
                minimal_state = DMDeviceState(
                    serial=serial,
                    info=None,
                    connected=False,
                    streaming=False,
                    controllable=False
                )
                device_manager.device_states[serial] = minimal_state
                ColorPrint.blue(f"[USBMonitor] Registered {serial} in DeviceManager.device_states")

            if self.auto_convert:
                success = self.convert_usb_to_wireless(serial)
                results[serial] = success

        return results

    def get_conversion_status(self) -> Dict[str, float]:
        """
        Get current conversion status

        Returns:
            Dictionary of {serial: elapsed_time}
        """
        current_time = time.time()
        return {
            serial: current_time - start_time
            for serial, start_time in self._converting_devices.items()
        }

    def is_converting(self, serial: str) -> bool:
        """Check if device is currently being converted"""
        return serial in self._converting_devices


# ✅ 延迟初始化（避免循环依赖）
_usb_monitor: Optional['USBMonitor'] = None

def get_usb_monitor() -> 'USBMonitor':
    """获取全局USBMonitor实例（延迟初始化）"""
    global _usb_monitor
    if _usb_monitor is None:
        from pyapps.matrix.adb_device_manager.adb_executor import adb_executor
        from pyapps.matrix.adb_device_manager.device_table import device_table
        _usb_monitor = USBMonitor(
            adb_executor=adb_executor,
            device_table=device_table,
            auto_convert=True,
            conversion_delay=2.0
        )
    return _usb_monitor

__all__ = ["USBMonitor", "get_usb_monitor"]
