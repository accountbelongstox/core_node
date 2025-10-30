"""Key event definitions"""

from dataclasses import dataclass
from enum import Enum


class KeyAction(Enum):
    """Key action types"""
    DOWN = 0  # Key pressed
    UP = 1    # Key released


class AndroidKeyCode(Enum):
    """Common Android key codes"""
    KEYCODE_HOME = 3
    KEYCODE_BACK = 4
    KEYCODE_CALL = 5
    KEYCODE_ENDCALL = 6
    KEYCODE_VOLUME_UP = 24
    KEYCODE_VOLUME_DOWN = 25
    KEYCODE_POWER = 26
    KEYCODE_CAMERA = 27
    KEYCODE_CLEAR = 28
    KEYCODE_A = 29
    KEYCODE_B = 30
    KEYCODE_C = 31
    KEYCODE_D = 32
    KEYCODE_E = 33
    KEYCODE_F = 34
    KEYCODE_G = 35
    KEYCODE_H = 36
    KEYCODE_I = 37
    KEYCODE_J = 38
    KEYCODE_K = 39
    KEYCODE_L = 40
    KEYCODE_M = 41
    KEYCODE_N = 42
    KEYCODE_O = 43
    KEYCODE_P = 44
    KEYCODE_Q = 45
    KEYCODE_R = 46
    KEYCODE_S = 47
    KEYCODE_T = 48
    KEYCODE_U = 49
    KEYCODE_V = 50
    KEYCODE_W = 51
    KEYCODE_X = 52
    KEYCODE_Y = 53
    KEYCODE_Z = 54
    KEYCODE_SPACE = 62
    KEYCODE_ENTER = 66
    KEYCODE_DEL = 67
    KEYCODE_TAB = 61
    KEYCODE_ESCAPE = 111
    KEYCODE_CTRL_LEFT = 113
    KEYCODE_CTRL_RIGHT = 114
    KEYCODE_SHIFT_LEFT = 59
    KEYCODE_SHIFT_RIGHT = 60
    KEYCODE_ALT_LEFT = 57
    KEYCODE_ALT_RIGHT = 58


@dataclass
class KeyEvent:
    """Key event data"""
    action: KeyAction           # Action type
    keycode: int                # Android key code
    meta_state: int = 0         # Meta keys state (Shift, Ctrl, Alt)

    def __repr__(self) -> str:
        return (
            f"KeyEvent(action={self.action.name}, keycode={self.keycode}, "
            f"meta_state={self.meta_state})"
        )
