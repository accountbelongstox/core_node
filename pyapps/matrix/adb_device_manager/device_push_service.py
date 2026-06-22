#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Device Push Service - WebSocket Broadcast for ADB Devices

Periodically broadcasts device list to all connected WebSocket clients
using RPC v2 notification mechanism.

FIXED: Now complies with pycore threading standards:
- Inherits from threading.Thread
- Uses threading.Event for stop signal
- Registered with THREAD_BUS via matrix_main.py
"""

import time
import threading
from typing import Optional, TYPE_CHECKING
from pycore import ColorPrint
from pyapps.matrix.services.device_id_manager import DeviceIDManager

if TYPE_CHECKING:
    from pyapps.matrix.adb_device_manager.adb_heartbeat_thread import ADBHeartbeatThread


class DevicePushService(threading.Thread):
    """
    Service to periodically push device list to WebSocket clients

    Architecture:
    - Inherits threading.Thread (pycore compliant)
    - Uses threading.Event for immediate stop response
    - Pulls device list from ADB heartbeat thread
    - Pushes updates to all WebSocket clients via RPC v2
    """

    def __init__(
        self,
        adb_heartbeat_thread: 'ADBHeartbeatThread',
        rpc_server,
        push_interval: float = 10.0,
        daemon: bool = True
    ):
        """
        Initialize device push service

        Args:
            adb_heartbeat_thread: Reference to ADB heartbeat thread
            rpc_server: RPC v2 server instance for broadcasting
            push_interval: Interval between pushes (seconds)
            daemon: Run as daemon thread
        """
        super().__init__(name='DevicePushService', daemon=daemon)

        self.adb_heartbeat_thread = adb_heartbeat_thread
        self.rpc_server = rpc_server
        self.push_interval = push_interval

        self._stop_event = threading.Event()
        self._running = False
        self._last_push_time = 0.0
        self._push_count = 0

    def run(self):
        """Main push loop"""
        self._running = True
        ColorPrint.green(f"[DevicePush] Service started (interval: {self.push_interval}s)")

        while not self._stop_event.is_set():
            try:
                # Use Event.wait() instead of time.sleep() for immediate stop response
                if self._stop_event.wait(timeout=self.push_interval):
                    break  # Stop event was set

                # Get device list from ADB heartbeat
                device_table = self.adb_heartbeat_thread.get_device_table()
                all_devices = device_table.get_all_devices()

                # Register all devices with DeviceIDManager and include deviceId in response
                device_id_manager = DeviceIDManager.instance()

                # Build device list payload
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

                # Broadcast to all WebSocket clients
                payload = {
                    "devices": devices_list,
                    "count": len(devices_list),
                    "stats": stats,
                    "timestamp": int(time.time() * 1000)
                }

                # Use RPC v2's broadcast_notification method
                self.rpc_server.broadcast_notification(
                    event="adb.devices.update",
                    data=payload
                )

                self._last_push_time = time.time()
                self._push_count += 1

                ColorPrint.green(f"[DevicePush] Pushed device list (count: {len(devices_list)}, push #{self._push_count})")

            except Exception as e:
                ColorPrint.red(f"[DevicePush] Error in push loop: {e}")
                if not self._stop_event.wait(timeout=1.0):
                    continue

        self._running = False
        ColorPrint.blue("[DevicePush] Service stopped")

    def stop(self):
        """Stop the push service"""
        ColorPrint.yellow("[DevicePush] Stopping...")
        self._stop_event.set()

    def is_running(self) -> bool:
        """Check if service is running"""
        return self._running and self.is_alive()

    def get_stats(self) -> dict:
        """Get push service statistics"""
        return {
            "running": self._running,
            "push_interval": self.push_interval,
            "last_push_time": self._last_push_time,
            "push_count": self._push_count,
        }


# Global instance
_device_push_service: Optional[DevicePushService] = None


def init_device_push_service(
    adb_heartbeat_thread: 'ADBHeartbeatThread',
    rpc_server,
    push_interval: float = 10.0
) -> DevicePushService:
    """
    Initialize and start device push service

    Args:
        adb_heartbeat_thread: ADB heartbeat thread instance
        rpc_server: RPC v2 server instance
        push_interval: Push interval in seconds

    Returns:
        DevicePushService instance
    """
    global _device_push_service

    if _device_push_service and _device_push_service.is_running():
        ColorPrint.yellow("[DevicePush] Service already initialized")
        return _device_push_service

    _device_push_service = DevicePushService(
        adb_heartbeat_thread=adb_heartbeat_thread,
        rpc_server=rpc_server,
        push_interval=push_interval,
        daemon=True
    )
    _device_push_service.start()

    return _device_push_service


def get_device_push_service() -> Optional[DevicePushService]:
    """Get the global device push service instance"""
    return _device_push_service


def stop_device_push_service():
    """Stop the device push service"""
    global _device_push_service

    if _device_push_service:
        _device_push_service.stop()
        _device_push_service.join(timeout=2.0)
        _device_push_service = None
