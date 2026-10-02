# -*- coding: utf-8 -*-
"""Seconds since the last keyboard/pointer input of the desktop session (shared library)."""

from __future__ import annotations

import ctypes
import sys
from typing import Optional

from pycore.pyfoundations.desktop_session import SESSION_X11, current_desktop_session
from pycore.pyutils.common.session_dbus import call_session_method
from pycore.pyutils.common.x11_display import x11_display

MUTTER_IDLE_BUS_NAME = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_OBJECT_PATH = "/org/gnome/Mutter/IdleMonitor/Core"
MUTTER_IDLE_INTERFACE = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_METHOD = "GetIdletime"
MILLISECONDS_PER_SECOND = 1000.0
TICK_COUNT_MASK = 0xFFFFFFFF


class _LastInputInfo(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def _windows_idle_seconds() -> Optional[float]:
    info = _LastInputInfo()
    info.cbSize = ctypes.sizeof(_LastInputInfo)
    user32 = ctypes.windll.user32
    if not user32.GetLastInputInfo(ctypes.byref(info)):
        return None
    elapsed = (ctypes.windll.kernel32.GetTickCount() - info.dwTime) & TICK_COUNT_MASK
    return elapsed / MILLISECONDS_PER_SECOND


def _mutter_idle_seconds() -> Optional[float]:
    reply = call_session_method(
        MUTTER_IDLE_BUS_NAME,
        MUTTER_IDLE_OBJECT_PATH,
        MUTTER_IDLE_INTERFACE,
        MUTTER_IDLE_METHOD,
    )
    value = reply.value(0)
    return None if value is None else float(value) / MILLISECONDS_PER_SECOND


def user_idle_seconds() -> Optional[float]:
    """None when the platform cannot tell; callers must then not defer."""
    try:
        if sys.platform == "win32":
            return _windows_idle_seconds()
        idle = _mutter_idle_seconds()
        if idle is None and current_desktop_session().session_type == SESSION_X11:
            idle = x11_display.idle_seconds()
        return idle
    except Exception:  # noqa: BLE001 - idle probing is best-effort on every platform
        return None


__all__ = ["user_idle_seconds"]
