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

# Use pycore centralized services
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.adb import ADBManager, ADBDevice
from pycore.pyfoundations.device import AndroidDevice, DeviceInfo, ServerParams, VideoCodec
from pycore.pyfoundations.event_bus import EventBus, EventTypes

from pyapps.matrix.config import Config
from .config_service import ConfigService


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

        # Centralized configuration service
        self.config_service = ConfigService.instance()

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
            overrides: Dict = dict(params) if params else {}
            device_name_override = overrides.pop("device_name", None)

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

            # Resolve device name for per-device configuration
            device_name: Optional[str] = device_name_override
            try:
                if not device_name_override:
                    info = await self.device_manager.get_device_info(serial, self.adb_path)
                    if info:
                        device_name = info.model or info.serial
            except Exception:
                device_name = None

            # Merge configuration layers: global -> device -> request overrides
            effective_params = await self.config_service.get_effective_server_params(device_name, overrides)

            codec_value = effective_params.get("codec", Config.DEFAULT_CODEC)
            try:
                codec_enum = VideoCodec(codec_value)
            except ValueError:
                codec_enum = VideoCodec(Config.DEFAULT_CODEC)

            server_params = ServerParams(
                max_size=effective_params.get("max_size", Config.DEFAULT_MAX_SIZE),
                bit_rate=effective_params.get("bit_rate", Config.DEFAULT_BIT_RATE),
                max_fps=effective_params.get("max_fps", Config.DEFAULT_MAX_FPS),
                codec=codec_enum,
                control=effective_params.get("control", True),
                locked_video_orientation=effective_params.get("locked_video_orientation", -1),
            )

            # Use centralized device manager to connect
            device = await self.device_manager.connect_device(serial, server_params, self.adb_path)

            # ✅ CRITICAL FIX: Strictly validate device connection
            if device is None:
                print(f"[DeviceService] ✗ Failed to create device instance for {serial}")
                return False

            # ✅ CRITICAL FIX: Verify device sockets are connected (not just device object exists)
            if not device.is_connected():
                print(f"[DeviceService] ✗ Device {serial} created but sockets not connected")
                print(f"[DeviceService]   Video socket: {device._video_socket}")
                print(f"[DeviceService]   Control socket: {device._control_socket}")
                print(f"[DeviceService]   This usually means scrcpy-server failed to start properly")

                # Cleanup incomplete device connection
                try:
                    await self.device_manager.disconnect_device(serial)
                except Exception as cleanup_error:
                    print(f"[DeviceService] Error during cleanup: {cleanup_error}")

                return False

            print(f"[DeviceService] ✓ Device {serial} fully connected and verified")

            # Emit app-specific event
            await self.event_bus.emit(
                EventTypes.DEVICE_CONNECTED,
                source="pyMatrix",
                data={"serial": serial, "params": effective_params, "deviceName": device_name}
            )

            return True

        except Exception as e:
            print(f"[DeviceService] ✗ Failed to connect device [{serial}]: {e}")
            import traceback
            traceback.print_exc()

            # ✅ CRITICAL FIX: Ensure cleanup on failure
            try:
                await self.device_manager.disconnect_device(serial)
            except Exception as cleanup_error:
                print(f"[DeviceService] Error during cleanup: {cleanup_error}")

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
