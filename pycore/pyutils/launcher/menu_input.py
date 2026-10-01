# -*- coding: utf-8 -*-
"""Single-key console input for the launcher menu (arrows, Enter, Esc)."""

import os
import sys

IS_WINDOWS = os.name == 'nt'
if IS_WINDOWS:
    import msvcrt
else:
    import termios
    import tty

KEY_UP = 'up'
KEY_DOWN = 'down'
KEY_LEFT = 'left'
KEY_RIGHT = 'right'
KEY_ENTER = 'enter'
KEY_ESC = 'esc'
KEY_BACKSPACE = 'backspace'

WINDOWS_PREFIX_KEYS = (b'\xe0', b'\x00')
WINDOWS_ARROWS = {b'H': KEY_UP, b'P': KEY_DOWN, b'K': KEY_LEFT, b'M': KEY_RIGHT}
WINDOWS_SPECIAL = {b'\r': KEY_ENTER, b'\x1b': KEY_ESC, b'\x08': KEY_BACKSPACE}
ANSI_ESC = '\x1b'
ANSI_CSI = '['
ANSI_ARROWS = {'A': KEY_UP, 'B': KEY_DOWN, 'D': KEY_LEFT, 'C': KEY_RIGHT}
POSIX_ENTER_KEYS = ('\r', '\n')
CLEAR_COMMAND = 'cls' if IS_WINDOWS else 'clear'


def clear_screen() -> None:
    os.system(CLEAR_COMMAND)


def read_key() -> str:
    """One key press: a KEY_* name or the lower-cased character ('' if unknown)."""
    if IS_WINDOWS:
        return _read_key_windows()
    if not sys.stdin.isatty():
        return input().strip().lower()
    return _read_key_posix()


def _read_key_windows() -> str:
    key = msvcrt.getch()
    if key in WINDOWS_PREFIX_KEYS:
        return WINDOWS_ARROWS.get(msvcrt.getch(), '')
    if key in WINDOWS_SPECIAL:
        return WINDOWS_SPECIAL[key]
    return key.decode('utf-8', errors='ignore').lower()


def _read_key_posix() -> str:
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == ANSI_ESC:
            if sys.stdin.read(1) == ANSI_CSI:
                return ANSI_ARROWS.get(sys.stdin.read(1), '')
            return KEY_ESC
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    if ch in POSIX_ENTER_KEYS:
        return KEY_ENTER
    return ch.lower()
