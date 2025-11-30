"""
pyutils.control - Control protocol module

Features:
- Touch event handling
- Key event handling
- Coordinate mapping (resolution adaptation)
- scrcpy protocol message building

Dependencies:
- Standard library only

Example:
    from pycore.pyutils.control import (
        TouchEvent, TouchAction,
        CoordinateMapper,
        MessageBuilder
    )

    # Create touch event
    event = TouchEvent(
        action=TouchAction.DOWN,
        x=500,
        y=1000,
        pressure=1.0
    )

    # Map coordinates
    mapped_x, mapped_y = CoordinateMapper.map(
        500, 1000,
        from_width=720, from_height=1280,
        to_width=1440, to_height=3120
    )

    # Build scrcpy message
    message = MessageBuilder.build_touch_event(
        event, screen_width=1440, screen_height=3120
    )
"""

from .touch_event import TouchEvent, TouchAction
from .key_event import KeyEvent, KeyAction, AndroidKeyCode
from .coordinate_mapper import CoordinateMapper
from .message_builder import MessageBuilder

__all__ = [
    'TouchEvent',
    'TouchAction',
    'KeyEvent',
    'KeyAction',
    'AndroidKeyCode',
    'CoordinateMapper',
    'MessageBuilder'
]

__version__ = '1.0.0'
