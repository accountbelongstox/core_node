#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Device Push Service - WebSocket Broadcast for ADB Devices

Periodically broadcasts device list to all connected WebSocket clients
using RPC v2 notification mechanism.
"""

import time
import threading
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from pyapps.matrix.adb_device_manager.adb_heartbeat_thread import ADBHeartbeatThread


class DevicePushService:
    """
    Service to periodically push device list to WebSocket clients

    Architecture:
    - Runs in a separate daemon thread
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
        self.adb_heartbeat_thread = adb_heartbeat_thread
        self.rpc_server = rpc_server
        self.push_interval = push_interval
        self.daemon = daemon

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_push_time = 0.0
        self._push_count = 0

    def start(self):
        """Start the push service"""
        if self._running:
            print("[DevicePush] Service already running")
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._push_loop,
            name="DevicePushService",
            daemon=self.daemon
        )
        self._thread.start()
        print(f"[DevicePush] Service started (interval: {self.push_interval}s)")

    def stop(self):
        """Stop the push service"""
        if not self._running:
            return

        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
        print("[DevicePush] Service stopped")

    def is_running(self) -> bool:
        """Check if service is running"""
        return self._running

    def get_stats(self) -> dict:
        """Get push service statistics"""
        return {
            "running": self._running,
            "push_interval": self.push_interval,
            "last_push_time": self._last_push_time,
            "push_count": self._push_count,
        }

    def _push_loop(self):
        """Main push loop"""
        while self._running:
            try:
                # Sleep first to avoid immediate push on start
                time.sleep(self.push_interval)

                if not self._running:
                    break

                # Get device list from ADB heartbeat
                device_table = self.adb_heartbeat_thread.get_device_table()
                all_devices = device_table.get_all_devices()

                # Build device list payload
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

                print(f"[DevicePush] Pushed device list (count: {len(devices_list)}, push #{self._push_count})")

            except Exception as e:
                print(f"[DevicePush] Error in push loop: {e}")
                time.sleep(1.0)  # Brief sleep on error


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
        print("[DevicePush] Service already initialized")
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
        _device_push_service = None
