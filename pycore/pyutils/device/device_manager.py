"""
Centralized Device Manager

This is a core pycore component that manages all Android device connections.
Any app (pyMatrix, screencast, etc.) can use this to access devices.
"""

from typing import Dict, Optional, Set, Callable
from dataclasses import dataclass
import asyncio
import threading

from pycore.pyutils.device.android_device import AndroidDevice
from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.device_info import DeviceInfo
from pycore.pyutils.device.server_params import ServerParams, VideoCodec
from pycore.pyutils.device.adb_manager import ADBManager
from pycore.pyutils.device.adb_device import ADBDevice
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.pygvar.global_var_manager import GlobalVarManager


@dataclass
class DeviceState:
    """Device connection state"""
    serial: str
    info: Optional[DeviceInfo]
    connected: bool
    streaming: bool
    controllable: bool
    error: Optional[str] = None


class DeviceManager:
    """
    Centralized Device Manager

    Responsibilities:
    - Manage all Android device connections
    - Maintain device connection pool
    - Provide device access to all apps
    - Handle device state changes
    - Emit device events

    Usage:
        # Get global instance
        from pycore.pyutils.device.device_manager import device_manager

        # List devices
        devices = await device_manager.list_devices()

        # Connect device
        device = await device_manager.connect_device(serial, params)

        # Get connected device
        device = device_manager.get_device(serial)

        # Subscribe to events
        device_manager.on_device_connected(callback)
    """

    def __init__(self):
        # Device pool
        self.devices: Dict[str, AndroidDevice] = {}  # serial -> device instance
        self.device_states: Dict[str, DeviceState] = {}  # serial -> state

        # Event callbacks
        self._on_connected_callbacks: Set[Callable] = set()
        self._on_disconnected_callbacks: Set[Callable] = set()
        self._on_error_callbacks: Set[Callable] = set()

        # Global var manager for cross-app communication
        self.gvar = GlobalVarManager()

        # Lock for thread safety
        self._lock = asyncio.Lock()

    async def list_devices(self, adb_path: str = "adb") -> list[ADBDevice]:
        """
        List all ADB devices

        Args:
            adb_path: Path to ADB executable

        Returns:
            List of ADB devices
        """
        # Let ADBManager handle device listing - errors will propagate
        devices = ADBManager.list_devices(adb_path)
        return devices

    async def get_device_info(self, serial: str, adb_path: str = "adb") -> Optional[DeviceInfo]:
        """
        Get device information

        Args:
            serial: Device serial number
            adb_path: Path to ADB executable

        Returns:
            Device info or None
        """
        # Get basic device info from ADB
        device = ADBManager.get_device_info(serial, adb_path)
        if not device.is_online:
            print(f"Device {serial} is not online (state: {device.state.value})")
            return None

        # Get resolution
        size_output = ADBManager.execute_shell(serial, "wm size", adb_path)
        if "Physical size:" in size_output:
            size_str = size_output.split("Physical size:")[-1].strip()
            width, height = map(int, size_str.split('x'))
        else:
            width, height = 1080, 2340

        # Get DPI
        density_output = ADBManager.execute_shell(serial, "wm density", adb_path)
        if "Physical density:" in density_output:
            dpi_str = density_output.split("Physical density:")[-1].strip()
            dpi = int(dpi_str)
        else:
            dpi = 420

        # Get Android version
        android_version = ADBManager.get_prop(serial, "ro.build.version.release", adb_path)
        sdk_version_str = ADBManager.get_prop(serial, "ro.build.version.sdk", adb_path)

        # Validate SDK version is numeric
        if not sdk_version_str or not sdk_version_str.isdigit():
            print(f"Warning: Invalid SDK version for {serial}, using default")
            sdk_version = 0
        else:
            sdk_version = int(sdk_version_str)

        @dataclass
        class Resolution:
            width: int
            height: int

        return DeviceInfo(
            serial=serial,
            model=device.properties.model if device.properties else "Unknown",
            resolution=Resolution(width=width, height=height),
            dpi=dpi,
            android_version=android_version,
            sdk_version=sdk_version
        )

    async def connect_device(
        self,
        serial: str,
        params: Optional[ServerParams] = None,
        adb_path: str = "adb"
    ) -> Optional[AndroidDevice]:
        """
        Connect to device

        Args:
            serial: Device serial number
            params: Server parameters (optional)
            adb_path: Path to ADB executable

        Returns:
            Connected device instance or None
        """
        async with self._lock:
            # Check if already connected
            if serial in self.devices:
                print(f"Device {serial} already connected")
                return self.devices[serial]

            # Get device info
            info = await self.get_device_info(serial, adb_path)
            if not info:
                print(f"Failed to get info for device {serial}")
                return None

            # Use default params if not provided
            if params is None:
                params = ServerParams(
                    max_size=720,
                    bit_rate=8000000,
                    max_fps=60,
                    codec=VideoCodec.H264,
                    control=True
                )

            # Create and start scrcpy device
            device = ScrcpyDevice(serial, params, adb_path)

            # Start scrcpy-server (CRITICAL: must succeed for video streaming)
            print(f"[DeviceManager] Starting scrcpy-server for {serial}...")
            await asyncio.wait_for(
                await_bus_task(device.start_server),
                timeout=60.0  # 60 seconds timeout (socket accept is 30s)
            )
            print(f"[DeviceManager] ✓ scrcpy-server started successfully for {serial}")

            # Verify device is truly connected (has active sockets)
            if not device.is_connected():
                error_msg = f"Device {serial} scrcpy-server started but sockets not connected"
                print(f"[DeviceManager] ✗ {error_msg}")
                print(f"[DeviceManager] Possible causes:")
                print(f"  1. scrcpy-server.jar not pushed to /data/local/tmp/")
                print(f"  2. ADB connection unstable")
                print(f"  3. Device permissions issue")
                # Update state with error
                state = DeviceState(
                    serial=serial,
                    info=info,
                    connected=False,
                    streaming=False,
                    controllable=False,
                    error=error_msg
                )
                self.device_states[serial] = state
                await self._emit_error(serial, error_msg)
                return None

            # Create device state
            state = DeviceState(
                serial=serial,
                info=info,
                connected=True,
                streaming=True,  # scrcpy-server is running
                controllable=True
            )

            self.device_states[serial] = state
            self.devices[serial] = device

            # Store in global vars for cross-app access
            self.gvar.set(f"device.{serial}.connected", True)
            self.gvar.set(f"device.{serial}.info", info)

            # Emit connected event
            await self._emit_connected(serial, info)

            print(f"[DeviceManager] ✓ Device {serial} fully connected and ready for streaming")
            return device

    async def disconnect_device(self, serial: str) -> bool:
        """
        Disconnect device

        Args:
            serial: Device serial number

        Returns:
            Success status
        """
        async with self._lock:
            if serial not in self.devices:
                return True

            device = self.devices[serial]

            # Stop scrcpy-server
            if device:
                await await_bus_task(device.stop_server)

            # Remove from pool
            del self.devices[serial]

            # Update state
            if serial in self.device_states:
                self.device_states[serial].connected = False
                self.device_states[serial].streaming = False

            # Remove from global vars
            self.gvar.remove(f"device.{serial}.connected")
            self.gvar.remove(f"device.{serial}.info")

            # Emit disconnected event
            await self._emit_disconnected(serial)

            print(f"Device {serial} disconnected")
            return True

    def get_device(self, serial: str) -> Optional[AndroidDevice]:
        """Get connected device instance"""
        return self.devices.get(serial)

    def get_device_state(self, serial: str) -> Optional[DeviceState]:
        """Get device state"""
        return self.device_states.get(serial)

    def is_connected(self, serial: str) -> bool:
        """Check if device is connected"""
        return serial in self.devices

    def get_all_connected(self) -> Dict[str, AndroidDevice]:
        """Get all connected devices"""
        return self.devices.copy()

    # Event subscription methods
    def on_device_connected(self, callback: Callable[[str, DeviceInfo], None]):
        """Subscribe to device connected event"""
        self._on_connected_callbacks.add(callback)

    def on_device_disconnected(self, callback: Callable[[str], None]):
        """Subscribe to device disconnected event"""
        self._on_disconnected_callbacks.add(callback)

    def on_device_error(self, callback: Callable[[str, str], None]):
        """Subscribe to device error event"""
        self._on_error_callbacks.add(callback)

    # Event emission methods
    async def _emit_connected(self, serial: str, info: DeviceInfo):
        """Emit device connected event"""
        for callback in self._on_connected_callbacks:
            # Verify callback is callable
            if not callable(callback):
                continue
            # Call callback - let errors expose naturally
            if asyncio.iscoroutinefunction(callback):
                await callback(serial, info)
            else:
                callback(serial, info)

    async def _emit_disconnected(self, serial: str):
        """Emit device disconnected event"""
        for callback in self._on_disconnected_callbacks:
            # Verify callback is callable
            if not callable(callback):
                continue
            # Call callback - let errors expose naturally
            if asyncio.iscoroutinefunction(callback):
                await callback(serial)
            else:
                callback(serial)

    async def _emit_error(self, serial: str, error: str):
        """Emit device error event"""
        for callback in self._on_error_callbacks:
            # Verify callback is callable
            if not callable(callback):
                continue
            # Call callback - let errors expose naturally
            if asyncio.iscoroutinefunction(callback):
                await callback(serial, error)
            else:
                callback(serial, error)


# ✅ 创建全局唯一实例（模块级别单例）
device_manager = DeviceManager()

__all__ = ['DeviceManager', 'DeviceState', 'device_manager']
