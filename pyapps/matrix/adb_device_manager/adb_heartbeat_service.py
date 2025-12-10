#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Heartbeat Service - PyHeartbeat Driven Edition

No longer a Thread. Driven by PyHeartbeat periodic tasks.
Uses ENCYCLOPEDIA for busy state management.
"""

import time
from typing import Optional
from pycore import ColorPrint
from pycore.pyfoundations import ENCYCLOPEDIA, Task
from pyapps.matrix.adb_device_manager.adb_executor import ADBExecutor
from pyapps.matrix.adb_device_manager.device_table import DeviceTable, DeviceInfo, DeviceState, DeviceType
from pyapps.matrix.adb_device_manager.network_scanner import NetworkScanner
from pyapps.matrix.adb_device_manager.usb_monitor import USBMonitor
from pyapps.matrix.services.device_id_manager import DeviceIDManager


class ADBHeartbeatService:
    """
    ADB Device Management Service - PyHeartbeat Driven

    No longer a standalone thread. Receives tasks from PyHeartbeat:
    - adb.network_scan: Scan network for devices
    - adb.usb_scan: Scan USB devices
    - adb.cleanup: Clean up stale devices
    - adb.heartbeat: Update device heartbeats
    - adb.push_devices: Push device list to clients

    Uses ENCYCLOPEDIA for busy state management.
    """

    def __init__(self, adb_path: str = "adb"):
        """
        Initialize ADB heartbeat service

        Args:
            adb_path: Path to adb executable
        """
        self.device_table = DeviceTable()
        self.adb = ADBExecutor(adb_path=adb_path)
        self.network_scanner = NetworkScanner(port=5555, timeout=0.2)
        self.usb_monitor = USBMonitor(
            adb_executor=self.adb,
            device_table=self.device_table,
            auto_convert=True
        )

        self.rpc_server = None
        self._start_time = time.time()
        self._task_count = {}

        ColorPrint.green("[ADBHeartbeatService] Initialized (PyHeartbeat driven)")

    def set_rpc_server(self, rpc_server):
        """
        Attach RPC server for device push notifications

        Args:
            rpc_server: RPC v2 server instance
        """
        self.rpc_server = rpc_server
        ColorPrint.green("[ADBHeartbeatService] RPC server attached")

    def handle_task(self, task: Task) -> bool:
        """
        Handle ADB task from PyHeartbeat

        Args:
            task: Task instance

        Returns:
            True if task accepted and processed
        """
        task_type = task.task_type

        # Check if service is busy
        busy_key = f"adb_service.{task_type}.busy"
        if ENCYCLOPEDIA.get(busy_key, False):
            ColorPrint.yellow(f"[ADBService] Busy, skipping {task_type}")
            return False

        # Mark as busy
        ENCYCLOPEDIA.add(busy_key, True)

        try:
            # Route task to handler
            if task_type == "adb.network_scan":
                self._network_scan_task()
            elif task_type == "adb.usb_scan":
                self._usb_scan_task()
            elif task_type == "adb.cleanup":
                self._cleanup_task()
            elif task_type == "adb.heartbeat":
                self._heartbeat_task()
            elif task_type == "adb.push_devices":
                self._push_device_updates()
            else:
                ColorPrint.yellow(f"[ADBService] Unknown task type: {task_type}")
                return False

            # Track task count
            self._task_count[task_type] = self._task_count.get(task_type, 0) + 1

            # Mark task as completed
            task.mark_completed()
            return True

        except Exception as e:
            ColorPrint.red(f"[ADBService] Error handling {task_type}: {e}")
            task.mark_failed(str(e))
            return False

        finally:
            # Clear busy flag
            ENCYCLOPEDIA.add(busy_key, False)

    def _network_scan_task(self):
        """Network scan task"""
        ColorPrint.blue("[ADBService] Running network scan task...")

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
            ColorPrint.blue("[ADBService] No new devices found in network scan")
            return

        ColorPrint.green(f"[ADBService] Found {len(new_ips)} new device(s) on network")

        for ip in new_ips:
            serial = f"{ip}:5555"

            existing = self.device_table.get_device(serial)
            if existing:
                existing.update_heartbeat()
                continue

            if self.adb.connect_wireless(ip, 5555):
                ColorPrint.green(f"[ADBService] Connected to network device: {serial}")

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

                added = self.device_table.add_device(device)
                if added:
                    # Register device with DeviceIDManager
                    device_id_manager = DeviceIDManager.instance()
                    device_id = device_id_manager.register_device(serial)
                    ColorPrint.green(f"[ADBService] Added device: {serial} -> {device_id} (root={is_root})")

    def _usb_scan_task(self):
        """USB scan task"""
        ColorPrint.blue("[ADBService] Running USB scan task...")

        results = self.usb_monitor.process_usb_devices()

        # Register all devices with DeviceIDManager
        device_id_manager = DeviceIDManager.instance()
        all_devices = self.device_table.get_all_devices()
        for device in all_devices:
            device_id_manager.register_device(device.serial)

        if not results:
            return

        for serial, success in results.items():
            if success:
                ColorPrint.green(f"[ADBService] USB device {serial} converted to wireless")
            else:
                ColorPrint.yellow(f"[ADBService] Failed to convert USB device {serial}")

    def _cleanup_task(self):
        """Cleanup task"""
        ColorPrint.blue("[ADBService] Running cleanup task...")

        removed = self.device_table.cleanup_stale_devices(timeout=120.0)

        if removed > 0:
            ColorPrint.yellow(f"[ADBService] Cleaned up {removed} stale device(s)")

        stats = self.device_table.get_stats()
        ColorPrint.blue(f"[ADBService] Device stats: {stats['total_devices']} total, "
                       f"{stats['usb_devices']} USB, {stats['wifi_devices']} WiFi, "
                       f"{stats['root_devices']} Root")

    def _heartbeat_task(self):
        """Heartbeat task"""
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
        """Push device updates to all WebSocket clients via RPC v2"""
        if not self.rpc_server:
            return

        device_table = self.device_table
        all_devices = device_table.get_all_devices()

        # Register all devices with DeviceIDManager and include deviceId in response
        device_id_manager = DeviceIDManager.instance()

        devices_list = []
        for device_info in all_devices:
            device_id = device_id_manager.register_device(device_info.serial)
            devices_list.append({
                "deviceId": device_id,  # Primary ID for frontend use
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

        # Use synchronous wrapper to broadcast from non-async context
        # Note: broadcast_event_sync() will silently return if event loop is not ready yet
        # (i.e., before first WebSocket client connects)
        self.rpc_server.broadcast_event_sync(
            event_name="adb.devices.update",
            data=payload
        )

    def get_stats(self) -> dict:
        """Get service statistics"""
        uptime = time.time() - self._start_time

        return {
            'uptime': uptime,
            'task_counts': self._task_count,
            'device_table': self.device_table.get_stats()
        }

    def get_device_table(self) -> DeviceTable:
        """Get device table instance"""
        return self.device_table

    def get_adb_executor(self) -> ADBExecutor:
        """Get ADB executor instance"""
        return self.adb


# Global instance
_adb_heartbeat_service: Optional[ADBHeartbeatService] = None


def get_adb_heartbeat_service() -> Optional[ADBHeartbeatService]:
    """Get global ADB heartbeat service instance"""
    return _adb_heartbeat_service


def init_adb_heartbeat_service(adb_path: str = "adb") -> ADBHeartbeatService:
    """
    Initialize ADB heartbeat service

    Args:
        adb_path: Path to adb executable

    Returns:
        ADBHeartbeatService instance
    """
    global _adb_heartbeat_service

    if _adb_heartbeat_service is None:
        _adb_heartbeat_service = ADBHeartbeatService(adb_path=adb_path)

    return _adb_heartbeat_service
