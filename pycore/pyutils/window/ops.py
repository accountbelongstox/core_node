#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import ctypes
import ctypes.wintypes
import time
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any, Union
from pathlib import Path
from ctypes import byref, c_int, c_uint, c_wchar_p, c_void_p, c_long, c_ulong, c_bool, c_ubyte, Structure, POINTER

# Use wintypes.POINT so user32 GetCursorPos/ScreenToClient match other libs (e.g. pyautogui) and avoid "expected LP_POINT instead of pointer to POINT"
wintypes = ctypes.wintypes
HWND = wintypes.HWND
LPARAM = wintypes.LPARAM
BOOL = wintypes.BOOL
WNDENUMPROC = ctypes.WINFUNCTYPE(BOOL, HWND, LPARAM)
POINT = wintypes.POINT

from pycore.pyfoundations.third_party.api import get_third_package_win32gui, get_third_package_win32con, get_third_package_win32api


PROCESS_TERMINATE = 0x0001
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_PATH_BUFFER_LENGTH = 32768
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.window.win32_window_constants import (
    GWL_EXSTYLE,
    SW_HIDE,
    SW_MINIMIZE,
    SW_RESTORE,
    SW_SHOW,
    SW_SHOWMAXIMIZED,
    SW_SHOWMINIMIZED,
    SW_SHOWNOACTIVATE,
    SW_SHOWNORMAL,
    SWP_NOACTIVATE,
    SWP_NOMOVE,
    SWP_NOSIZE,
    SWP_SHOWWINDOW,
    WS_EX_TOPMOST,
)

HWND_TOPMOST = c_void_p(-1)
HWND_NOTOPMOST = c_void_p(-2)

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
MAPVK_VK_TO_VSC = 0
EXTENDED_VIRTUAL_KEYS = frozenset((0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E))
VK_MENU = 0x12
WHEEL_DELTA = 120
MAX_WHEEL_STEPS_PER_INPUT = 120
SPI_GETWHEELSCROLLLINES = 0x0068
WHEEL_PAGESCROLL = 0xFFFFFFFF

WM_CLOSE = 0x0010
WM_COMMAND = 0x0111
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205
MK_LBUTTON = 0x0001
MK_RBUTTON = 0x0002


class RECT(Structure):
    _fields_ = [("left", c_long), ("top", c_long), ("right", c_long), ("bottom", c_long)]


class MouseInput(Structure):
    _fields_ = (
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouse_data", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("extra_info", wintypes.WPARAM),
    )


class KeyboardInput(Structure):
    _fields_ = (
        ("virtual_key", wintypes.WORD),
        ("scan_code", wintypes.WORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("extra_info", wintypes.WPARAM),
    )


class HardwareInput(Structure):
    _fields_ = (
        ("message", wintypes.DWORD),
        ("parameter_low", wintypes.WORD),
        ("parameter_high", wintypes.WORD),
    )


class InputValue(ctypes.Union):
    _fields_ = (
        ("mouse", MouseInput),
        ("keyboard", KeyboardInput),
        ("hardware", HardwareInput),
    )


class NativeInput(Structure):
    _anonymous_ = ("value",)
    _fields_ = (
        ("type", wintypes.DWORD),
        ("value", InputValue),
    )

class WindowOps:
    def __init__(self):
        self.user32 = ctypes.windll.user32
        self.kernel32 = ctypes.windll.kernel32
        self._setup_function_signatures()
        
        self.key_codes = {
            'A': 0x41, 'B': 0x42, 'C': 0x43, 'D': 0x44, 'E': 0x45, 'F': 0x46,
            'G': 0x47, 'H': 0x48, 'I': 0x49, 'J': 0x4A, 'K': 0x4B, 'L': 0x4C,
            'M': 0x4D, 'N': 0x4E, 'O': 0x4F, 'P': 0x50, 'Q': 0x51, 'R': 0x52,
            'S': 0x53, 'T': 0x54, 'U': 0x55, 'V': 0x56, 'W': 0x57, 'X': 0x58,
            'Y': 0x59, 'Z': 0x5A,
            '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
            '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
            'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74,
            'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79,
            'ESCAPE': 0x1B, 'ENTER': 0x0D, 'SPACE': 0x20, 'TAB': 0x09,
            'CTRL': 0x11, 'CONTROL': 0x11, 'SHIFT': 0x10, 'END': 0x23,
            'UP': 0x26, 'DOWN': 0x28, 'LEFT': 0x25, 'RIGHT': 0x27
        }
    
    def _setup_function_signatures(self):
        self.user32.FindWindowW.argtypes = [c_wchar_p, c_wchar_p]
        self.user32.FindWindowW.restype = HWND
        self.user32.GetWindowTextW.argtypes = [HWND, c_wchar_p, c_int]
        self.user32.GetWindowTextW.restype = c_int
        self.user32.GetWindowTextLengthW.argtypes = [HWND]
        self.user32.GetWindowTextLengthW.restype = c_int
        self.user32.ShowWindow.argtypes = [HWND, c_int]
        self.user32.ShowWindow.restype = BOOL
        self.user32.SetForegroundWindow.argtypes = [HWND]
        self.user32.SetForegroundWindow.restype = BOOL
        self.user32.BringWindowToTop.argtypes = [HWND]
        self.user32.BringWindowToTop.restype = BOOL
        self.user32.GetWindowLongW.argtypes = [HWND, c_int]
        self.user32.GetWindowLongW.restype = c_long
        self.user32.PostMessageW.argtypes = [HWND, c_uint, c_void_p, c_void_p]
        self.user32.PostMessageW.restype = BOOL
        self.user32.EnumWindows.argtypes = [WNDENUMPROC, LPARAM]
        self.user32.EnumWindows.restype = BOOL
        self.user32.GetWindowRect.argtypes = [HWND, POINTER(RECT)]
        self.user32.GetWindowRect.restype = BOOL
        self.user32.GetWindowThreadProcessId.argtypes = [HWND, POINTER(c_ulong)]
        self.user32.GetWindowThreadProcessId.restype = c_ulong
        self.user32.GetClassNameW.argtypes = [HWND, c_wchar_p, c_int]
        self.user32.GetClassNameW.restype = c_int
        self.user32.GetForegroundWindow.argtypes = []
        self.user32.GetForegroundWindow.restype = c_void_p
        self.user32.IsWindowVisible.argtypes = [HWND]
        self.user32.IsWindowVisible.restype = BOOL
        self.user32.IsIconic.argtypes = [HWND]
        self.user32.IsIconic.restype = BOOL
        self.user32.IsWindow.argtypes = [HWND]
        self.user32.IsWindow.restype = BOOL
        self.user32.AttachThreadInput.argtypes = [c_ulong, c_ulong, BOOL]
        self.user32.AttachThreadInput.restype = BOOL
        self.user32.keybd_event.argtypes = [c_ubyte, c_ubyte, c_ulong, c_void_p]
        self.user32.keybd_event.restype = None
        self.user32.MapVirtualKeyW.argtypes = [c_uint, c_uint]
        self.user32.MapVirtualKeyW.restype = c_uint
        self.kernel32.GetCurrentThreadId.argtypes = []
        self.kernel32.GetCurrentThreadId.restype = c_ulong
        self.user32.SetWindowPos.argtypes = [
            HWND,
            c_void_p,
            c_int,
            c_int,
            c_int,
            c_int,
            c_uint,
        ]
        self.user32.SetWindowPos.restype = BOOL
        self.user32.SetCursorPos.argtypes = [c_int, c_int]
        self.user32.SetCursorPos.restype = BOOL
        self.user32.SendInput.argtypes = [
            c_uint,
            POINTER(NativeInput),
            c_int,
        ]
        self.user32.SendInput.restype = c_uint
        self.user32.SystemParametersInfoW.argtypes = [
            c_uint,
            c_uint,
            c_void_p,
            c_uint,
        ]
        self.user32.SystemParametersInfoW.restype = BOOL
        self.user32.GetCursorPos.argtypes = [POINTER(POINT)]
        self.user32.GetCursorPos.restype = BOOL
        self.user32.ScreenToClient.argtypes = [HWND, POINTER(POINT)]
        self.user32.ScreenToClient.restype = BOOL
        self.kernel32.OpenProcess.argtypes = [c_ulong, c_bool, c_ulong]
        self.kernel32.OpenProcess.restype = c_void_p
        self.kernel32.QueryFullProcessImageNameW.argtypes = [
            c_void_p,
            c_ulong,
            c_wchar_p,
            POINTER(c_ulong),
        ]
        self.kernel32.QueryFullProcessImageNameW.restype = BOOL
        self.kernel32.CloseHandle.argtypes = [c_void_p]
        self.kernel32.CloseHandle.restype = BOOL
    
    def find_window(self, class_name: Optional[str] = None, window_title: Optional[str] = None) -> Optional[int]:
        hwnd = self.user32.FindWindowW(class_name, window_title)
        return hwnd if hwnd else None
    
    def get_window_text(self, hwnd: int) -> str:
        length = self.user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return ""
        buffer = ctypes.create_unicode_buffer(length + 1)
        self.user32.GetWindowTextW(hwnd, buffer, length + 1)
        return buffer.value
    
    def show_window(self, hwnd: int, show_cmd: int) -> bool:
        return self.user32.ShowWindow(hwnd, show_cmd)
    
    def set_foreground_window(self, hwnd: int) -> bool:
        return self.user32.SetForegroundWindow(hwnd)
    
    def send_key(self, hwnd: int, key_code: int, press: bool = True) -> bool:
        message = WM_KEYDOWN if press else WM_KEYUP
        return self.user32.PostMessageW(hwnd, message, key_code, 0)
    
    def post_message(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
        return self.user32.PostMessageW(hwnd, message, wparam, lparam)
    
    def close_window(self, hwnd: int) -> bool:
        return self.post_message(hwnd, WM_CLOSE)
    
    def minimize_window(self, hwnd: int) -> bool:
        return self.show_window(hwnd, SW_MINIMIZE)
    
    def maximize_window(self, hwnd: int) -> bool:
        return self.show_window(hwnd, SW_SHOWMAXIMIZED)
    
    def restore_window(self, hwnd: int) -> bool:
        return self.show_window(hwnd, SW_RESTORE)
    
    def hide_window(self, hwnd: int) -> bool:
        return self.show_window(hwnd, SW_HIDE)
    
    def get_window_rect(self, hwnd: int) -> Optional[Tuple[int, int, int, int]]:
        rect = RECT()
        if self.user32.GetWindowRect(hwnd, byref(rect)):
            return (rect.left, rect.top, rect.right, rect.bottom)
        return None
    
    def get_window_client_rect(self, hwnd: int) -> Optional[Tuple[int, int, int, int]]:
        rect = RECT()
        if self.user32.GetClientRect(hwnd, byref(rect)):
            point = POINT()
            self.user32.ClientToScreen(hwnd, byref(point))
            return (point.x, point.y, point.x + rect.right, point.y + rect.bottom)
        return None

    def is_cursor_in_window(self, hwnd: int) -> bool:
        """True if current cursor position (screen coords) is inside the window's client area."""
        point = POINT()
        if not self.user32.GetCursorPos(byref(point)):
            return False
        rect = self.get_window_client_rect(hwnd)
        if not rect:
            return False
        return self._point_in_rect(point, rect)

    def _point_in_rect(self, point: POINT, rect: Tuple[int, int, int, int]) -> bool:
        """True if point (screen coords) is inside rect (left, top, right, bottom) screen coords."""
        left, top, right, bottom = rect
        return left <= point.x < right and top <= point.y < bottom

    def is_cursor_in_rect(self, rect: Tuple[int, int, int, int]) -> bool:
        """True if current cursor position (screen coords) is inside rect (left, top, right, bottom)."""
        point = POINT()
        if not self.user32.GetCursorPos(byref(point)):
            return False
        return self._point_in_rect(point, rect)

    def send_mouse_click(self, hwnd: int, button: str = "left") -> bool:
        """Send one mouse click (down+up) to window at client-area center. button: 'left' or 'right'."""
        rect = self.get_window_client_rect(hwnd)
        if not rect:
            return False
        cx = (rect[2] - rect[0]) // 2
        cy = (rect[3] - rect[1]) // 2
        lparam = (cy << 16) | (cx & 0xFFFF)
        if button == "right":
            self.user32.PostMessageW(hwnd, WM_RBUTTONDOWN, MK_RBUTTON, lparam)
            time.sleep(0.02)
            self.user32.PostMessageW(hwnd, WM_RBUTTONUP, 0, lparam)
        else:
            self.user32.PostMessageW(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
            time.sleep(0.02)
            self.user32.PostMessageW(hwnd, WM_LBUTTONUP, 0, lparam)
        return True

    def send_mouse_click_at_cursor(self, hwnd: int, button: str = "left") -> bool:
        """Send one mouse click (down+up) at current cursor position in window client coords. button: 'left' or 'right'."""
        point = POINT()
        if not self.user32.GetCursorPos(byref(point)):
            return False
        if not self.user32.ScreenToClient(hwnd, byref(point)):
            return False
        lparam = (point.y << 16) | (point.x & 0xFFFF)
        if button == "right":
            self.user32.PostMessageW(hwnd, WM_RBUTTONDOWN, MK_RBUTTON, lparam)
            time.sleep(0.02)
            self.user32.PostMessageW(hwnd, WM_RBUTTONUP, 0, lparam)
        else:
            self.user32.PostMessageW(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
            time.sleep(0.02)
            self.user32.PostMessageW(hwnd, WM_LBUTTONUP, 0, lparam)
        return True
    
    def get_window_thread_process_id(self, hwnd: int) -> Optional[Tuple[int, int]]:
        process_id = c_ulong()
        thread_id = self.user32.GetWindowThreadProcessId(hwnd, byref(process_id))
        return (thread_id, process_id.value)

    def get_foreground_window(self) -> int:
        return int(self.user32.GetForegroundWindow() or 0)

    def restore_foreground_window(self, hwnd: int) -> bool:
        """Foreground-lock safe SetForegroundWindow: un-minimize, attach to the current foreground thread, tap ALT; True once hwnd is foreground."""
        if not self.user32.IsWindow(hwnd):
            return False
        if self.user32.IsIconic(hwnd):
            self.user32.ShowWindow(hwnd, SW_RESTORE)
        foreground = self.get_foreground_window()
        if foreground == hwnd:
            return True
        current_thread = int(self.kernel32.GetCurrentThreadId())
        foreground_thread = int(self.get_window_thread_process_id(foreground)[0]) if foreground else 0
        attached = bool(
            foreground_thread
            and foreground_thread != current_thread
            and self.user32.AttachThreadInput(current_thread, foreground_thread, True)
        )
        try:
            self.user32.keybd_event(VK_MENU, 0, 0, None)
            self.user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, None)
            self.user32.BringWindowToTop(hwnd)
            self.user32.SetForegroundWindow(hwnd)
        finally:
            if attached:
                self.user32.AttachThreadInput(current_thread, foreground_thread, False)
        return self.get_foreground_window() == hwnd

    def get_cursor_position(self) -> Optional[Tuple[int, int]]:
        point = POINT()
        if not self.user32.GetCursorPos(byref(point)):
            return None
        return (int(point.x), int(point.y))

    def set_cursor_position(self, x: int, y: int) -> bool:
        return bool(self.user32.SetCursorPos(int(x), int(y)))

    def get_window_class_name(self, hwnd: int) -> str:
        buffer = ctypes.create_unicode_buffer(256)
        length = self.user32.GetClassNameW(hwnd, buffer, len(buffer))
        return buffer.value if length > 0 else ""

    def get_window_process_name(self, process_id: int) -> str:
        if process_id <= 0:
            return ""
        handle = self.kernel32.OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION,
            False,
            process_id,
        )
        if not handle:
            return ""
        buffer = ctypes.create_unicode_buffer(PROCESS_PATH_BUFFER_LENGTH)
        size = c_ulong(PROCESS_PATH_BUFFER_LENGTH)
        resolved = self.kernel32.QueryFullProcessImageNameW(
            handle,
            0,
            buffer,
            byref(size),
        )
        self.kernel32.CloseHandle(handle)
        if not resolved:
            return ""
        return Path(buffer.value).name

    def show_window_without_activation(self, hwnd: int) -> bool:
        if self.user32.IsIconic(hwnd):
            self.user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)
        return True

    def is_window_topmost(self, hwnd: int) -> bool:
        extended_style = self.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        return bool(extended_style & WS_EX_TOPMOST)

    def set_window_topmost(self, hwnd: int, enabled: bool) -> bool:
        insert_after = HWND_TOPMOST if enabled else HWND_NOTOPMOST
        return bool(self.user32.SetWindowPos(
            hwnd,
            insert_after,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        ))

    def bring_window_to_top(self, hwnd: int) -> bool:
        topmost = self.set_window_topmost(hwnd, True)
        brought = bool(self.user32.BringWindowToTop(hwnd))
        foreground = self.set_foreground_window(hwnd)
        return topmost or brought or foreground

    def click_screen_point(self, x: int, y: int, button: str = "left") -> bool:
        if button not in ("left", "right"):
            return False
        if not self.user32.SetCursorPos(x, y):
            return False
        inputs = (NativeInput * 2)()
        inputs[0].type = INPUT_MOUSE
        inputs[1].type = INPUT_MOUSE
        if button == "right":
            inputs[0].mouse.flags = MOUSEEVENTF_RIGHTDOWN
            inputs[1].mouse.flags = MOUSEEVENTF_RIGHTUP
        else:
            inputs[0].mouse.flags = MOUSEEVENTF_LEFTDOWN
            inputs[1].mouse.flags = MOUSEEVENTF_LEFTUP
        sent = self.user32.SendInput(2, inputs, ctypes.sizeof(NativeInput))
        return sent == 2

    def get_wheel_scroll_lines(self) -> int:
        lines = c_uint()
        resolved = self.user32.SystemParametersInfoW(
            SPI_GETWHEELSCROLLLINES,
            0,
            byref(lines),
            0,
        )
        if not resolved:
            return 3
        if lines.value == WHEEL_PAGESCROLL:
            return -1
        return max(1, int(lines.value))

    def scroll_mouse_wheel(self, steps: int) -> bool:
        remaining = abs(int(steps))
        if remaining == 0:
            return False
        direction = 1 if steps > 0 else -1
        deltas = []
        while remaining > 0:
            chunk = min(remaining, MAX_WHEEL_STEPS_PER_INPUT)
            deltas.append(direction * chunk * WHEEL_DELTA)
            remaining -= chunk
        inputs = (NativeInput * len(deltas))()
        for index, delta in enumerate(deltas):
            inputs[index].type = INPUT_MOUSE
            inputs[index].mouse.mouse_data = delta & 0xFFFFFFFF
            inputs[index].mouse.flags = MOUSEEVENTF_WHEEL
        sent = self.user32.SendInput(
            len(inputs),
            inputs,
            ctypes.sizeof(NativeInput),
        )
        return sent == len(inputs)

    def press_native_key(self, key: Union[str, int]) -> bool:
        key_code = self.get_key_code(key)
        if not key_code:
            return False
        inputs = (NativeInput * 2)()
        inputs[0].type = INPUT_KEYBOARD
        inputs[0].keyboard.virtual_key = key_code
        inputs[1].type = INPUT_KEYBOARD
        inputs[1].keyboard.virtual_key = key_code
        inputs[1].keyboard.flags = KEYEVENTF_KEYUP
        sent = self.user32.SendInput(2, inputs, ctypes.sizeof(NativeInput))
        return sent == 2

    def press_native_key_combo(self, keys: List[Union[str, int]], hold_seconds: float = 0.0) -> bool:
        key_codes = [self.get_key_code(key) for key in keys]
        if not key_codes or any(not key_code for key_code in key_codes):
            return False
        presses = (NativeInput * len(key_codes))()
        releases = (NativeInput * len(key_codes))()
        for index, key_code in enumerate(key_codes):
            self._fill_key_input(presses[index], key_code, 0)
        for index, key_code in enumerate(reversed(key_codes)):
            self._fill_key_input(releases[index], key_code, KEYEVENTF_KEYUP)
        input_size = ctypes.sizeof(NativeInput)
        if hold_seconds <= 0:
            both = (NativeInput * (len(key_codes) * 2))(*presses, *releases)
            return self.user32.SendInput(len(both), both, input_size) == len(both)
        if self.user32.SendInput(len(presses), presses, input_size) != len(presses):
            return False
        time.sleep(hold_seconds)
        return self.user32.SendInput(len(releases), releases, input_size) == len(releases)

    def _fill_key_input(self, entry: NativeInput, key_code: int, flags: int) -> None:
        entry.type = INPUT_KEYBOARD
        entry.keyboard.virtual_key = key_code
        entry.keyboard.scan_code = int(self.user32.MapVirtualKeyW(key_code, MAPVK_VK_TO_VSC))
        entry.keyboard.flags = flags | (KEYEVENTF_EXTENDEDKEY if key_code in EXTENDED_VIRTUAL_KEYS else 0)

    def get_window_info(self, hwnd: int) -> Optional[Dict[str, Any]]:
        info = {
            "hwnd": hwnd,
            "title": self.get_window_text(hwnd),
            "rect": self.get_window_rect(hwnd)
        }
        process_info = self.get_window_thread_process_id(hwnd)
        if process_info:
            info["thread_id"] = process_info[0]
            info["process_id"] = process_info[1]
        return info
    
    def enum_windows(self) -> List[Tuple[int, str]]:
        windows = []
        def enum_proc(hwnd, lparam):
            if self.user32.IsWindowVisible(hwnd):
                title = self.get_window_text(hwnd)
                if title:
                    windows.append((hwnd, title))
            return True
        
        enum_func = WNDENUMPROC(enum_proc)
        self.user32.EnumWindows(enum_func, 0)
        return windows
    
    def _kill_process_by_pid(self, pid: int, window_title: str):
        """Kill process by PID using win32api (in-process)."""
        win32api = get_third_package_win32api()
        if win32api is None:
            ColorPrint.plain(f"[PROCESS] win32api not available, cannot kill PID {pid}")
            return
        try:
            handle = win32api.OpenProcess(PROCESS_TERMINATE, False, pid)
            win32api.TerminateProcess(handle, 0)
            win32api.CloseHandle(handle)
            ColorPrint.plain(f"[PROCESS] Killing duplicate process PID {pid}: {window_title}")
        except win32api.error as e:
            ColorPrint.plain(f"[PROCESS] Failed to kill PID {pid}: {e}")

    def find_windows_by_title(self, title_pattern: str) -> List[Tuple[int, str]]:
        all_windows = self.enum_windows()
        matched_windows = []
        for hwnd, title in all_windows:
            if title_pattern.lower() in title.lower():
                matched_windows.append((hwnd, title))
        
        # If multiple windows found, keep only the last one and kill others
        if len(matched_windows) > 1:
            target_window = matched_windows[-1]  # Use the last one
            
            # Kill other processes in background threads
            for hwnd, window_title in matched_windows[:-1]:
                _, pid = self.get_window_thread_process_id(hwnd)
                self._kill_process_by_pid(pid, window_title)
            
            return [target_window]
        
        return matched_windows
    
    def get_key_code(self, key: Union[str, int]) -> int:
        if isinstance(key, int):
            # Handle integer digit keys (0-9)
            if 0 <= key <= 9:
                return 0x30 + key  # Convert to proper virtual key code
            return key  # For other integers, assume they are already virtual key codes
        key_upper = str(key).upper()
        if key_upper in self.key_codes:
            return self.key_codes[key_upper]
        if len(key_upper) == 1:
            return ord(key_upper)
        return 0
    
    def activate_and_send_key(self, titles: Union[str, List[str]], key: Union[str, int],random_interval: float = 0.0) -> bool:
        if isinstance(titles, str):
            titles = [titles]
        if random_interval > 0:
            printText = " for " + str(random_interval) + " seconds"
        else:
            printText = ""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        key_code = self.get_key_code(key)
        if not key_code:
            ColorPrint.update_line(f"[{timestamp}] Invalid key: {key}", ColorPrint.RED)
            return False
        
        all_windows = []
        for title in titles:
            windows = self.find_windows_by_title(title)
            all_windows.extend(windows)
        
        total_windows = len(all_windows)
        if total_windows == 0:
            ColorPrint.update_line(f"[{timestamp}] No windows found for key '{key}'", ColorPrint.RED)
            return False
        
        success_count = 0
        for i, (hwnd, window_title) in enumerate(all_windows, 1):
            ColorPrint.update_line(f"[{timestamp}] Sending key '{key}' to window {i}/{total_windows}: {window_title} {printText}", ColorPrint.YELLOW)
            
            if self.send_key(hwnd, key_code, press=True):
                time.sleep(0.01)
                self.send_key(hwnd, key_code, press=False)
                success_count += 1
        
        # Final result
        if success_count > 0:
            ColorPrint.update_line(f"[{timestamp}] Successfully sent key '{key}' to {success_count}/{total_windows} windows {printText}", ColorPrint.GREEN)
        else:
            ColorPrint.update_line(f"[{timestamp}] Failed to send key '{key}' to all windows", ColorPrint.RED)
            
        return success_count > 0

    def focus_and_send_key(self, hwnd: int, key: Union[str, int], press_count: int = 1, interval: float = 0.1) -> bool:
        if not self.set_foreground_window(hwnd):
            return False
            
        time.sleep(0.1)
        key_code = self.get_key_code(key)
        if not key_code:
            return False
            
        for i in range(press_count):
            if self.send_key(hwnd, key_code, press=True):
                time.sleep(0.01)
                self.send_key(hwnd, key_code, press=False)
                if i < press_count - 1:
                    time.sleep(interval)
            else:
                return False
            
        return True

_window_ops = WindowOps()

def find_window(class_name: Optional[str] = None, window_title: Optional[str] = None) -> Optional[int]:
    return _window_ops.find_window(class_name, window_title)

def get_window_text(hwnd: int) -> str:
    return _window_ops.get_window_text(hwnd)

def show_window(hwnd: int, show_cmd: int) -> bool:
    return _window_ops.show_window(hwnd, show_cmd)

def set_foreground_window(hwnd: int) -> bool:
    return _window_ops.set_foreground_window(hwnd)

def send_key(hwnd: int, key_code: int, press: bool = True) -> bool:
    return _window_ops.send_key(hwnd, key_code, press)

def close_window(hwnd: int) -> bool:
    return _window_ops.close_window(hwnd)

def minimize_window(hwnd: int) -> bool:
    return _window_ops.minimize_window(hwnd)

def maximize_window(hwnd: int) -> bool:
    return _window_ops.maximize_window(hwnd)

def restore_window(hwnd: int) -> bool:
    return _window_ops.restore_window(hwnd)

def hide_window(hwnd: int) -> bool:
    return _window_ops.hide_window(hwnd)

def get_window_rect(hwnd: int) -> Optional[Tuple[int, int, int, int]]:
    return _window_ops.get_window_rect(hwnd)

def get_window_thread_process_id(hwnd: int) -> Optional[Tuple[int, int]]:
    return _window_ops.get_window_thread_process_id(hwnd)

def get_foreground_window() -> int:
    return _window_ops.get_foreground_window()

def restore_foreground_window(hwnd: int) -> bool:
    return _window_ops.restore_foreground_window(hwnd)

def get_cursor_position() -> Optional[Tuple[int, int]]:
    return _window_ops.get_cursor_position()

def set_cursor_position(x: int, y: int) -> bool:
    return _window_ops.set_cursor_position(x, y)

def get_window_class_name(hwnd: int) -> str:
    return _window_ops.get_window_class_name(hwnd)

def get_window_process_name(process_id: int) -> str:
    return _window_ops.get_window_process_name(process_id)

def show_window_without_activation(hwnd: int) -> bool:
    return _window_ops.show_window_without_activation(hwnd)

def is_window_topmost(hwnd: int) -> bool:
    return _window_ops.is_window_topmost(hwnd)

def set_window_topmost(hwnd: int, enabled: bool) -> bool:
    return _window_ops.set_window_topmost(hwnd, enabled)

def bring_window_to_top(hwnd: int) -> bool:
    return _window_ops.bring_window_to_top(hwnd)

def click_screen_point(x: int, y: int, button: str = "left") -> bool:
    return _window_ops.click_screen_point(x, y, button)

def get_wheel_scroll_lines() -> int:
    return _window_ops.get_wheel_scroll_lines()

def scroll_mouse_wheel(steps: int) -> bool:
    return _window_ops.scroll_mouse_wheel(steps)

def press_native_key(key: Union[str, int]) -> bool:
    return _window_ops.press_native_key(key)

def press_native_key_combo(keys: List[Union[str, int]], hold_seconds: float = 0.0) -> bool:
    return _window_ops.press_native_key_combo(keys, hold_seconds)

def post_window_message(hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
    return bool(_window_ops.post_message(hwnd, message, wparam, lparam))

def get_window_client_rect(hwnd: int) -> Optional[Tuple[int, int, int, int]]:
    return _window_ops.get_window_client_rect(hwnd)

def get_window_info(hwnd: int) -> Optional[Dict[str, Any]]:
    return _window_ops.get_window_info(hwnd)

def enum_windows() -> List[Tuple[int, str]]:
    return _window_ops.enum_windows()

def find_windows_by_title(title_pattern: str) -> List[Tuple[int, str]]:
    return _window_ops.find_windows_by_title(title_pattern)

def activate_and_send_key(titles: Union[str, List[str]], key: Union[str, int],random_interval: float = 0.0) -> bool:
    return _window_ops.activate_and_send_key(titles, key,random_interval)

def focus_and_send_key(hwnd: int, key: Union[str, int], press_count: int = 1, interval: float = 0.1) -> bool:
    return _window_ops.focus_and_send_key(hwnd, key, press_count, interval)

def send_mouse_click(hwnd: int, button: str = "left") -> bool:
    """Send one mouse click to window at client-area center. button: 'left' or 'right'."""
    return _window_ops.send_mouse_click(hwnd, button)


def send_mouse_click_at_cursor(hwnd: int, button: str = "left") -> bool:
    """Send one mouse click at current cursor position (in window client coords). button: 'left' or 'right'."""
    return _window_ops.send_mouse_click_at_cursor(hwnd, button)


def is_cursor_in_window(hwnd: int) -> bool:
    """True if current cursor is inside the window's client area."""
    return _window_ops.is_cursor_in_window(hwnd)


def is_cursor_in_rect(rect: Tuple[int, int, int, int]) -> bool:
    """True if current cursor (screen coords) is inside rect (left, top, right, bottom)."""
    return _window_ops.is_cursor_in_rect(rect) 
