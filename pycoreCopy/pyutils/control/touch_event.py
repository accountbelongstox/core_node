"""Touch event definitions"""

from dataclasses import dataclass
from enum import Enum


class TouchAction(Enum):
    """Touch action types"""
    DOWN = 0    # Finger down
    UP = 1      # Finger up
    MOVE = 2    # Finger move


@dataclass
class TouchEvent:
    """Touch event data"""
    action: TouchAction     # Action type
    x: int                  # X coordinate
    y: int                  # Y coordinate
    pressure: float = 1.0   # Touch pressure (0.0-1.0)
    pointer_id: int = 0     # Pointer ID for multi-touch

    def __repr__(self) -> str:
        return (
            f"TouchEvent(action={self.action.name}, x={self.x}, y={self.y}, "
            f"pressure={self.pressure}, pointer_id={self.pointer_id})"
        )
