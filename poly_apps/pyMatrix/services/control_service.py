"""Device control service using centralized DeviceManager"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from typing import Optional, Dict
from pycore.pyutils.control import TouchEvent, KeyEvent, MessageBuilder
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.adb import ADBManager
from poly_apps.pyMatrix.config import Config


class ControlService:
    """
    Device control service

    Responsibilities:
    - Send touch events to device
    - Send key events to device
    - Send text input to device
    - Handle coordinate mapping

    Uses centralized DeviceManager to access devices.
    """

    _instance: Optional['ControlService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = DeviceManager.instance()
        self.message_builder = MessageBuilder()

    @classmethod
    def instance(cls) -> 'ControlService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def send_touch_event(self, serial: str, event_data: dict) -> bool:
        """
        Send touch event to device via scrcpy control socket

        Args:
            serial: Device serial
            event_data: Touch event data from frontend
                {
                    "action": "down" | "up" | "move",
                    "pointerId": 0,
                    "x": 100,
                    "y": 200,
                    "pressure": 1.0,
                    "screenWidth": 1080,
                    "screenHeight": 2340
                }

        Returns:
            Success status
        """
        try:
            # Get device from centralized DeviceManager
            device = self.device_manager.get_device(serial)
            if not device:
                print(f"Device {serial} not connected")
                return False

            # Create touch event
            touch_event = TouchEvent(
                action=event_data["action"],
                pointer_id=event_data.get("pointerId", 0),
                x=event_data["x"],
                y=event_data["y"],
                pressure=event_data.get("pressure", 1.0),
                screen_width=event_data["screenWidth"],
                screen_height=event_data["screenHeight"]
            )

            # Build control message
            message = self.message_builder.build_touch_message(touch_event)

            # Send to scrcpy-server via control socket
            if device.is_connected():
                device.send_control_message(message)
                print(f"[ControlService] Touch {event_data['action']} sent to {serial} at ({event_data['x']}, {event_data['y']})")
                return True
            else:
                print(f"[ControlService] Device {serial} not ready for control")
                return False

        except Exception as e:
            print(f"[ControlService] Failed to send touch event to {serial}: {e}")
            return False

    async def send_key_event(self, serial: str, event_data: dict) -> bool:
        """
        Send key event to device via scrcpy control socket

        Args:
            serial: Device serial
            event_data: Key event data from frontend
                {
                    "action": "down" | "up",
                    "keyCode": 26,
                    "metaState": 0
                }

        Returns:
            Success status
        """
        try:
            # Get device from centralized DeviceManager
            device = self.device_manager.get_device(serial)
            if not device:
                print(f"Device {serial} not connected")
                return False

            # Create key event
            key_event = KeyEvent(
                action=event_data["action"],
                key_code=event_data["keyCode"],
                meta_state=event_data.get("metaState", 0)
            )

            # Build control message
            message = self.message_builder.build_key_message(key_event)

            # Send to scrcpy-server via control socket
            if device.is_connected():
                device.send_control_message(message)
                print(f"[ControlService] Key {event_data['action']} sent to {serial}, keyCode={event_data['keyCode']}")
                return True
            else:
                print(f"[ControlService] Device {serial} not ready for control")
                return False

        except Exception as e:
            print(f"[ControlService] Failed to send key event to {serial}: {e}")
            return False

    async def send_text(self, serial: str, text: str) -> bool:
        """
        Send text input to device

        Args:
            serial: Device serial
            text: Text to input

        Returns:
            Success status
        """
        try:
            # Use ADB to input text
            command = f'input text "{text}"'
            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"Text input for {serial}: {text}")
            return True

        except Exception as e:
            print(f"Failed to send text to {serial}: {e}")
            return False

    async def send_swipe(self, serial: str, swipe_data: dict) -> bool:
        """
        Send swipe gesture to device

        Args:
            serial: Device serial
            swipe_data: Swipe data
                {
                    "x1": 100, "y1": 100,
                    "x2": 500, "y2": 500,
                    "duration": 300
                }

        Returns:
            Success status
        """
        try:
            x1 = swipe_data["x1"]
            y1 = swipe_data["y1"]
            x2 = swipe_data["x2"]
            y2 = swipe_data["y2"]
            duration = swipe_data.get("duration", 300)

            # Use ADB to perform swipe
            command = f'input swipe {x1} {y1} {x2} {y2} {duration}'
            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"Swipe for {serial}: ({x1},{y1}) -> ({x2},{y2})")
            return True

        except Exception as e:
            print(f"Failed to send swipe to {serial}: {e}")
            return False

    async def send_system_key(self, serial: str, action: str) -> bool:
        """
        Send system key event to device

        Args:
            serial: Device serial
            action: System key action
                - 'home': Home button (KEYCODE_HOME = 3)
                - 'back': Back button (KEYCODE_BACK = 4)
                - 'recent': Recent apps (KEYCODE_APP_SWITCH = 187)
                - 'power': Power button (KEYCODE_POWER = 26)
                - 'volume_up': Volume up (KEYCODE_VOLUME_UP = 24)
                - 'volume_down': Volume down (KEYCODE_VOLUME_DOWN = 25)

        Returns:
            Success status
        """
        try:
            # Map action to Android keycode
            keycode_map = {
                'home': 3,
                'back': 4,
                'recent': 187,
                'power': 26,
                'volume_up': 24,
                'volume_down': 25
            }

            if action not in keycode_map:
                print(f"Unknown system key action: {action}")
                return False

            keycode = keycode_map[action]

            # Use ADB to send keyevent
            command = f'input keyevent {keycode}'
            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"System key '{action}' (keycode {keycode}) sent to {serial}")
            return True

        except Exception as e:
            print(f"Failed to send system key to {serial}: {e}")
            return False

    async def set_clipboard(self, serial: str, text: str) -> bool:
        """
        Set clipboard content on device

        Args:
            serial: Device serial
            text: Text to set in clipboard

        Returns:
            Success status
        """
        try:
            # Escape special characters for shell
            escaped_text = text.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')

            # Use ADB to set clipboard via am broadcast
            # Alternative method using service call:
            # command = f'service call clipboard 1 i32 0 s16 "com.android.shell" s16 "{escaped_text}"'

            # Simpler method: use input text which also sets clipboard
            # Or use am to trigger clipboard service
            command = f'am broadcast -a clipper.set -e text "{escaped_text}"'

            # Fallback: use service call (more reliable)
            # command = f'cmd clipboard set-text "{escaped_text}"'  # Requires Android 10+

            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"[ControlService] Clipboard set for {serial}: {text[:50]}...")
            return True

        except Exception as e:
            print(f"[ControlService] Failed to set clipboard for {serial}: {e}")
            return False

    async def get_clipboard(self, serial: str) -> str:
        """
        Get clipboard content from device

        Args:
            serial: Device serial

        Returns:
            Clipboard text content
        """
        try:
            # Use ADB to get clipboard content
            # Method 1: service call (most reliable)
            # command = 'cmd clipboard get-text'  # Android 10+

            # Method 2: using service call (works on older Android)
            command = 'service call clipboard 1'

            result = ADBManager.execute_shell(serial, command, self.adb_path)

            # Parse the result - service call returns hex encoded string
            # For simplicity, we'll use a different approach

            # Alternative: Try cmd clipboard (Android 10+)
            try:
                command = 'cmd clipboard get-text'
                result = ADBManager.execute_shell(serial, command, self.adb_path, timeout=5)
                clipboard_text = result.strip()

                print(f"[ControlService] Clipboard get for {serial}: {clipboard_text[:50]}...")
                return clipboard_text

            except Exception:
                # Fallback: return empty if not supported
                print(f"[ControlService] Get clipboard not supported on {serial}, returning empty")
                return ""

        except Exception as e:
            print(f"[ControlService] Failed to get clipboard from {serial}: {e}")
            return ""
