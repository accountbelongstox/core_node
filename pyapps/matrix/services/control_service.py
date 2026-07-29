"""Device control service using centralized DeviceManager"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from typing import Optional, Dict, Set, TYPE_CHECKING
import asyncio
from pycore.pyutils.control.touch_event import TouchEvent
from pycore.pyutils.control.key_event import KeyEvent
from pycore.pyutils.control.message_builder import MessageBuilder
from pycore.pyutils.device.device_manager import device_manager
from pycore.pyutils.device.adb_manager import ADBManager
from pycore.pyutils.group.sync_event import SyncEvent
from pyapps.matrix.matrix_config import Config

if TYPE_CHECKING:
    from .group_service import GroupService


class ControlService:
    """
    Device control service

    Responsibilities:
    - Send touch events to device
    - Send key events to device
    - Send text input to device
    - Handle coordinate mapping
    - Broadcast events to slave devices (Host/Slave sync)

    Uses centralized DeviceManager to access devices.
    Integrates with GroupService for real-time input synchronization.
    """

    _instance: Optional['ControlService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = device_manager
        self.message_builder = MessageBuilder()

    @classmethod
    def instance(cls) -> 'ControlService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _broadcast_if_master(
        self,
        serial: str,
        event_type: str,
        event_data: Dict,
        handler_func,
        exclude_master: bool = True
    ) -> Set[str]:
        """
        Broadcast event to slave devices if serial is a master in any enabled group

        Args:
            serial: Source device serial
            event_type: Event type (touch/key/text/swipe)
            event_data: Event data dictionary
            handler_func: Async handler function to call for each slave
            exclude_master: Whether to exclude master from broadcast (default: True)

        Returns:
            Set of slave serials that received the broadcast
        """
        from .group_service import GroupService

        group_service = GroupService.instance()
        broadcasted_slaves = set()

        # Check all groups
        for group_id, controller in group_service.groups.items():
            # Only broadcast if:
            # 1. This serial is the master of this group
            # 2. The group is enabled
            if controller.is_master(serial) and group_service.is_enabled(group_id):
                # Create sync event
                sync_event = SyncEvent(
                    from_device=serial,
                    event_type=event_type,
                    event_data=event_data
                )

                # Get target slaves based on sync strategy
                targets = controller.get_sync_targets(sync_event)

                if targets:
                    print(f"[ControlService] Broadcasting {event_type} from master {serial} to {len(targets)} slaves in group {group_id}")

                    # Broadcast concurrently to all slaves
                    tasks = [handler_func(slave, event_data) for slave in targets]
                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    # Count successful broadcasts
                    for slave, result in zip(targets, results):
                        if isinstance(result, bool) and result:
                            broadcasted_slaves.add(slave)
                        elif isinstance(result, Exception):
                            print(f"[ControlService] Broadcast to {slave} failed: {result}")

                    print(f"[ControlService] Successfully broadcasted to {len(broadcasted_slaves)}/{len(targets)} slaves")

        return broadcasted_slaves

    async def send_touch_event(self, serial: str, event_data: dict) -> bool:
        """
        Send touch event to device via scrcpy control socket
        Automatically broadcasts to slave devices if this device is a master in an enabled group

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
            # Step 5: Get device from centralized DeviceManager
            print(f"[ControlService] >>> STEP 5: Looking up device by serial: {serial}")
            device = self.device_manager.get_device(serial)
            if not device:
                print(f"[ControlService] [X] FAILED: Device {serial} not connected")
                return False
            print(f"[ControlService]     Device found: {serial}")
            print(f"[ControlService]     Device connected: {device.is_connected()}")

            # Step 6: Create touch event
            print(f"[ControlService] >>> STEP 6: Creating TouchEvent object")

            # Convert action string to TouchAction enum
            from pycore.pyutils.control.touch_event import TouchAction
            action_map = {'down': TouchAction.DOWN, 'up': TouchAction.UP, 'move': TouchAction.MOVE}
            action_enum = action_map.get(event_data["action"].lower(), TouchAction.DOWN)

            touch_event = TouchEvent(
                action=action_enum,
                x=event_data["x"],
                y=event_data["y"],
                pressure=event_data.get("pressure", 1.0),
                pointer_id=event_data.get("pointerId", 0)
            )
            print(f"[ControlService]     TouchEvent created: action={touch_event.action}, pos=({touch_event.x}, {touch_event.y})")

            # Get screen dimensions from frontend
            screen_width = event_data.get("screenWidth", 1080)
            screen_height = event_data.get("screenHeight", 2340)
            print(f"[ControlService]     Screen size: {screen_width}x{screen_height}")

            # Step 7: Build control message
            print(f"[ControlService] >>> STEP 7: Building scrcpy control message")
            message = self.message_builder.build_touch_event(
                touch_event,
                screen_width,
                screen_height
            )
            print(f"[ControlService]     Message built: {len(message)} bytes")

            # Step 8: Send to scrcpy-server via control socket
            print(f"[ControlService] >>> STEP 8: Sending message to device")
            if device.is_connected():
                device.send_control_message(message)
                print(f"[ControlService] [OK] Touch {event_data['action']} sent to {serial} at ({event_data['x']}, {event_data['y']})")

                # Broadcast to slave devices if this is a master
                async def _send_touch_to_slave(slave_serial: str, data: dict) -> bool:
                    return await self._send_touch_direct(slave_serial, data)

                broadcasted = await self._broadcast_if_master(
                    serial=serial,
                    event_type='touch',
                    event_data=event_data,
                    handler_func=_send_touch_to_slave
                )

                if broadcasted:
                    print(f"[ControlService] Touch event broadcasted to {len(broadcasted)} slaves")

                return True
            else:
                print(f"[ControlService] Device {serial} not ready for control")
                return False

        except Exception as e:
            print(f"[ControlService] Failed to send touch event to {serial}: {e}")
            return False

    async def _send_touch_direct(self, serial: str, event_data: dict) -> bool:
        """
        Internal method to send touch event directly without broadcasting
        Used by broadcast mechanism to avoid infinite recursion
        """
        try:
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return False

            touch_event = TouchEvent(
                action=event_data["action"],
                pointer_id=event_data.get("pointerId", 0),
                x=event_data["x"],
                y=event_data["y"],
                pressure=event_data.get("pressure", 1.0),
                screen_width=event_data["screenWidth"],
                screen_height=event_data["screenHeight"]
            )

            message = self.message_builder.build_touch_message(touch_event)
            device.send_control_message(message)
            return True

        except Exception as e:
            print(f"[ControlService] Direct touch send to {serial} failed: {e}")
            return False

    async def send_key_event(self, serial: str, event_data: dict) -> bool:
        """
        Send key event to device via scrcpy control socket
        Automatically broadcasts to slave devices if this device is a master in an enabled group

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

                # Broadcast to slave devices if this is a master
                async def _send_key_to_slave(slave_serial: str, data: dict) -> bool:
                    return await self._send_key_direct(slave_serial, data)

                broadcasted = await self._broadcast_if_master(
                    serial=serial,
                    event_type='key',
                    event_data=event_data,
                    handler_func=_send_key_to_slave
                )

                if broadcasted:
                    print(f"[ControlService] Key event broadcasted to {len(broadcasted)} slaves")

                return True
            else:
                print(f"[ControlService] Device {serial} not ready for control")
                return False

        except Exception as e:
            print(f"[ControlService] Failed to send key event to {serial}: {e}")
            return False

    async def _send_key_direct(self, serial: str, event_data: dict) -> bool:
        """
        Internal method to send key event directly without broadcasting
        """
        try:
            device = self.device_manager.get_device(serial)
            if not device or not device.is_connected():
                return False

            key_event = KeyEvent(
                action=event_data["action"],
                key_code=event_data["keyCode"],
                meta_state=event_data.get("metaState", 0)
            )

            message = self.message_builder.build_key_message(key_event)
            device.send_control_message(message)
            return True

        except Exception as e:
            print(f"[ControlService] Direct key send to {serial} failed: {e}")
            return False

    async def send_text(self, serial: str, text: str) -> bool:
        """
        Send text input to device
        Automatically broadcasts to slave devices if this device is a master in an enabled group

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

            # Broadcast to slave devices if this is a master
            async def _send_text_to_slave(slave_serial: str, data: dict) -> bool:
                cmd = f'input text "{data["text"]}"'
                result = ADBManager.execute_shell(slave_serial, cmd, self.adb_path)
                if not result[0]:
                    print(f"[ControlService] Failed to send text to slave {slave_serial}: {result[1]}")
                    return False
                return True

            broadcasted = await self._broadcast_if_master(
                serial=serial,
                event_type='text',
                event_data={"text": text},
                handler_func=_send_text_to_slave
            )

            if broadcasted:
                print(f"[ControlService] Text input broadcasted to {len(broadcasted)} slaves")

            return True

        except Exception as e:
            print(f"Failed to send text to {serial}: {e}")
            return False

    async def send_swipe(self, serial: str, swipe_data: dict) -> bool:
        """
        Send swipe gesture to device
        Automatically broadcasts to slave devices if this device is a master in an enabled group

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

            # Broadcast to slave devices if this is a master
            async def _send_swipe_to_slave(slave_serial: str, data: dict) -> bool:
                cmd = f'input swipe {data["x1"]} {data["y1"]} {data["x2"]} {data["y2"]} {data.get("duration", 300)}'
                result = ADBManager.execute_shell(slave_serial, cmd, self.adb_path)
                if not result[0]:
                    print(f"[ControlService] Failed to send swipe to slave {slave_serial}: {result[1]}")
                    return False
                return True

            broadcasted = await self._broadcast_if_master(
                serial=serial,
                event_type='swipe',
                event_data=swipe_data,
                handler_func=_send_swipe_to_slave
            )

            if broadcasted:
                print(f"[ControlService] Swipe gesture broadcasted to {len(broadcasted)} slaves")

            return True

        except Exception as e:
            print(f"Failed to send swipe to {serial}: {e}")
            return False

    async def send_system_key(self, serial: str, action: str) -> bool:
        """
        Send system key event to device
        Automatically broadcasts to slave devices if this device is a master in an enabled group

        Args:
            serial: Device serial
            action: System key action
                - 'home': Home button (KEYCODE_HOME = 3)
                - 'back': Back button (KEYCODE_BACK = 4)
                - 'recent': Recent apps (KEYCODE_APP_SWITCH = 187)
                - 'menu': Menu button (KEYCODE_MENU = 82)
                - 'power': Power button (KEYCODE_POWER = 26)
                - 'volume_up': Volume up (KEYCODE_VOLUME_UP = 24)
                - 'volume_down': Volume down (KEYCODE_VOLUME_DOWN = 25)
                - 'notification': Expand notification panel (via swipe)
                - 'notification_close': Collapse panels (via back key)

        Returns:
            Success status
        """
        try:
            # Map action to Android keycode or command
            keycode_map = {
                'home': 3,
                'back': 4,
                'recent': 187,
                'menu': 82,
                'power': 26,
                'volume_up': 24,
                'volume_down': 25
            }

            # Special actions that require shell commands
            if action == 'notification':
                # Expand notification panel
                command = 'cmd statusbar expand-notifications'
                ADBManager.execute_shell(serial, command, self.adb_path)
                print(f"Notification panel expanded for {serial}")

                # Broadcast to slaves
                async def _expand_notification_slave(slave_serial: str, data: dict) -> bool:
                    result = ADBManager.execute_shell(slave_serial, command, self.adb_path)
                    if not result[0]:
                        print(f"[ControlService] Failed to expand notification on slave {slave_serial}: {result[1]}")
                        return False
                    return True

                await self._broadcast_if_master(
                    serial=serial,
                    event_type='notification',
                    event_data={'action': action},
                    handler_func=_expand_notification_slave
                )
                return True

            elif action == 'notification_close':
                # Collapse panels (same as back)
                command = 'input keyevent 4'
                ADBManager.execute_shell(serial, command, self.adb_path)
                print(f"Notification panel collapsed for {serial}")

                # Broadcast to slaves
                async def _collapse_panel_slave(slave_serial: str, data: dict) -> bool:
                    try:
                        ADBManager.execute_shell(slave_serial, command, self.adb_path)
                        return True
                    except Exception:
                        return False

                await self._broadcast_if_master(
                    serial=serial,
                    event_type='notification_close',
                    event_data={'action': action},
                    handler_func=_collapse_panel_slave
                )
                return True

            if action not in keycode_map:
                print(f"Unknown system key action: {action}")
                return False

            keycode = keycode_map[action]

            # Use ADB to send keyevent
            command = f'input keyevent {keycode}'
            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"System key '{action}' (keycode {keycode}) sent to {serial}")

            # Broadcast to slave devices if this is a master
            async def _send_system_key_to_slave(slave_serial: str, data: dict) -> bool:
                try:
                    cmd = f'input keyevent {keycode}'
                    ADBManager.execute_shell(slave_serial, cmd, self.adb_path)
                    return True
                except Exception:
                    return False

            broadcasted = await self._broadcast_if_master(
                serial=serial,
                event_type='system_key',
                event_data={'action': action, 'keycode': keycode},
                handler_func=_send_system_key_to_slave
            )

            if broadcasted:
                print(f"[ControlService] System key broadcasted to {len(broadcasted)} slaves")

            return True

        except Exception as e:
            print(f"Failed to send system key to {serial}: {e}")
            return False

    async def set_clipboard(self, serial: str, text: str) -> bool:
        """
        Set clipboard content on device
        Automatically broadcasts to slave devices if this device is a master in an enabled group

        Args:
            serial: Device serial
            text: Text to set in clipboard

        Returns:
            Success status
        """
        try:
            # Escape special characters for shell
            escaped_text = text.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')

            # Use ADB to set clipboard
            command = f'cmd clipboard set-text "{escaped_text}"'

            ADBManager.execute_shell(serial, command, self.adb_path)

            print(f"[ControlService] Clipboard set for {serial}: {text[:50]}...")

            # Broadcast to slave devices if this is a master
            async def _set_clipboard_slave(slave_serial: str, data: dict) -> bool:
                try:
                    cmd = f'cmd clipboard set-text "{data["escaped_text"]}"'
                    ADBManager.execute_shell(slave_serial, cmd, self.adb_path)
                    return True
                except Exception:
                    return False

            broadcasted = await self._broadcast_if_master(
                serial=serial,
                event_type='clipboard_set',
                event_data={'text': text, 'escaped_text': escaped_text},
                handler_func=_set_clipboard_slave
            )

            if broadcasted:
                print(f"[ControlService] Clipboard broadcasted to {len(broadcasted)} slaves")

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
