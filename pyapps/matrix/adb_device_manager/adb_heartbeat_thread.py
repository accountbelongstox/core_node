#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Heartbeat Thread - Main Device Management Loop

Implements periodic device discovery, monitoring, and management tasks:
1. Network scanning for Root devices (every 30s)
2. USB device detection and wireless conversion (every 5s)
3. Device table maintenance and cleanup (every 60s)
4. Stable device heartbeat updates (every 10s)
"""

import time
import threading
from typing import Optional
from pycore import ColorPrint
from pyapps.matrix.adb_device_manager.adb_executor import adb_executor, ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import device_table, DeviceTable, DeviceInfo, DeviceState, DeviceType
from pyapps.matrix.adb_device_manager.network_scanner import network_scanner, NetworkScanner
from pyapps.matrix.adb_device_manager.usb_monitor import get_usb_monitor


class ADBHeartbeatThread(threading.Thread):
    """
    ADB Device Management Heartbeat Thread

    Runs periodic tasks for device discovery, monitoring, and management.
    Inherits directly from threading.Thread as per pycore standards.
    """

    def __init__(
        self,
        adb_path: str = "adb",
        tick_interval: float = 1.0,
        network_scan_interval: float = 30.0,
        usb_scan_interval: float = 5.0,
        cleanup_interval: float = 60.0,
        heartbeat_interval: float = 10.0,
        push_interval: float = 10.0,
        daemon: bool = True
    ):
        """
        Initialize ADB heartbeat thread

        Args:
            adb_path: Path to adb executable
            tick_interval: Main loop interval (default: 1.0s)
            network_scan_interval: Network scan interval (default: 30.0s)
            usb_scan_interval: USB scan interval (default: 5.0s)
            cleanup_interval: Cleanup interval (default: 60.0s)
            heartbeat_interval: Heartbeat update interval (default: 10.0s)
            daemon: Run as daemon thread
        """
        super().__init__(name='ADBHeartbeatThread', daemon=daemon)

        self.tick_interval = tick_interval
        self.network_scan_interval = network_scan_interval
        self.usb_scan_interval = usb_scan_interval
        self.cleanup_interval = cleanup_interval
        self.heartbeat_interval = heartbeat_interval
        self.push_interval = push_interval

        self._stop_flag = False
        self._running = False
        self.rpc_server = None

        # ✅ Use global singleton instances (DO NOT instantiate with ClassName())
        self.device_table = device_table
        self.adb = ADBExecutor.instance(adb_path=adb_path)
        self.network_scanner = NetworkScanner.instance(port=5555, timeout=0.2)
        self.usb_monitor = USBMonitor.instance(auto_convert=True)

        self._last_network_scan = 0.0
        self._last_usb_scan = 0.0
        self._last_cleanup = 0.0
        self._last_heartbeat = 0.0
        self._last_push = 0.0

        self._tick_count = 0
        self._start_time: Optional[float] = None

    def run(self):
        """Main heartbeat loop"""
        self._running = True
        self._start_time = time.time()

        ColorPrint.green(f"[ADBHeartbeat] Started (tick={self.tick_interval}s)")
        ColorPrint.blue(f"[ADBHeartbeat] Network scan interval: {self.network_scan_interval}s")
        ColorPrint.blue(f"[ADBHeartbeat] USB scan interval: {self.usb_scan_interval}s")
        ColorPrint.blue(f"[ADBHeartbeat] Cleanup interval: {self.cleanup_interval}s")
        ColorPrint.blue(f"[ADBHeartbeat] Heartbeat interval: {self.heartbeat_interval}s")
        ColorPrint.blue(f"[ADBHeartbeat] Push interval: {self.push_interval}s")

        while not self._stop_flag:
            tick_start = time.time()

            self._tick_count += 1
            current_time = time.time()

            if current_time - self._last_network_scan >= self.network_scan_interval:
                self._network_scan_task()
                self._last_network_scan = current_time

            if current_time - self._last_usb_scan >= self.usb_scan_interval:
                self._usb_scan_task()
                self._last_usb_scan = current_time

            if current_time - self._last_cleanup >= self.cleanup_interval:
                self._cleanup_task()
                self._last_cleanup = current_time

            if current_time - self._last_heartbeat >= self.heartbeat_interval:
                self._heartbeat_task()
                self._last_heartbeat = current_time

            if self.rpc_server and self.push_interval and current_time - self._last_push >= self.push_interval:
                self._push_device_updates()
                self._last_push = current_time

            elapsed = time.time() - tick_start
            sleep_time = max(0, self.tick_interval - elapsed)

            if sleep_time > 0:
                time.sleep(sleep_time)

        self._running = False
        ColorPrint.blue("[ADBHeartbeat] Stopped")

    def _network_scan_task(self):
        """
        Network scan task

        Scans local network for devices with port 5555 open (Root devices).
        Attempts to connect to found devices.
        """
        ColorPrint.blue("[ADBHeartbeat] Running network scan task...")

        found_ips = self.network_scanner.scan_network()

        if not found_ips:
            return

        existing_wifi_devices = {
            ADBExecutor.extract_ip_from_serial(d.serial)
            for d in self.device_table.get_wifi_devices()
            if d.ip_address
        }

        new_ips = [ip for ip in found_ips if ip not in existing_wifi_devices]

        if not new_ips:
            ColorPrint.blue("[ADBHeartbeat] No new devices found in network scan")
            return

        ColorPrint.green(f"[ADBHeartbeat] Found {len(new_ips)} new device(s) on network")

        for ip in new_ips:
            serial = f"{ip}:5555"

            existing = self.device_table.get_device(serial)
            if existing:
                existing.update_heartbeat()
                continue

            if self.adb.connect_wireless(ip, 5555):
                ColorPrint.green(f"[ADBHeartbeat] Connected to network device: {serial}")

                is_root = self.adb.check_device_root(serial)
                device_info = self.adb.get_device_info(serial)

                device = DeviceInfo(
                    serial=serial,
                    device_type=DeviceType.ROOT if is_root else DeviceType.WIFI,
                    state=DeviceState.WIFI_CONNECTED,
                    ip_address=ip,
                    is_root=is_root,
                    model=device_info.get('model'),
                    android_version=device_info.get('android_version')
                )

                self.device_table.add_device(device)
                ColorPrint.green(f"[ADBHeartbeat] Added device: {serial} (root={is_root})")

    def _usb_scan_task(self):
        """
        USB scan task

        Scans for USB devices and converts them to wireless.
        Skips already stable WiFi-connected devices.
        """
        ColorPrint.blue("[ADBHeartbeat] Running USB scan task...")

        results = self.usb_monitor.process_usb_devices()

        if not results:
            return

        for serial, success in results.items():
            if success:
                ColorPrint.green(f"[ADBHeartbeat] USB device {serial} converted to wireless")
            else:
                ColorPrint.yellow(f"[ADBHeartbeat] Failed to convert USB device {serial}")

    def _cleanup_task(self):
        """
        Cleanup task

        Removes stale devices from the device table.
        """
        ColorPrint.blue("[ADBHeartbeat] Running cleanup task...")

        removed = self.device_table.cleanup_stale_devices(timeout=120.0)

        if removed > 0:
            ColorPrint.yellow(f"[ADBHeartbeat] Cleaned up {removed} stale device(s)")

        stats = self.device_table.get_stats()
        ColorPrint.blue(f"[ADBHeartbeat] Device stats: {stats['total_devices']} total, "
                       f"{stats['usb_devices']} USB, {stats['wifi_devices']} WiFi, "
                       f"{stats['root_devices']} Root")

    def _heartbeat_task(self):
        """
        Heartbeat task

        Updates heartbeat for all connected devices.
        """
        devices = self.adb.get_devices()
        serials = {serial for serial, state in devices if state == 'device'}

        for device in self.device_table.get_all_devices():
            if device.serial in serials:
                device.update_heartbeat()

                if device.state == DeviceState.DISCONNECTED:
                    if device.device_type == DeviceType.USB:
                        self.device_table.update_device_state(device.serial, DeviceState.USB_CONNECTED)
                    elif device.device_type in (DeviceType.WIFI, DeviceType.ROOT):
                        self.device_table.update_device_state(device.serial, DeviceState.WIFI_CONNECTED)

    def _push_device_updates(self):
        """
        Push device updates to all WebSocket clients via RPC v2.
        """
        device_table = self.device_table
        all_devices = device_table.get_all_devices()

        devices_list = []
        for device_info in all_devices:
            devices_list.append({
                "serial": device_info.serial,
                "ip": device_info.ip_address,
                "connection_type": device_info.device_type.value,
                "state": device_info.state.value,
                "is_root": device_info.is_root,
                "model": device_info.model,
                "android_version": device_info.android_version,
                "last_seen": device_info.last_seen,
                "connected_at": device_info.first_seen,
            })

        stats = device_table.get_stats()
        payload = {
            "devices": devices_list,
            "count": len(devices_list),
            "stats": stats,
            "timestamp": int(time.time() * 1000)
        }

        self.rpc_server.broadcast_notification(
            event="adb.devices.update",
            data=payload
        )
        ColorPrint.green(f"[ADBHeartbeat] Pushed device list (count: {len(devices_list)})")

    def stop(self):
        """Stop heartbeat thread"""
        ColorPrint.yellow("[ADBHeartbeat] Stopping...")
        self._stop_flag = True

    def is_running(self) -> bool:
        """Check if thread is running"""
        return self._running

    def set_rpc_server(self, rpc_server, push_interval: Optional[float] = None):
        """
        Attach RPC server for device push notifications.

        Args:
            rpc_server: RPC v2 server instance
            push_interval: Override push interval (seconds)
        """
        self.rpc_server = rpc_server
        if push_interval is not None:
            self.push_interval = push_interval
        self._last_push = 0.0
        ColorPrint.green(f"[ADBHeartbeat] RPC server attached for device push (interval={self.push_interval}s)")

    def get_stats(self) -> dict:
        """Get heartbeat statistics"""
        uptime = time.time() - self._start_time if self._start_time else 0.0

        return {
            'running': self._running,
            'tick_count': self._tick_count,
            'uptime': uptime,
            'device_table': self.device_table.get_stats(),
            'intervals': {
                'tick': self.tick_interval,
                'network_scan': self.network_scan_interval,
                'usb_scan': self.usb_scan_interval,
                'cleanup': self.cleanup_interval,
                'heartbeat': self.heartbeat_interval
            }
        }

    def get_device_table(self) -> DeviceTable:
        """Get device table instance"""
        return self.device_table

    def get_adb_executor(self) -> ADBExecutor:
        """Get ADB executor instance"""
        return self.adb
