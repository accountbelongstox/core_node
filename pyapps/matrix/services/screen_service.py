"""Screen control service using ADB shell commands"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import asyncio
from typing import Optional, Dict
from pycore.pyutils.device import ADBManager
<<<<<<< HEAD
from pycore.pyutils.device_manager import DeviceManager
=======
from pycore.pyutils.device_manager import device_manager
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
from pyapps.matrix.matrix_config import Config


class ScreenService:
    """
    Screen control service

    Responsibilities:
    - Control screen power (on/off/toggle)
    - Control screen brightness
    - Control screen rotation
    - Get screen properties

    Uses ADBManager shell commands for screen control operations.
    """

    _instance: Optional['ScreenService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = device_manager

    @classmethod
    def instance(cls) -> 'ScreenService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def control_screen_power(self, serial: str, action: str) -> Dict:
        """
        Control screen power

        Args:
            serial: Device serial
            action: "on" | "off" | "toggle"

        Returns:
            {
                "success": bool,
                "state": str ("on" or "off"),
                "error": str (if failed)
            }
        """
        try:
            # Check device connection
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return {
                    "success": False,
                    "error": f"Device {serial} not connected"
                }

            # Get current screen state
            current_state = await self._get_screen_state(serial)

            # Determine if we need to send POWER key
            should_toggle = False
            if action == "toggle":
                should_toggle = True
            elif action == "on" and current_state == "off":
                should_toggle = True
            elif action == "off" and current_state == "on":
                should_toggle = True

            if should_toggle:
                # Send POWER keyevent
                power_cmd = "input keyevent KEYCODE_POWER"
                await asyncio.to_thread(
                    ADBManager.execute_shell,
                    serial,
                    power_cmd,
                    self.adb_path,
                    timeout=5
                )

                # Wait a bit and get new state
                await asyncio.sleep(0.5)
                new_state = await self._get_screen_state(serial)
            else:
                new_state = current_state

            print(f"[ScreenService] Screen power {action} for {serial}: {new_state}")

            return {
                "success": True,
                "state": new_state
            }

        except Exception as e:
            print(f"[ScreenService] Failed to control screen power for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _get_screen_state(self, serial: str) -> str:
        """
        Get current screen state

        Returns:
            "on" or "off"
        """
        try:
            # Check if screen is on using dumpsys
            cmd = "dumpsys power | grep 'mScreenOn'"
            result = await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                cmd,
                self.adb_path,
                timeout=5
            )

            # Parse result: mScreenOn=true or mScreenOn=false
            if "mScreenOn=true" in result or "mWakefulness=Awake" in result:
                return "on"
            else:
                return "off"

        except Exception as e:
            print(f"[ScreenService] Failed to get screen state: {e}")
            return "unknown"

    async def control_screen_brightness(self, serial: str, level: int) -> Dict:
        """
        Control screen brightness

        Args:
            serial: Device serial
            level: Brightness level (0-255)

        Returns:
            {
                "success": bool,
                "level": int (current brightness level),
                "error": str (if failed)
            }
        """
        try:
            # Validate level
            level = max(0, min(255, level))

            # Check device connection
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return {
                    "success": False,
                    "error": f"Device {serial} not connected"
                }

            # Set brightness using settings command
            brightness_cmd = f"settings put system screen_brightness {level}"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                brightness_cmd,
                self.adb_path,
                timeout=5
            )

            print(f"[ScreenService] Screen brightness set to {level} for {serial}")

            return {
                "success": True,
                "level": level
            }

        except Exception as e:
            print(f"[ScreenService] Failed to control screen brightness for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_screen_brightness(self, serial: str) -> Dict:
        """
        Get current screen brightness

        Args:
            serial: Device serial

        Returns:
            {
                "success": bool,
                "level": int (0-255),
                "error": str (if failed)
            }
        """
        try:
            cmd = "settings get system screen_brightness"
            result = await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                cmd,
                self.adb_path,
                timeout=5
            )

            level = int(result.strip())

            return {
                "success": True,
                "level": level
            }

        except Exception as e:
            print(f"[ScreenService] Failed to get screen brightness for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def control_screen_rotation(self, serial: str, rotation: int) -> Dict:
        """
        Control screen rotation

        Args:
            serial: Device serial
            rotation: Rotation value (0, 90, 180, 270 degrees)
                     Maps to: 0=portrait, 1=landscape-left, 2=portrait-inverted, 3=landscape-right

        Returns:
            {
                "success": bool,
                "rotation": int (current rotation value),
                "error": str (if failed)
            }
        """
        try:
            # Map degrees to rotation value
            rotation_map = {
                0: 0,      # Portrait
                90: 1,     # Landscape (left)
                180: 2,    # Portrait (inverted)
                270: 3     # Landscape (right)
            }

            rotation_value = rotation_map.get(rotation)
            if rotation_value is None:
                return {
                    "success": False,
                    "error": f"Invalid rotation: {rotation}. Must be 0, 90, 180, or 270"
                }

            # Check device connection
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return {
                    "success": False,
                    "error": f"Device {serial} not connected"
                }

            # Disable auto-rotation first
            auto_rotate_cmd = "settings put system accelerometer_rotation 0"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                auto_rotate_cmd,
                self.adb_path,
                timeout=5
            )

            # Set user rotation
            rotation_cmd = f"settings put system user_rotation {rotation_value}"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                rotation_cmd,
                self.adb_path,
                timeout=5
            )

            print(f"[ScreenService] Screen rotation set to {rotation}° ({rotation_value}) for {serial}")

            return {
                "success": True,
                "rotation": rotation
            }

        except Exception as e:
            print(f"[ScreenService] Failed to control screen rotation for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_screen_rotation(self, serial: str) -> Dict:
        """
        Get current screen rotation

        Args:
            serial: Device serial

        Returns:
            {
                "success": bool,
                "rotation": int (degrees: 0, 90, 180, 270),
                "error": str (if failed)
            }
        """
        try:
            cmd = "settings get system user_rotation"
            result = await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                cmd,
                self.adb_path,
                timeout=5
            )

            rotation_value = int(result.strip())

            # Map rotation value back to degrees
            degrees_map = {
                0: 0,      # Portrait
                1: 90,     # Landscape (left)
                2: 180,    # Portrait (inverted)
                3: 270     # Landscape (right)
            }

            rotation = degrees_map.get(rotation_value, 0)

            return {
                "success": True,
                "rotation": rotation
            }

        except Exception as e:
            print(f"[ScreenService] Failed to get screen rotation for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def enable_auto_rotation(self, serial: str) -> Dict:
        """
        Enable automatic screen rotation

        Args:
            serial: Device serial

        Returns:
            {
                "success": bool,
                "error": str (if failed)
            }
        """
        try:
            cmd = "settings put system accelerometer_rotation 1"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                cmd,
                self.adb_path,
                timeout=5
            )

            print(f"[ScreenService] Auto-rotation enabled for {serial}")

            return {
                "success": True
            }

        except Exception as e:
            print(f"[ScreenService] Failed to enable auto-rotation for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def disable_auto_rotation(self, serial: str) -> Dict:
        """
        Disable automatic screen rotation

        Args:
            serial: Device serial

        Returns:
            {
                "success": bool,
                "error": str (if failed)
            }
        """
        try:
            cmd = "settings put system accelerometer_rotation 0"
            await asyncio.to_thread(
                ADBManager.execute_shell,
                serial,
                cmd,
                self.adb_path,
                timeout=5
            )

            print(f"[ScreenService] Auto-rotation disabled for {serial}")

            return {
                "success": True
            }

        except Exception as e:
            print(f"[ScreenService] Failed to disable auto-rotation for {serial}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
