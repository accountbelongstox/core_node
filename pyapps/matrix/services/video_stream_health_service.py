#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video Stream Health Check Service

Monitors device connection health and performs automatic reconnection.
Integrates with the unified heartbeat system for periodic health checks.

Architecture:
- Registers callback to heartbeat system (10s interval)
- Checks each active device's connection status
- Attempts automatic reconnection when connection fails
- Broadcasts device status changes via RPC WebSocket
"""

import sys
from pathlib import Path
from typing import Dict, Optional, Set
import time
import asyncio

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.device import ScrcpyDevice
from pyapps.matrix.matrix_config import Config


class DeviceHealthStatus:
    """Device health status tracking"""

    HEALTHY = 'healthy'
    WARNING = 'warning'
    ERROR = 'error'
    RECONNECTING = 'reconnecting'

    def __init__(self, serial: str, max_reconnect_attempts: int = 3):
        self.serial = serial
        self.status = self.HEALTHY
        self.last_check_time = time.time()
        self.last_data_time = time.time()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = max_reconnect_attempts
        self.error_message: Optional[str] = None

    def mark_healthy(self):
        """Mark device as healthy"""
        self.status = self.HEALTHY
        self.last_data_time = time.time()
        self.reconnect_attempts = 0
        self.error_message = None

    def mark_warning(self, message: str):
        """Mark device with warning"""
        self.status = self.WARNING
        self.error_message = message

    def mark_error(self, message: str):
        """Mark device as error"""
        self.status = self.ERROR
        self.error_message = message

    def mark_reconnecting(self):
        """Mark device as reconnecting"""
        self.status = self.RECONNECTING
        self.reconnect_attempts += 1

    def should_reconnect(self) -> bool:
        """Check if should attempt reconnection"""
        return (
            self.status in (self.ERROR, self.WARNING) and
            self.reconnect_attempts < self.max_reconnect_attempts
        )

    def get_reconnect_delay(self) -> float:
        """Get reconnect delay with exponential backoff"""
        # Exponential backoff: 1s, 2s, 4s
        return min(2 ** self.reconnect_attempts, 4)


class VideoStreamHealthService:
    """
    Video stream health monitoring service

    Integrates with unified heartbeat system to perform periodic health checks
    and automatic reconnection for video streaming devices.
    """

    _instance: Optional['VideoStreamHealthService'] = None

    def __init__(self):
        self.device_manager = DeviceManager.instance()
        self.device_health: Dict[str, DeviceHealthStatus] = {}

        # Track devices that have active streams
        self.active_stream_devices: Set[str] = set()

        # RPC server for broadcasting status updates
        self._rpc_server = None

        # VideoStreamService reference for cleanup coordination
        self._video_stream_service = None

        # Health check configuration (use Config constants)
        self.health_check_interval = Config.HEALTH_CHECK_INTERVAL
        self.data_timeout = Config.HEALTH_DATA_TIMEOUT
        self.max_reconnect_attempts = Config.HEALTH_MAX_RECONNECT_ATTEMPTS
        self.reconnect_base_delay = Config.HEALTH_RECONNECT_BASE_DELAY
        self.reconnect_max_delay = Config.HEALTH_RECONNECT_MAX_DELAY

        ColorPrint.green("[VideoStreamHealth] Service initialized")
        ColorPrint.blue(f"  - Health check interval: {self.health_check_interval}s")
        ColorPrint.blue(f"  - Data timeout: {self.data_timeout}s")
        ColorPrint.blue(f"  - Max reconnect attempts: {self.max_reconnect_attempts}")

    @classmethod
    def instance(cls) -> 'VideoStreamHealthService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def set_rpc_server(self, rpc_server):
        """Set RPC server for broadcasting status updates"""
        self._rpc_server = rpc_server
        ColorPrint.green("[VideoStreamHealth] RPC server attached")

    def set_video_stream_service(self, video_stream_service):
        """Set VideoStreamService reference for cleanup coordination"""
        self._video_stream_service = video_stream_service
        ColorPrint.green("[VideoStreamHealth] VideoStreamService attached")

    def register_device(self, serial: str):
        """Register a device for health monitoring"""
        if serial not in self.device_health:
            self.device_health[serial] = DeviceHealthStatus(serial, self.max_reconnect_attempts)
            ColorPrint.blue(f"[VideoStreamHealth] Registered device: {serial}")

    def unregister_device(self, serial: str):
        """Unregister a device from health monitoring"""
        if serial in self.device_health:
            del self.device_health[serial]
            ColorPrint.blue(f"[VideoStreamHealth] Unregistered device: {serial}")

        if serial in self.active_stream_devices:
            self.active_stream_devices.discard(serial)

    def mark_device_active(self, serial: str):
        """Mark device as having active stream"""
        self.active_stream_devices.add(serial)
        self.register_device(serial)

    def mark_device_inactive(self, serial: str):
        """Mark device as no longer having active stream"""
        self.active_stream_devices.discard(serial)

    def update_data_timestamp(self, serial: str):
        """
        Update last data received timestamp for device

        This is called every time a frame is received from the device.
        If device was in RECONNECTING state and now receiving data, mark as HEALTHY.
        """
        if serial in self.device_health:
            health = self.device_health[serial]
            health.last_data_time = time.time()

            # If device was reconnecting and now receiving data, mark as recovered
            if health.status == DeviceHealthStatus.RECONNECTING:
                ColorPrint.green(f"[VideoStreamHealth] Device {serial} recovered from reconnection")
                health.mark_healthy()
                self._broadcast_device_status(serial, health)

    def check_all_devices(self):
        """
        Health check callback (called by heartbeat system)

        This method is called every 10 seconds by the heartbeat system.
        It checks all active streaming devices and attempts reconnection if needed.
        """
        if not self.active_stream_devices:
            return

        current_time = time.time()
        ColorPrint.blue(f"[VideoStreamHealth] Checking {len(self.active_stream_devices)} active devices...")

        for serial in list(self.active_stream_devices):
            self._check_device_health(serial, current_time)

    def _check_device_health(self, serial: str, current_time: float):
        """Check health of a single device"""
        if serial not in self.device_health:
            return

        health = self.device_health[serial]

        # CRITICAL: Skip health check if device is already reconnecting
        # This prevents rapid reconnection loops when backend health service
        # and frontend auto-reconnect try to recover simultaneously
        if health.status == DeviceHealthStatus.RECONNECTING:
            ColorPrint.blue(f"[VideoStreamHealth] Device {serial} is reconnecting, skipping health check")
            return

        # ✅ Get device from global DeviceManager (ONLY source of truth)
        device = self.device_manager.get_device(serial)

        if not device:
            ColorPrint.yellow(f"[VideoStreamHealth] Device {serial} not in global DeviceManager")
            health.mark_error("Device not found in global DeviceManager")
            self._broadcast_device_status(serial, health)
            return

        # Check 1: Socket validity
        if not self._is_socket_valid(device):
            ColorPrint.red(f"[VideoStreamHealth] Device {serial} socket invalid")
            health.mark_error("Video socket closed")
            self._attempt_reconnection(serial, device, health)
            return

        # Check 2: Data timeout (30s without data)
        time_since_data = current_time - health.last_data_time
        if time_since_data > self.data_timeout:
            ColorPrint.yellow(f"[VideoStreamHealth] Device {serial} no data for {time_since_data:.1f}s")
            health.mark_warning(f"No data for {time_since_data:.0f}s")
            self._attempt_reconnection(serial, device, health)
            return

        # Check 3: Device still in ADB
        if not self._is_device_in_adb(serial):
            ColorPrint.red(f"[VideoStreamHealth] Device {serial} not in ADB devices")
            health.mark_error("Device disconnected from ADB")
            self._broadcast_device_status(serial, health)
            return

        # All checks passed
        if health.status != DeviceHealthStatus.HEALTHY:
            ColorPrint.green(f"[VideoStreamHealth] Device {serial} recovered")
            health.mark_healthy()
            self._broadcast_device_status(serial, health)

    def _is_socket_valid(self, device) -> bool:
        """Check if device video socket is valid"""
        if not isinstance(device, ScrcpyDevice):
            return False

        video_socket = device._video_socket
        if not video_socket:
            return False

        # Check if socket is closed
        if video_socket.fileno() == -1:
            return False

        return True

    def _is_device_in_adb(self, serial: str) -> bool:
        """Check if device is still in ADB devices list"""
        from pycore.pyutils.device import ADBManager

        adb_path = Config.get_adb_path()
        devices = ADBManager.list_devices(adb_path)

        return serial in [d.serial for d in devices]

    def _attempt_reconnection(self, serial: str, device, health: DeviceHealthStatus):
        """Attempt to reconnect device"""
        if not health.should_reconnect():
            ColorPrint.red(
                f"[VideoStreamHealth] Device {serial} max reconnection attempts reached "
                f"({health.reconnect_attempts}/{health.max_reconnect_attempts})"
            )
            self._broadcast_device_status(serial, health)

            # CRITICAL: Clean up device when max attempts reached
            ColorPrint.yellow(f"[VideoStreamHealth] Cleaning up device {serial} after max reconnection attempts")
            self._cleanup_failed_device(serial)
            return

        health.mark_reconnecting()
        delay = health.get_reconnect_delay()

        ColorPrint.yellow(
            f"[VideoStreamHealth] Attempting reconnection for {serial} "
            f"(attempt {health.reconnect_attempts}/{health.max_reconnect_attempts}, delay={delay}s)"
        )

        # Broadcast reconnecting status to all clients
        self._broadcast_device_status(serial, health)

        # ACTIVE RECONNECTION: Stop the stream to force cleanup and client reconnection
        # This triggers:
        # 1. Stream loop exits and cleans up resources
        # 2. All connected clients get WebSocket close event
        # 3. Frontend auto-reconnect logic triggers new connection
        # 4. New connection starts fresh streaming task
        if self._video_stream_service:
            try:
                ColorPrint.yellow(f"[VideoStreamHealth] Stopping stream for {serial} to trigger reconnection")
                # Use thread-safe sync wrapper (we're in HeartbeatPusher thread)
                self._video_stream_service.force_stop_stream_sync(
                    serial,
                    reason=f"Health check reconnection attempt {health.reconnect_attempts}/{health.max_reconnect_attempts}"
                )
            except Exception as e:
                ColorPrint.red(f"[VideoStreamHealth] Failed to stop stream for reconnection: {e}")
        else:
            ColorPrint.yellow(f"[VideoStreamHealth] No VideoStreamService attached, cannot trigger active reconnection")


    def _cleanup_failed_device(self, serial: str):
        """
        Clean up device that has exceeded max reconnection attempts

        This ensures system consistency by:
        1. Removing device from health monitoring
        2. Stopping active video streams via VideoStreamService
        3. Broadcasting final status to clients
        """
        try:
            # 1. Remove from active devices and health tracking
            if serial in self.active_stream_devices:
                self.active_stream_devices.discard(serial)
                ColorPrint.blue(f"[VideoStreamHealth] Removed {serial} from active devices")

            # Store health status before cleanup for final broadcast
            health = self.device_health.get(serial)

            if serial in self.device_health:
                del self.device_health[serial]
                ColorPrint.blue(f"[VideoStreamHealth] Removed {serial} from health tracking")

            # 2. Notify VideoStreamService to stop stream (if attached)
            if self._video_stream_service:
                ColorPrint.yellow(f"[VideoStreamHealth] Requesting VideoStreamService to stop stream for {serial}")
                try:
                    # Use thread-safe sync wrapper (we're in HeartbeatPusher thread)
                    self._video_stream_service.force_stop_stream_sync(serial, reason="Max reconnection attempts reached")
                except Exception as e:
                    ColorPrint.red(f"[VideoStreamHealth] Failed to stop stream for {serial}: {e}")
            else:
                ColorPrint.yellow(f"[VideoStreamHealth] No VideoStreamService attached, cannot stop stream")

            # 3. Broadcast final error status
            if health:
                health.mark_error(f"Connection lost (max {health.max_reconnect_attempts} attempts)")
                self._broadcast_device_status(serial, health)

            ColorPrint.green(f"[VideoStreamHealth] ✓ Cleanup completed for {serial}")

        except Exception as e:
            ColorPrint.red(f"[VideoStreamHealth] Error during device cleanup for {serial}: {e}")
            import traceback
            traceback.print_exc()

    def _broadcast_device_status(self, serial: str, health: DeviceHealthStatus):
        """Broadcast device status update via RPC WebSocket"""
        if not self._rpc_server:
            return

        status_message = {
            'type': 'device.status',
            'data': {
                'serial': serial,
                'status': health.status,
                'error_message': health.error_message,
                'reconnect_attempts': health.reconnect_attempts,
                'last_check_time': health.last_check_time,
                'last_data_time': health.last_data_time
            }
        }

        # Broadcast to all connected WebSocket clients
        # Use thread-safe sync wrapper (we're in HeartbeatPusher thread)
        try:
            self._rpc_server.broadcast_event_sync('device.status', status_message['data'])
        except Exception as e:
            ColorPrint.yellow(f"[VideoStreamHealth] Failed to broadcast status: {e}")


def get_video_stream_health_service() -> VideoStreamHealthService:
    """Get singleton instance"""
    return VideoStreamHealthService.instance()


__all__ = ['VideoStreamHealthService', 'get_video_stream_health_service']
