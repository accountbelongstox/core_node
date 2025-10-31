"""scrcpy protocol message builder"""

import struct
from .touch_event import TouchEvent, TouchAction
from .key_event import KeyEvent, KeyAction


class MessageBuilder:
    """
    scrcpy control message builder

    Reference: https://github.com/Genymobile/scrcpy/blob/master/app/src/control_msg.h

    Message types:
    - TYPE_INJECT_KEYCODE = 0
    - TYPE_INJECT_TEXT = 1
    - TYPE_INJECT_TOUCH_EVENT = 2
    - TYPE_INJECT_SCROLL_EVENT = 3
    - TYPE_BACK_OR_SCREEN_ON = 4
    - TYPE_EXPAND_NOTIFICATION_PANEL = 5
    - TYPE_EXPAND_SETTINGS_PANEL = 6
    - TYPE_COLLAPSE_PANELS = 7
    - TYPE_GET_CLIPBOARD = 8
    - TYPE_SET_CLIPBOARD = 9
    - TYPE_SET_SCREEN_POWER_MODE = 10
    - TYPE_ROTATE_DEVICE = 11
    """

    # Message type constants
    TYPE_INJECT_KEYCODE = 0
    TYPE_INJECT_TEXT = 1
    TYPE_INJECT_TOUCH_EVENT = 2
    TYPE_INJECT_SCROLL_EVENT = 3
    TYPE_BACK_OR_SCREEN_ON = 4
    TYPE_SET_SCREEN_POWER_MODE = 10

    # Touch event action constants
    AMOTION_EVENT_ACTION_DOWN = 0
    AMOTION_EVENT_ACTION_UP = 1
    AMOTION_EVENT_ACTION_MOVE = 2

    @staticmethod
    def build_touch_event(
        event: TouchEvent,
        screen_width: int,
        screen_height: int
    ) -> bytes:
        """
        Build touch event message

        Message format:
        - [0]: type (1 byte) = TYPE_INJECT_TOUCH_EVENT (2)
        - [1]: action (1 byte)
        - [2-9]: pointer_id (8 bytes, int64)
        - [10-13]: x position (4 bytes, uint32)
        - [14-17]: y position (4 bytes, uint32)
        - [18-19]: screen width (2 bytes, uint16)
        - [20-21]: screen height (2 bytes, uint16)
        - [22-23]: pressure (2 bytes, uint16, 0xFFFF for max)
        - [24-27]: buttons (4 bytes, uint32)

        Args:
            event: Touch event
            screen_width: Device screen width
            screen_height: Device screen height

        Returns:
            Binary message
        """
        # Convert action
        if event.action == TouchAction.DOWN:
            action = MessageBuilder.AMOTION_EVENT_ACTION_DOWN
        elif event.action == TouchAction.UP:
            action = MessageBuilder.AMOTION_EVENT_ACTION_UP
        else:  # MOVE
            action = MessageBuilder.AMOTION_EVENT_ACTION_MOVE

        # Convert pressure (0.0-1.0 -> 0-0xFFFF)
        pressure = int(event.pressure * 0xFFFF)

        # Build message
        message = struct.pack(
            '>BBlLLHHHI',
            MessageBuilder.TYPE_INJECT_TOUCH_EVENT,  # type (1 byte)
            action,                                   # action (1 byte)
            event.pointer_id,                         # pointer_id (8 bytes)
            event.x,                                  # x (4 bytes)
            event.y,                                  # y (4 bytes)
            screen_width,                             # screen width (2 bytes)
            screen_height,                            # screen height (2 bytes)
            pressure,                                 # pressure (2 bytes)
            0                                         # buttons (4 bytes)
        )

        return message

    @staticmethod
    def build_keycode_event(
        event: KeyEvent
    ) -> bytes:
        """
        Build key event message

        Message format:
        - [0]: type (1 byte) = TYPE_INJECT_KEYCODE (0)
        - [1]: action (1 byte)
        - [2-5]: keycode (4 bytes, uint32)
        - [6-9]: repeat (4 bytes, uint32)
        - [10-13]: meta_state (4 bytes, uint32)

        Args:
            event: Key event

        Returns:
            Binary message
        """
        # Convert action
        if event.action == KeyAction.DOWN:
            action = 0
        else:  # UP
            action = 1

        # Build message
        message = struct.pack(
            '>BBIII',
            MessageBuilder.TYPE_INJECT_KEYCODE,  # type (1 byte)
            action,                               # action (1 byte)
            event.keycode,                        # keycode (4 bytes)
            0,                                    # repeat (4 bytes)
            event.meta_state                      # meta_state (4 bytes)
        )

        return message

    @staticmethod
    def build_text_event(text: str) -> bytes:
        """
        Build text injection message

        Message format:
        - [0]: type (1 byte) = TYPE_INJECT_TEXT (1)
        - [1-4]: text length (4 bytes, uint32)
        - [5-...]: text (UTF-8 encoded)

        Args:
            text: Text to inject

        Returns:
            Binary message
        """
        text_bytes = text.encode('utf-8')
        text_length = len(text_bytes)

        # Build message
        message = struct.pack(
            f'>BI{text_length}s',
            MessageBuilder.TYPE_INJECT_TEXT,  # type (1 byte)
            text_length,                       # text length (4 bytes)
            text_bytes                         # text
        )

        return message

    @staticmethod
    def build_back_or_screen_on() -> bytes:
        """
        Build back button or screen on message

        Returns:
            Binary message (single byte)
        """
        return struct.pack('>B', MessageBuilder.TYPE_BACK_OR_SCREEN_ON)

    @staticmethod
    def build_set_screen_power(on: bool) -> bytes:
        """
        Build screen power control message

        Args:
            on: True to turn screen on, False to turn off

        Returns:
            Binary message
        """
        # Power mode: 2 = ON, 0 = OFF
        mode = 2 if on else 0

        message = struct.pack(
            '>BB',
            MessageBuilder.TYPE_SET_SCREEN_POWER_MODE,  # type (1 byte)
            mode                                         # mode (1 byte)
        )

        return message
