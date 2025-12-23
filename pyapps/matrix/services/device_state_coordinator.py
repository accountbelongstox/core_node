"""
Device State Coordinator - Unified Device State Management (Problem 3 Fix)

This service coordinates device state across multiple services:
- DeviceManager (pycore): ScrcpyDevice instances and connections
- VideoStreamService: Active streams and clients
- VideoStreamHealthService: Health monitoring

By centralizing state queries and cleanup operations, we eliminate
"zombie" devices and state inconsistencies.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from typing import Dict, Optional
from pycore import ColorPrint
from pycore.pyutils.device_manager import device_manager


class DeviceStateCoordinator:
    """
    Unified device state management across all services

    Fixes Problem 3: Device state is tracked in 3 independent places,
    leading to inconsistencies and zombie devices.
    """

    _instance: Optional['DeviceStateCoordinator'] = None

    def __init__(self):
        # Service references (lazy loaded to avoid circular imports)
        self._device_manager: Optional[DeviceManager] = None
        self._video_service = None
        self._health_service = None

    @classmethod
    def instance(cls) -> 'DeviceStateCoordinator':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self):
        """Initialize service references (call after all services are created)"""
        from pycore.pyutils.device_manager import device_manager
        from pyapps.matrix.services.video_stream_service import VideoStreamService
        from pyapps.matrix.services.video_stream_health_service import get_video_stream_health_service

        self._device_manager = device_manager
        self._video_service = VideoStreamService.instance()
        self._health_service = get_video_stream_health_service()

        ColorPrint.green("[DeviceStateCoordinator] ✓ Initialized with all service references")

    def get_device_state(self, serial: str) -> dict:
        """
        Get complete device state from all services

        Returns a unified view of device state across:
        - DeviceManager: Connection status
        - VideoStreamService: Active streams and clients
        - HealthService: Health monitoring status

        Returns:
            dict: Complete device state
        """
        if not self._device_manager or not self._video_service or not self._health_service:
            raise RuntimeError("DeviceStateCoordinator not initialized. Call initialize() first.")

        # Get device from DeviceManager
        device = self._device_manager.get_device(serial)

        # H.264 stream state
        has_h264_stream = serial in self._video_service.active_streams
        h264_client_count = len(self._video_service.stream_clients.get(serial, set()))

        # YUV stream state
        has_yuv_stream = serial in self._video_service.yuv_active_streams
        yuv_client_count = len(self._video_service.yuv_stream_clients.get(serial, set()))

        # Health monitoring state
        is_monitored = serial in self._health_service.active_stream_devices
        health_status = self._health_service.device_health.get(serial)

        state = {
            # DeviceManager state
            'device_exists': device is not None,
            'connected': device.is_connected() if device else False,

            # VideoStreamService state
            'has_h264_stream': has_h264_stream,
            'h264_client_count': h264_client_count,
            'has_yuv_stream': has_yuv_stream,
            'yuv_client_count': yuv_client_count,
            'total_client_count': h264_client_count + yuv_client_count,

            # HealthService state
            'is_monitored': is_monitored,
            'health_status': health_status.status if health_status else 'unknown',
            'reconnect_attempts': health_status.reconnect_attempts if health_status else 0,

            # Consistency checks
            'is_zombie': self._is_zombie_device(serial, device, has_h264_stream, has_yuv_stream, is_monitored),
            'needs_cleanup': self._needs_cleanup(serial, device, has_h264_stream, has_yuv_stream)
        }

        return state

    def _is_zombie_device(self, serial: str, device, has_h264_stream: bool, has_yuv_stream: bool, is_monitored: bool) -> bool:
        """
        Check if device is in a "zombie" state

        A zombie device is one where:
        - Device exists in DeviceManager but is not connected
        - No active streams but still monitored
        - Device disconnected but streams still active
        """
        if not device:
            return False

        # Zombie case 1: Device exists but not connected, yet has active streams
        if not device.is_connected() and (has_h264_stream or has_yuv_stream):
            return True

        # Zombie case 2: Device disconnected but still monitored
        if not device.is_connected() and is_monitored:
            return True

        # Zombie case 3: Has streams but not monitored
        if (has_h264_stream or has_yuv_stream) and not is_monitored:
            return True

        return False

    def _needs_cleanup(self, serial: str, device, has_h264_stream: bool, has_yuv_stream: bool) -> bool:
        """Check if device needs cleanup"""
        if not device:
            return has_h264_stream or has_yuv_stream

        # Device disconnected but has active streams
        if not device.is_connected() and (has_h264_stream or has_yuv_stream):
            return True

        return False

    async def cleanup_device(self, serial: str, reason: str = "Manual cleanup"):
        """
        Unified device cleanup across all services

        This method ensures consistent cleanup order:
        1. Stop H.264 streams
        2. Stop YUV streams
        3. Unregister from health monitoring
        4. Disconnect device in DeviceManager

        Args:
            serial: Device serial number
            reason: Reason for cleanup
        """
        if not self._device_manager or not self._video_service or not self._health_service:
            raise RuntimeError("DeviceStateCoordinator not initialized")

        ColorPrint.yellow(f"[DeviceStateCoordinator] Starting cleanup for {serial}: {reason}")

        # Get current state for logging
        state = self.get_device_state(serial)
        ColorPrint.blue(f"[DeviceStateCoordinator] Current state: {state}")

        # 1. Stop H.264 streams (if any)
        if state['has_h264_stream']:
            ColorPrint.blue(f"[DeviceStateCoordinator] Stopping H.264 stream for {serial}")
            try:
                await self._video_service.force_stop_stream(serial, reason=reason)
            except Exception as e:
                ColorPrint.red(f"[DeviceStateCoordinator] Failed to stop H.264 stream: {e}")

        # 2. Stop YUV streams (if any)
        if state['has_yuv_stream']:
            ColorPrint.blue(f"[DeviceStateCoordinator] Stopping YUV stream for {serial}")
            try:
                # Set stop event
                if serial in self._video_service.yuv_stop_events:
                    self._video_service.yuv_stop_events[serial].set()

                # Clean up YUV resources
                await self._video_service._cleanup_yuv_stream(serial)
            except Exception as e:
                ColorPrint.red(f"[DeviceStateCoordinator] Failed to stop YUV stream: {e}")

        # 3. Unregister from health monitoring
        if state['is_monitored']:
            ColorPrint.blue(f"[DeviceStateCoordinator] Unregistering {serial} from health monitoring")
            try:
                self._health_service.mark_device_inactive(serial)

                # Remove from active devices
                if serial in self._health_service.active_stream_devices:
                    self._health_service.active_stream_devices.discard(serial)

                # Remove health status
                if serial in self._health_service.device_health:
                    del self._health_service.device_health[serial]

            except Exception as e:
                ColorPrint.red(f"[DeviceStateCoordinator] Failed to unregister from health monitoring: {e}")

        # 4. Disconnect device in DeviceManager
        if state['device_exists'] and state['connected']:
            ColorPrint.blue(f"[DeviceStateCoordinator] Disconnecting device {serial} in DeviceManager")
            try:
                device = self._device_manager.get_device(serial)
                if device:
                    device.stop_server()
            except Exception as e:
                ColorPrint.red(f"[DeviceStateCoordinator] Failed to disconnect device: {e}")

        # Verify cleanup
        final_state = self.get_device_state(serial)
        ColorPrint.green(f"[DeviceStateCoordinator] ✓ Cleanup completed for {serial}")
        ColorPrint.blue(f"[DeviceStateCoordinator] Final state: {final_state}")

        if final_state['is_zombie']:
            ColorPrint.red(f"[DeviceStateCoordinator] ⚠ Device {serial} is still in zombie state!")

    def find_zombie_devices(self) -> list:
        """
        Find all zombie devices across all services

        Returns:
            list: List of serial numbers for zombie devices
        """
        if not self._device_manager or not self._video_service or not self._health_service:
            raise RuntimeError("DeviceStateCoordinator not initialized")

        zombie_devices = []

        # Check all devices in DeviceManager
        all_devices = set()
        for device in self._device_manager._devices.values():
            all_devices.add(device.serial)

        # Check all active streams
        for serial in self._video_service.active_streams.keys():
            all_devices.add(serial)
        for serial in self._video_service.yuv_active_streams.keys():
            all_devices.add(serial)

        # Check all monitored devices
        for serial in self._health_service.active_stream_devices:
            all_devices.add(serial)

        # Check each device
        for serial in all_devices:
            state = self.get_device_state(serial)
            if state['is_zombie']:
                zombie_devices.append(serial)
                ColorPrint.yellow(f"[DeviceStateCoordinator] Found zombie device: {serial}")
                ColorPrint.yellow(f"  State: {state}")

        return zombie_devices

    async def cleanup_all_zombie_devices(self):
        """Clean up all zombie devices"""
        zombie_devices = self.find_zombie_devices()

        if not zombie_devices:
            ColorPrint.green("[DeviceStateCoordinator] No zombie devices found")
            return

        ColorPrint.yellow(f"[DeviceStateCoordinator] Found {len(zombie_devices)} zombie devices, cleaning up...")

        for serial in zombie_devices:
            await self.cleanup_device(serial, reason="Zombie device cleanup")

        ColorPrint.green(f"[DeviceStateCoordinator] ✓ Cleaned up {len(zombie_devices)} zombie devices")


# Global instance getter
def get_device_state_coordinator() -> DeviceStateCoordinator:
    """Get global DeviceStateCoordinator instance"""
    return DeviceStateCoordinator.instance()
