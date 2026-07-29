"""
Device ID Manager

Assigns simple numeric IDs to each device to avoid passing complex serials
(IP:port format) in URLs and API calls.
"""

from typing import Dict, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class DeviceIDManager:
    """Device ID Manager - Singleton pattern"""

    _instance: Optional['DeviceIDManager'] = None

    def __init__(self):
        # serial -> device_id mapping
        self._serial_to_id: Dict[str, str] = {}

        # device_id -> serial mapping
        self._id_to_serial: Dict[str, str] = {}

        # Next available device number
        self._next_id = 1

        ColorPrint.blue("[DeviceIDManager] Initialized")

    @classmethod
    def instance(cls) -> 'DeviceIDManager':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_device(self, serial: str) -> str:
        """
        Register device and assign ID

        Args:
            serial: Device serial number (may be IP:port format)

        Returns:
            Device ID (e.g. "device_1")
        """
        # If already registered, return existing ID
        if serial in self._serial_to_id:
            return self._serial_to_id[serial]

        # Assign new ID
        device_id = f"device_{self._next_id}"
        self._next_id += 1

        # Establish bidirectional mapping
        self._serial_to_id[serial] = device_id
        self._id_to_serial[device_id] = serial

        ColorPrint.green(f"[DeviceIDManager] Registered: {device_id} -> {serial}")

        return device_id

    def get_device_id(self, serial: str) -> Optional[str]:
        """
        Get device_id from serial

        Args:
            serial: Device serial number

        Returns:
            Device ID, or None if not registered
        """
        return self._serial_to_id.get(serial)

    def get_serial(self, device_id: str) -> Optional[str]:
        """
        Get serial from device_id

        Args:
            device_id: Device ID

        Returns:
            Device serial number, or None if not found
        """
        return self._id_to_serial.get(device_id)

    def unregister_device(self, serial: str) -> bool:
        """
        Unregister device

        Args:
            serial: Device serial number

        Returns:
            True if successfully unregistered, False otherwise
        """
        if serial not in self._serial_to_id:
            return False

        device_id = self._serial_to_id[serial]

        # Remove bidirectional mapping
        del self._serial_to_id[serial]
        del self._id_to_serial[device_id]

        ColorPrint.yellow(f"[DeviceIDManager] Unregistered: {device_id} (was {serial})")

        return True

    def get_all_mappings(self) -> Dict[str, str]:
        """
        Get all device mappings

        Returns:
            Dictionary of device_id -> serial mappings
        """
        return self._id_to_serial.copy()

    def clear(self):
        """Clear all mappings"""
        self._serial_to_id.clear()
        self._id_to_serial.clear()
        self._next_id = 1
        ColorPrint.yellow("[DeviceIDManager] All mappings cleared")
