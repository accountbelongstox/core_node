#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import ctypes
import ctypes.wintypes
import time
import subprocess
import sys
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any, Union
from pathlib import Path
from ctypes import windll, byref, c_int, c_uint, c_char_p, c_wchar_p, c_void_p, c_long, c_ulong, c_bool, Structure, POINTER

from pycore.pyfoundations.third_party import get_third_package_win32gui, get_third_package_win32con, get_third_package_win32api

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
win32api = get_third_package_win32api()
import win32process
import win32clipboard
from pycore.pyfoundations.color_print import ColorPrint

SW_HIDE = 0
SW_SHOWNORMAL = 1
SW_SHOWMINIMIZED = 2
SW_SHOWMAXIMIZED = 3
SW_SHOW = 5
SW_MINIMIZE = 6
SW_RESTORE = 9

WM_CLOSE = 0x0010
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205

class POINT(Structure):
    _fields_ = [("x", c_long), ("y", c_long)]

class RECT(Structure):
    _fields_ = [("left", c_long), ("top", c_long), ("right", c_long), ("bottom", c_long)]

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
            'UP': 0x26, 'DOWN': 0x28, 'LEFT': 0x25, 'RIGHT': 0x27
        }
    
    def _setup_function_signatures(self):
        self.user32.FindWindowW.argtypes = [c_wchar_p, c_wchar_p]
        self.user32.FindWindowW.restype = c_void_p
        self.user32.GetWindowTextW.argtypes = [c_void_p, c_wchar_p, c_int]
        self.user32.GetWindowTextW.restype = c_int
        self.user32.GetWindowTextLengthW.argtypes = [c_void_p]
        self.user32.GetWindowTextLengthW.restype = c_int
        self.user32.ShowWindow.argtypes = [c_void_p, c_int]
        self.user32.ShowWindow.restype = c_bool
        self.user32.SetForegroundWindow.argtypes = [c_void_p]
        self.user32.SetForegroundWindow.restype = c_bool
        self.user32.PostMessageW.argtypes = [c_void_p, c_uint, c_void_p, c_void_p]
        self.user32.PostMessageW.restype = c_bool
        self.user32.EnumWindows.argtypes = [ctypes.WINFUNCTYPE(c_bool, c_void_p, c_void_p), c_void_p]
        self.user32.EnumWindows.restype = c_bool
        self.user32.GetWindowRect.argtypes = [c_void_p, POINTER(RECT)]
        self.user32.GetWindowRect.restype = c_bool
        self.user32.GetWindowThreadProcessId.argtypes = [c_void_p, POINTER(c_ulong)]
        self.user32.GetWindowThreadProcessId.restype = c_ulong
    
    def find_window(self, class_name: Optional[str] = None, window_title: Optional[str] = None) -> Optional[int]:
        try:
            hwnd = self.user32.FindWindowW(class_name, window_title)
            return hwnd if hwnd else None
        except:
            return None
    
    def get_window_text(self, hwnd: int) -> str:
        try:
            length = self.user32.GetWindowTextLengthW(hwnd)
            if length == 0:
                return ""
            buffer = ctypes.create_unicode_buffer(length + 1)
            self.user32.GetWindowTextW(hwnd, buffer, length + 1)
            return buffer.value
        except:
            return ""
    
    def show_window(self, hwnd: int, show_cmd: int) -> bool:
        try:
            return self.user32.ShowWindow(hwnd, show_cmd)
        except:
            return False
    
    def set_foreground_window(self, hwnd: int) -> bool:
        try:
            return self.user32.SetForegroundWindow(hwnd)
        except:
            return False
    
    def send_key(self, hwnd: int, key_code: int, press: bool = True) -> bool:
        try:
            message = WM_KEYDOWN if press else WM_KEYUP
            return self.user32.PostMessageW(hwnd, message, key_code, 0)
        except:
            return False
    
    def post_message(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
        try:
            return self.user32.PostMessageW(hwnd, message, wparam, lparam)
        except:
            return False
    
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
        try:
            rect = RECT()
            if self.user32.GetWindowRect(hwnd, byref(rect)):
                return (rect.left, rect.top, rect.right, rect.bottom)
            return None
        except:
            return None
    
    def get_window_client_rect(self, hwnd: int) -> Optional[Tuple[int, int, int, int]]:
        try:
            rect = RECT()
            if self.user32.GetClientRect(hwnd, byref(rect)):
                point = POINT()
                self.user32.ClientToScreen(hwnd, byref(point))
                return (point.x, point.y, point.x + rect.right, point.y + rect.bottom)
            return None
        except:
            return None
    
    def get_window_thread_process_id(self, hwnd: int) -> Optional[Tuple[int, int]]:
        try:
            process_id = c_ulong()
            thread_id = self.user32.GetWindowThreadProcessId(hwnd, byref(process_id))
            return (thread_id, process_id.value)
        except:
            return None
    
    def get_window_info(self, hwnd: int) -> Optional[Dict[str, Any]]:
        try:
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
        except:
            return None
    
    def enum_windows(self) -> List[Tuple[int, str]]:
        windows = []
        def enum_proc(hwnd, lparam):
            if self.user32.IsWindowVisible(hwnd):
                title = self.get_window_text(hwnd)
                if title:
                    windows.append((hwnd, title))
            return True
        
        try:
            enum_func = ctypes.WINFUNCTYPE(c_bool, c_void_p, c_void_p)(enum_proc)
            self.user32.EnumWindows(enum_func, 0)
            return windows
        except:
            return []
    
    def _kill_process_by_pid(self, pid: int, window_title: str):
        """Kill process by PID using non-blocking subprocess"""
        try:
            subprocess.Popen(['taskkill', '/PID', str(pid), '/F'], 
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"[PROCESS] Killing duplicate process PID {pid}: {window_title}")
        except Exception as e:
            print(f"[PROCESS] Failed to kill PID {pid}: {e}")

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
                try:
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    self._kill_process_by_pid(pid, window_title)
                except Exception as e:
                    print(f"[PROCESS] Failed to get PID for window {window_title}: {e}")
            
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
            
            try:
                if self.send_key(hwnd, key_code, press=True):
                    time.sleep(0.01)
                    self.send_key(hwnd, key_code, press=False)
                    success_count += 1
            except Exception as e:
                ColorPrint.update_line(f"[{timestamp}] Error on window {i}: {e}", ColorPrint.RED)
                time.sleep(0.1)  # Brief pause to show error
        
        # Final result
        if success_count > 0:
            ColorPrint.update_line(f"[{timestamp}] Successfully sent key '{key}' to {success_count}/{total_windows} windows {printText}", ColorPrint.GREEN)
        else:
            ColorPrint.update_line(f"[{timestamp}] Failed to send key '{key}' to all windows", ColorPrint.RED)
            
        return success_count > 0

    def focus_and_send_key(self, hwnd: int, key: Union[str, int], press_count: int = 1, interval: float = 0.1) -> bool:
        try:
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
        except:
            return False

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