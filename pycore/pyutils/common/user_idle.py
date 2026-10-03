# -*- coding: utf-8 -*-
"""Seconds since the last user input of the desktop session (shared library).

`user_idle_seconds`: keyboard only (pointer activity never resets it).
`input_idle_seconds`: keyboard or pointer (movement, buttons, wheel, touchpad).
One watch thread stamps the last key press and the last pointer event on
THREAD_BUS. Linux: evdev keyboards and pointers, readable through the uaccess
udev rule of install step 119 (pycore's own XTEST input never reaches evdev).
Windows: low-level keyboard and mouse hooks; input pycore sends carries
SELF_INPUT_MARKER and is ignored. Without a readable device the session's
all-input idle is used.
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
from typing import Dict, List, Optional, Set

from pycore.pyfoundations.desktop_session import SESSION_X11, current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.session_dbus import call_session_method
from pycore.pyutils.common.x11_display import x11_display

LABEL = "UserIdle"
SELF_INPUT_MARKER = 0x50594352
MUTTER_IDLE_BUS_NAME = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_OBJECT_PATH = "/org/gnome/Mutter/IdleMonitor/Core"
MUTTER_IDLE_INTERFACE = "org.gnome.Mutter.IdleMonitor"
MUTTER_IDLE_METHOD = "GetIdletime"
MILLISECONDS_PER_SECOND = 1000.0
TICK_COUNT_MASK = 0xFFFFFFFF
KEYBOARD_LAST_INPUT_SIGNAL = "desktop.keyboard.last_input"
POINTER_LAST_INPUT_SIGNAL = "desktop.pointer.last_input"
KEYBOARD_WATCH_ACTIVE_SIGNAL = "desktop.keyboard.watch_active"
POINTER_WATCH_ACTIVE_SIGNAL = "desktop.pointer.watch_active"
INPUT_WATCH_STARTED_SIGNAL = "desktop.input.watch_started"
INPUT_WATCH_THREAD_NAME = "InputIdleWatchThread"
INPUT_PUBLISH_MIN_SECONDS = 0.5
INPUT_RESCAN_SECONDS = 5.0
DEVICE_KEYBOARD = "keyboard"
DEVICE_POINTER = "pointer"
EVDEV_GLOB = "/dev/input/event*"
EVDEV_SYSFS_CAPS = "/sys/class/input/{name}/device/capabilities/{kind}"
EVDEV_EVENT = struct.Struct("llHHi")
EVDEV_LONG_BITS = struct.calcsize("l") * 8
EVDEV_EV_KEY = 1
EVDEV_EV_REL = 2
EVDEV_EV_ABS = 3
EVDEV_KEY_DOWN_VALUES = (1, 2)
EVDEV_LETTER_KEY_CODES = range(16, 26)
EVDEV_REL_X = 0
EVDEV_ABS_X = 0
EVDEV_BTN_FIRST = 0x110
EVDEV_BTN_LAST = 0x14F
EVDEV_POINTER_BUTTONS = (0x110, 0x14A)
EVDEV_READ_EVENTS = 64
WIN_WH_KEYBOARD_LL = 13
WIN_WH_MOUSE_LL = 14
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


def _evdev_caps(name: str, kind: str) -> int:
    try:
        words = Path(EVDEV_SYSFS_CAPS.format(name=name, kind=kind)).read_text(encoding="ascii").split()
    except OSError:
        return 0
    bits = 0
    for word in words:
        bits = (bits << EVDEV_LONG_BITS) | int(word, 16)
    return bits


def _evdev_kind(name: str) -> Optional[str]:
    keys = _evdev_caps(name, "key")
    if all(keys >> code & 1 for code in EVDEV_LETTER_KEY_CODES):
        return DEVICE_KEYBOARD
    if _evdev_caps(name, "rel") >> EVDEV_REL_X & 1:
        return DEVICE_POINTER
    if _evdev_caps(name, "abs") >> EVDEV_ABS_X & 1 and any(keys >> code & 1 for code in EVDEV_POINTER_BUTTONS):
        return DEVICE_POINTER
    return None


class _EvdevDevices:
    """Open keyboard and pointer evdev nodes by path; hotplug and permission changes are picked up on refresh."""

    def __init__(self) -> None:
        self.fds: Dict[str, int] = {}
        self.kinds: Dict[int, str] = {}

    def refresh(self) -> Set[str]:
        present = set(glob.glob(EVDEV_GLOB))
        for path in [path for path in self.fds if path not in present]:
            self._close(path)
        for path in sorted(present - set(self.fds)):
            kind = _evdev_kind(os.path.basename(path))
            if kind is None:
                continue
            try:
                fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
            except OSError:
                continue
            self.fds[path] = fd
            self.kinds[fd] = kind
        return set(self.kinds.values())

    def drop(self, fd: int) -> None:
        for path, open_fd in list(self.fds.items()):
            if open_fd == fd:
                self._close(path)

    def _close(self, path: str) -> None:
        fd = self.fds.pop(path)
        self.kinds.pop(fd, None)
        os.close(fd)


def _evdev_activity(fd: int, kind: str) -> bool:
    try:
        data = os.read(fd, EVDEV_EVENT.size * EVDEV_READ_EVENTS)
    except BlockingIOError:
        return False
    for offset in range(0, len(data) - EVDEV_EVENT.size + 1, EVDEV_EVENT.size):
        _sec, _usec, event_type, code, value = EVDEV_EVENT.unpack_from(data, offset)
        if kind == DEVICE_KEYBOARD:
            if event_type == EVDEV_EV_KEY and value in EVDEV_KEY_DOWN_VALUES and code < EVDEV_BTN_FIRST:
                return True
        elif event_type in (EVDEV_EV_REL, EVDEV_EV_ABS):
            return True
        elif event_type == EVDEV_EV_KEY and EVDEV_BTN_FIRST <= code <= EVDEV_BTN_LAST and value == 1:
            return True
    return False


class _Publisher:
    """Rate-limited THREAD_BUS stamps of the last keyboard and pointer input."""

    SIGNALS = {DEVICE_KEYBOARD: KEYBOARD_LAST_INPUT_SIGNAL, DEVICE_POINTER: POINTER_LAST_INPUT_SIGNAL}
    ACTIVE = {DEVICE_KEYBOARD: KEYBOARD_WATCH_ACTIVE_SIGNAL, DEVICE_POINTER: POINTER_WATCH_ACTIVE_SIGNAL}

    def __init__(self) -> None:
        self._published: Dict[str, float] = {}
        self._reported: Optional[Set[str]] = None

    def stamp(self, kind: str, stamp: float) -> None:
        if stamp - self._published.get(kind, 0.0) >= INPUT_PUBLISH_MIN_SECONDS:
            self._published[kind] = stamp
            THREAD_BUS.signal(self.SIGNALS[kind], stamp)

    def active(self, kinds: Set[str], source: str) -> None:
        for kind, signal in self.ACTIVE.items():
            THREAD_BUS.signal(signal, kind in kinds)
        if kinds == self._reported:
            return
        self._reported = set(kinds)
        if kinds:
            ColorPrint.blue(f"[{LABEL}] input idle watch on source={source} devices={','.join(sorted(kinds))}")
        else:
            ColorPrint.yellow(f"[{LABEL}] no readable input device; idle falls back to all session input")


def _watch_evdev() -> None:
    devices = _EvdevDevices()
    publisher = _Publisher()
    rescan_at = 0.0
    while not THREAD_BUS.is_shutdown_requested():
        now = time.monotonic()
        if now >= rescan_at:
            publisher.active(devices.refresh(), "evdev")
            rescan_at = now + INPUT_RESCAN_SECONDS
        if not devices.fds:
            time.sleep(INPUT_RESCAN_SECONDS)
            continue
        fds: List[int] = list(devices.kinds)
        try:
            readable, _w, _x = select.select(fds, [], [], INPUT_RESCAN_SECONDS)
        except OSError:
            rescan_at = 0.0
            continue
        stamp = time.monotonic()
        for fd in readable:
            kind = devices.kinds.get(fd)
            if kind is None:
                continue
            try:
                if _evdev_activity(fd, kind):
                    publisher.stamp(kind, stamp)
            except OSError:
                devices.drop(fd)
                rescan_at = 0.0


def _watch_windows_hooks() -> None:
    from ctypes import wintypes

    class KeyboardHookData(ctypes.Structure):
        _fields_ = [
            ("vkCode", wintypes.DWORD),
            ("scanCode", wintypes.DWORD),
            ("flags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_size_t),
        ]

    class MouseHookData(ctypes.Structure):
        _fields_ = [
            ("pt", wintypes.POINT),
            ("mouseData", wintypes.DWORD),
            ("flags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_size_t),
        ]

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    hook_proc_type = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
    user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
    user32.CallNextHookEx.restype = ctypes.c_ssize_t
    user32.SetWindowsHookExW.argtypes = [ctypes.c_int, hook_proc_type, wintypes.HINSTANCE, wintypes.DWORD]
    user32.SetWindowsHookExW.restype = wintypes.HHOOK
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    last_input = {DEVICE_KEYBOARD: 0.0, DEVICE_POINTER: 0.0}

    def hook_proc(kind: str, data_type: type):
        def on_input(code: int, w_param: int, l_param: int) -> int:
            if code >= 0 and ctypes.cast(l_param, ctypes.POINTER(data_type)).contents.dwExtraInfo != SELF_INPUT_MARKER:
                last_input[kind] = time.monotonic()
            return user32.CallNextHookEx(None, code, w_param, l_param)
        return hook_proc_type(on_input)

    callbacks = {
        DEVICE_KEYBOARD: (WIN_WH_KEYBOARD_LL, hook_proc(DEVICE_KEYBOARD, KeyboardHookData)),
        DEVICE_POINTER: (WIN_WH_MOUSE_LL, hook_proc(DEVICE_POINTER, MouseHookData)),
    }
    module = kernel32.GetModuleHandleW(None)
    hooks = {kind: user32.SetWindowsHookExW(hook_id, callback, module, 0) for kind, (hook_id, callback) in callbacks.items()}
    publisher = _Publisher()
    publisher.active({kind for kind, hook in hooks.items() if hook}, "hook")
    if not any(hooks.values()):
        return
    user32.SetTimer(None, 0, WIN_PUBLISH_TIMER_MS, None)
    published = dict(last_input)
    message = wintypes.MSG()
    try:
        while not THREAD_BUS.is_shutdown_requested() and user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
            if message.message == WIN_WM_TIMER:
                for kind, stamp in last_input.items():
                    if stamp > published[kind]:
                        published[kind] = stamp
                        publisher.stamp(kind, stamp)
            user32.TranslateMessage(ctypes.byref(message))
            user32.DispatchMessageW(ctypes.byref(message))
    finally:
        for hook in hooks.values():
            if hook:
                user32.UnhookWindowsHookEx(hook)
        publisher.active(set(), "hook")


def _run_input_watch() -> None:
    try:
        if sys.platform == "win32":
            _watch_windows_hooks()
        else:
            _watch_evdev()
    except Exception as exc:  # noqa: BLE001 - thread boundary: the watch never takes pycore down
        THREAD_BUS.signal(KEYBOARD_WATCH_ACTIVE_SIGNAL, False)
        THREAD_BUS.signal(POINTER_WATCH_ACTIVE_SIGNAL, False)
        ColorPrint.yellow(f"[{LABEL}] input idle watch stopped: {type(exc).__name__}: {exc}")


def start_input_idle_watch() -> None:
    """Start the input watch once per process; idle starts from the session's all-input idle."""
    if THREAD_BUS.get_signal(INPUT_WATCH_STARTED_SIGNAL, False):
        return
    THREAD_BUS.signal(INPUT_WATCH_STARTED_SIGNAL, True)
    seed = time.monotonic() - (_session_idle_seconds() or 0.0)
    THREAD_BUS.signal(KEYBOARD_LAST_INPUT_SIGNAL, seed)
    THREAD_BUS.signal(POINTER_LAST_INPUT_SIGNAL, seed)
    start_bus_task(_run_input_watch, thread_name=INPUT_WATCH_THREAD_NAME)


def _watched_idle(active_signal: str, last_signal: str) -> Optional[float]:
    if not THREAD_BUS.get_signal(active_signal, False):
        return None
    last_input = THREAD_BUS.get_signal(last_signal)
    return max(0.0, time.monotonic() - last_input) if isinstance(last_input, float) else None


def user_idle_seconds() -> Optional[float]:
    """Seconds without keyboard input; None when the platform cannot tell (callers must then not defer)."""
    idle = _watched_idle(KEYBOARD_WATCH_ACTIVE_SIGNAL, KEYBOARD_LAST_INPUT_SIGNAL)
    return idle if idle is not None else _session_idle_seconds()


def input_idle_seconds() -> Optional[float]:
    """Seconds without keyboard or pointer input; None when the platform cannot tell."""
    keyboard = _watched_idle(KEYBOARD_WATCH_ACTIVE_SIGNAL, KEYBOARD_LAST_INPUT_SIGNAL)
    pointer = _watched_idle(POINTER_WATCH_ACTIVE_SIGNAL, POINTER_LAST_INPUT_SIGNAL)
    if keyboard is None or pointer is None:
        session = _session_idle_seconds()
        if keyboard is None and pointer is None:
            return session
        watched = keyboard if keyboard is not None else pointer
        return watched if session is None else min(watched, session)
    return min(keyboard, pointer)


__all__ = ["SELF_INPUT_MARKER", "input_idle_seconds", "start_input_idle_watch", "user_idle_seconds"]
