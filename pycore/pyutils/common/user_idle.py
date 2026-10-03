# -*- coding: utf-8 -*-
"""Seconds since the last keyboard input of the desktop session (shared library).

Desktop idle means no keyboard input: pointer movement (users, remote-desktop
agents, synthetic mice) never resets it. A keyboard watch thread stamps the
last key press on THREAD_BUS (Linux: evdev keyboards, readable through the
uaccess udev rule of install step 119; Windows: low-level keyboard hook).
Until the watch can read a keyboard, the session's all-input idle is used.
"""

from __future__ import annotations

import ctypes
import glob
import os
import select
import struct
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.desktop_session import SESSION_X11, current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.session_dbus import call_session_method
from pycore.pyutils.common.x11_display import x11_display

LABEL = "UserIdle"
MUTTER_IDLE_BUS_NAME = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_OBJECT_PATH = "/org/gnome/Mutter/IdleMonitor/Core"
MUTTER_IDLE_INTERFACE = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_METHOD = "GetIdletime"
MILLISECONDS_PER_SECOND = 1000.0
TICK_COUNT_MASK = 0xFFFFFFFF
KEYBOARD_LAST_INPUT_SIGNAL = "desktop.keyboard.last_input"
KEYBOARD_WATCH_ACTIVE_SIGNAL = "desktop.keyboard.watch_active"
KEYBOARD_WATCH_STARTED_SIGNAL = "desktop.keyboard.watch_started"
KEYBOARD_WATCH_THREAD_NAME = "KeyboardIdleWatchThread"
KEYBOARD_PUBLISH_MIN_SECONDS = 0.5
KEYBOARD_RESCAN_SECONDS = 5.0
EVDEV_GLOB = "/dev/input/event*"
EVDEV_SYSFS_KEY_CAPS = "/sys/class/input/{name}/device/capabilities/key"
EVDEV_EVENT = struct.Struct("llHHi")
EVDEV_LONG_BITS = struct.calcsize("l") * 8
EVDEV_EV_KEY = 1
EVDEV_KEY_DOWN_VALUES = (1, 2)
EVDEV_LETTER_KEY_CODES = range(16, 26)
EVDEV_READ_EVENTS = 64
WIN_WH_KEYBOARD_LL = 13
WIN_WM_TIMER = 0x0113
WIN_PUBLISH_TIMER_MS = 1000


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


def _session_idle_seconds() -> Optional[float]:
    """All-input idle (keyboard and pointer) of the desktop session."""
    try:
        if sys.platform == "win32":
            return _windows_idle_seconds()
        idle = _mutter_idle_seconds()
        if idle is None and current_desktop_session().session_type == SESSION_X11:
            idle = x11_display.idle_seconds()
        return idle
    except Exception:  # noqa: BLE001 - idle probing is best-effort on every platform
        return None


def _publish_key(stamp: float) -> None:
    THREAD_BUS.signal(KEYBOARD_LAST_INPUT_SIGNAL, stamp)


def _evdev_is_keyboard(name: str) -> bool:
    try:
        words = Path(EVDEV_SYSFS_KEY_CAPS.format(name=name)).read_text(encoding="ascii").split()
    except OSError:
        return False
    bits = 0
    for word in words:
        bits = (bits << EVDEV_LONG_BITS) | int(word, 16)
    return all(bits >> code & 1 for code in EVDEV_LETTER_KEY_CODES)


def _evdev_open_keyboards(opened: Dict[str, int]) -> None:
    present = set(glob.glob(EVDEV_GLOB))
    for path in [path for path in opened if path not in present]:
        os.close(opened.pop(path))
    for path in sorted(present - set(opened)):
        if not _evdev_is_keyboard(os.path.basename(path)):
            continue
        try:
            opened[path] = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
        except OSError:
            continue


def _evdev_key_pressed(fd: int) -> bool:
    try:
        data = os.read(fd, EVDEV_EVENT.size * EVDEV_READ_EVENTS)
    except BlockingIOError:
        return False
    for offset in range(0, len(data) - EVDEV_EVENT.size + 1, EVDEV_EVENT.size):
        _sec, _usec, event_type, _code, value = EVDEV_EVENT.unpack_from(data, offset)
        if event_type == EVDEV_EV_KEY and value in EVDEV_KEY_DOWN_VALUES:
            return True
    return False


def _watch_evdev() -> None:
    opened: Dict[str, int] = {}
    published = 0.0
    rescan_at = 0.0
    reported = None
    while not THREAD_BUS.is_shutdown_requested():
        now = time.monotonic()
        if now >= rescan_at:
            _evdev_open_keyboards(opened)
            rescan_at = now + KEYBOARD_RESCAN_SECONDS
            active = bool(opened)
            THREAD_BUS.signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, active)
            if active != reported:
                reported = active
                if active:
                    ColorPrint.blue(f"[{LABEL}] keyboard idle watch on keyboards={len(opened)}")
                else:
                    ColorPrint.yellow(
                        f"[{LABEL}] no readable keyboard device; idle falls back to all session input"
                    )
        if not opened:
            time.sleep(KEYBOARD_RESCAN_SECONDS)
            continue
        fds: List[int] = list(opened.values())
        try:
            readable, _w, _x = select.select(fds, [], [], KEYBOARD_RESCAN_SECONDS)
        except OSError:
            rescan_at = 0.0
            continue
        pressed = False
        for fd in readable:
            try:
                pressed = _evdev_key_pressed(fd) or pressed
            except OSError:
                rescan_at = 0.0
        stamp = time.monotonic()
        if pressed and stamp - published >= KEYBOARD_PUBLISH_MIN_SECONDS:
            published = stamp
            _publish_key(stamp)


def _watch_windows_hook() -> None:
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    hook_proc_type = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
    user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
    user32.CallNextHookEx.restype = ctypes.c_ssize_t
    user32.SetWindowsHookExW.argtypes = [ctypes.c_int, hook_proc_type, wintypes.HINSTANCE, wintypes.DWORD]
    user32.SetWindowsHookExW.restype = wintypes.HHOOK
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    last_key = [0.0]

    def on_key(code: int, w_param: int, l_param: int) -> int:
        if code >= 0:
            last_key[0] = time.monotonic()
        return user32.CallNextHookEx(None, code, w_param, l_param)

    callback = hook_proc_type(on_key)
    hook = user32.SetWindowsHookExW(WIN_WH_KEYBOARD_LL, callback, kernel32.GetModuleHandleW(None), 0)
    if not hook:
        ColorPrint.yellow(f"[{LABEL}] keyboard hook failed; idle falls back to all session input")
        return
    THREAD_BUS.signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, True)
    ColorPrint.blue(f"[{LABEL}] keyboard idle watch on (low-level hook)")
    user32.SetTimer(None, 0, WIN_PUBLISH_TIMER_MS, None)
    published = 0.0
    message = wintypes.MSG()
    try:
        while not THREAD_BUS.is_shutdown_requested() and user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
            if message.message == WIN_WM_TIMER and last_key[0] > published:
                published = last_key[0]
                _publish_key(published)
            user32.TranslateMessage(ctypes.byref(message))
            user32.DispatchMessageW(ctypes.byref(message))
    finally:
        user32.UnhookWindowsHookEx(hook)
        THREAD_BUS.signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, False)


def _run_keyboard_watch() -> None:
    try:
        if sys.platform == "win32":
            _watch_windows_hook()
        else:
            _watch_evdev()
    except Exception as exc:  # noqa: BLE001 - thread boundary: the watch never takes pycore down
        THREAD_BUS.signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, False)
        ColorPrint.yellow(f"[{LABEL}] keyboard idle watch stopped: {type(exc).__name__}: {exc}")


def start_keyboard_idle_watch() -> None:
    """Start the keyboard watch once per process; idle starts from the session's all-input idle."""
    if THREAD_BUS.get_signal(KEYBOARD_WATCH_STARTED_SIGNAL, False):
        return
    THREAD_BUS.signal(KEYBOARD_WATCH_STARTED_SIGNAL, True)
    idle = _session_idle_seconds()
    _publish_key(time.monotonic() - (idle or 0.0))
    start_bus_task(_run_keyboard_watch, thread_name=KEYBOARD_WATCH_THREAD_NAME)


def user_idle_seconds() -> Optional[float]:
    """Seconds without keyboard input; None when the platform cannot tell (callers must then not defer)."""
    if THREAD_BUS.get_signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, False):
        last_key = THREAD_BUS.get_signal(KEYBOARD_LAST_INPUT_SIGNAL)
        if isinstance(last_key, float):
            return max(0.0, time.monotonic() - last_key)
    return _session_idle_seconds()


__all__ = ["start_keyboard_idle_watch", "user_idle_seconds"]
