"""
Device Management Service

This service is a thin wrapper around pycore's centralized DeviceManager.
It provides app-specific customization while using core functionality.
"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from typing import List, Dict, Optional
from pathlib import Path
import asyncio

# Use pycore centralized services
from pycore.pyutils.device_manager import DeviceManager, DeviceState
from pycore.pyutils.adb import ADBManager, ADBDevice
from pycore.pyfoundations.device import AndroidDevice, DeviceInfo, ServerParams, VideoCodec
from pycore.pyfoundations.event_bus import EventBus, EventTypes

from poly_apps.pyMatrix.config import Config


class DeviceService:
    """
    pyMatrix Device Service

    Responsibilities:
    - Provide pyMatrix-specific device interface
    - Use centralized DeviceManager from pycore
    - Subscribe to device events
    - Add app-specific customization

    Note: Actual device management is centralized in pycore.DeviceManager
    """

    _instance: Optional['DeviceService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.scrcpy_server_jar = Config.SCRCPY_SERVER_JAR

        # Use centralized device manager from pycore
        self.device_manager = DeviceManager.instance()

        # Use event bus for cross-app communication
        self.event_bus = EventBus.instance()

        # Subscribe to device events
        self._setup_event_listeners()

    def _setup_event_listeners(self):
        """Setup event listeners"""
        # Subscribe to device events
        self.event_bus.subscribe(EventTypes.DEVICE_CONNECTED, self._on_device_connected)
        self.event_bus.subscribe(EventTypes.DEVICE_DISCONNECTED, self._on_device_disconnected)
        self.event_bus.subscribe(EventTypes.DEVICE_ERROR, self._on_device_error)

    async def _on_device_connected(self, event):
        """Handle device connected event"""
        print(f"[pyMatrix] Device connected: {event.data}")

    async def _on_device_disconnected(self, event):
        """Handle device disconnected event"""
        print(f"[pyMatrix] Device disconnected: {event.data}")

    async def _on_device_error(self, event):
        """Handle device error event"""
        print(f"[pyMatrix] Device error: {event.data}")

    @classmethod
    def instance(cls) -> 'DeviceService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def list_devices(self) -> List[ADBDevice]:
        """
        List all ADB devices

        Returns:
            Device list
        """
        # Use centralized device manager
        return await self.device_manager.list_devices(self.adb_path)

    async def get_device_info(self, serial: str) -> Optional[DeviceInfo]:
        """
        Get device detailed information

        Args:
            serial: Device serial number

        Returns:
            Device info or None
        """
        # Use centralized device manager
        return await self.device_manager.get_device_info(serial, self.adb_path)

    async def connect_device(self, serial: str, params: Optional[Dict] = None) -> bool:
        """
        Connect device and start scrcpy-server

        Args:
            serial: Device serial number
            params: Server parameters (optional)

        Returns:
            Success status
        """
        try:
            # Push scrcpy-server.jar if needed
            if self.scrcpy_server_jar.exists():
                success = ADBManager.push_file(
                    serial,
                    self.scrcpy_server_jar,
                    "/data/local/tmp/scrcpy-server.jar",
                    self.adb_path
                )
                if not success:
                    print(f"Failed to push scrcpy-server.jar")
                    return False

            # Create server parameters
            server_params = ServerParams(
                max_size=params.get('max_size', Config.DEFAULT_MAX_SIZE) if params else Config.DEFAULT_MAX_SIZE,
                bit_rate=params.get('bit_rate', Config.DEFAULT_BIT_RATE) if params else Config.DEFAULT_BIT_RATE,
                max_fps=params.get('max_fps', Config.DEFAULT_MAX_FPS) if params else Config.DEFAULT_MAX_FPS,
                codec=VideoCodec.H264,
                control=True
            )

            # Use centralized device manager to connect
            device = await self.device_manager.connect_device(serial, server_params, self.adb_path)

            if device is None:
                # Even if device instance is not ready, connection is tracked
                # Check if device state shows connected
                state = self.device_manager.get_device_state(serial)
                return state is not None and state.connected

            # Emit app-specific event
            await self.event_bus.emit(
                EventTypes.DEVICE_CONNECTED,
                source="pyMatrix",
                data={"serial": serial, "params": params}
            )

            return True

        except Exception as e:
            print(f"Failed to connect device [{serial}]: {e}")
            return False

    async def disconnect_device(self, serial: str) -> bool:
        """
        Disconnect device

        Args:
            serial: Device serial number

        Returns:
            Success status
        """
        try:
            # Use centralized device manager to disconnect
            success = await self.device_manager.disconnect_device(serial)

            if success:
                # Emit app-specific event
                await self.event_bus.emit(
                    EventTypes.DEVICE_DISCONNECTED,
                    source="pyMatrix",
                    data={"serial": serial}
                )

            return success

        except Exception as e:
            print(f"Failed to disconnect device [{serial}]: {e}")
            return False

    def get_device(self, serial: str) -> Optional[AndroidDevice]:
        """
        Get device instance

        Args:
            serial: Device serial number

        Returns:
            Device instance or None
        """
        # Use centralized device manager
        return self.device_manager.get_device(serial)

    def is_connected(self, serial: str) -> bool:
        """Check if device is connected"""
        # Use centralized device manager
        return self.device_manager.is_connected(serial)


# Resolution is now defined in pycore.pyfoundations.device.DeviceInfo
