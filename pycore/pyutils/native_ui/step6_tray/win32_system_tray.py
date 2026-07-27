#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import win32gui
import win32con
import win32api
from PIL import Image
from pycore.pyutils.native_ui.step0_i18n import i18n
"""
Windows Native System Tray (pywin32 / Shell_NotifyIcon)

A TRUE OS-native tray icon for Windows using ONLY pywin32 (no third-party tray
library such as pystray). It runs an independent Win32 message loop in its own
thread, fully decoupled from PySide6/Qt and Tkinter.

Why this exists: the user wants a native (非第三方) tray that is built before /
independently of PySide6. pystray is kept as a fallback backend (code-only).

Contract (mirrors TkinterSystemTray so start_tray can swap backends):
    __init__(app_name, icon_path, menu_items, trigger_shutdown_on_exit)
    run()                 # blocking message loop (call inside a thread)
    stop()                # thread-safe (PostMessage)
    update_menu(items)    # thread-safe (menu rebuilt on next right-click)

Menu items are TrayMenuItem (text / action_signal / enabled / state_getter;
separator via text == "---"); clicking an item triggers its action_signal via
THREAD_BUS. Also listens to THREAD_BUS 'tray.request_stop' / 'tray.update_menu'.
"""

import hashlib
import json
import os
import ctypes
import ctypes.wintypes as wintypes
import tempfile
import time
import sys
import threading
from pathlib import Path
from typing import List, Optional

from pycore import THREAD_BUS, ColorPrint

# Reuse the canonical tray menu item dataclass (same one build_tray_menu produces)
from .tkinter_system_tray import TrayMenuItem

try:
    WIN32_AVAILABLE = True
except ImportError:
    win32gui = None
    win32con = None
    win32api = None
    WIN32_AVAILABLE = False

# Optional third-party (PNG -> ICO conversion only): top-of-file try + flag
try:
    PIL_AVAILABLE = True
except ImportError:
    Image = None
    PIL_AVAILABLE = False

if WIN32_AVAILABLE:
    class _NotifyIconIdentifier(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("hWnd", wintypes.HWND),
            ("uID", wintypes.UINT),
            ("guidItem", wintypes.BYTE * 16),
        ]

    class _Rect(ctypes.Structure):
        _fields_ = [
            ("left", wintypes.LONG),
            ("top", wintypes.LONG),
            ("right", wintypes.LONG),
            ("bottom", wintypes.LONG),
        ]

    _shell32 = ctypes.windll.shell32
    _notify_icon_get_rect = _shell32.Shell_NotifyIconGetRect
    _notify_icon_get_rect.argtypes = [ctypes.POINTER(_NotifyIconIdentifier), ctypes.POINTER(_Rect)]
    _notify_icon_get_rect.restype = ctypes.HRESULT
    _HAS_NOTIFYICON_GET_RECT = True
else:
    _notify_icon_get_rect = None
    _NotifyIconIdentifier = None
    _Rect = None
    _HAS_NOTIFYICON_GET_RECT = False

# Tray notification callback message id (icon -> our window)
WM_TRAYICON = (win32con.WM_USER + 20) if WIN32_AVAILABLE else 0
_MENU_ID_BASE = 1024


class Win32SystemTray:
    """Native Windows tray icon via Shell_NotifyIcon (pywin32 only)."""

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        menu_items: Optional[List[TrayMenuItem]] = None,
        trigger_shutdown_on_exit: bool = True,
    ):
        if not WIN32_AVAILABLE:
            raise ImportError("pywin32 (win32gui) is not available")

        self.app_name = app_name
        self.icon_path = icon_path
        self.menu_items = menu_items or []
        self.trigger_shutdown_on_exit = trigger_shutdown_on_exit

        self.hwnd = None
        self._hicon = None
        self._menu_signature = {'value': None}
        self._running_signal = f"native_ui.win32_tray.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)
        self._id_to_signal = {}     # menu command id -> action_signal
        self._default_signal = None  # left-click default action
        self._taskbar_created_msg = None
        self._last_show_menu_at = 0.0
        self._show_menu_guard_seconds = 0.18

    @staticmethod
    def _decode_signed_short(value):
        if value > 0x7FFF:
            return value - 0x10000
        return value

    @staticmethod
    def _clamp_rect_to_screen(x, y, width=1, height=1):
        try:
            screen_left = win32api.GetSystemMetrics(win32con.SM_XVIRTUALSCREEN)
            screen_top = win32api.GetSystemMetrics(win32con.SM_YVIRTUALSCREEN)
            screen_width = win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN)
            screen_height = win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN)
            if screen_width <= 0 or screen_height <= 0:
                return (x, y)
            width = max(width, 1)
            height = max(height, 1)
            x = max(screen_left, min(x, screen_left + screen_width - width))
            y = max(screen_top, min(y, screen_top + screen_height - height))
            return (int(x), int(y))
        except Exception:
            return (x, y)

    @staticmethod
    def _decode_lparam_point(lparam):
        if not isinstance(lparam, int):
            return None
        x = Win32SystemTray._decode_signed_short(lparam & 0xFFFF)
        y = Win32SystemTray._decode_signed_short((lparam >> 16) & 0xFFFF)
        if x == -1 and y == -1:
            return None
        return x, y

    @staticmethod
    def _is_non_zero_point(point):
        if not point:
            return False
        return point[0] != 0 or point[1] != 0

    @staticmethod
    def _log_to_cmd(message, level='info'):
        try:
            stream = sys.stdout
            print(f"[Win32Tray] {message}", file=stream, flush=True)
        except Exception:
            pass

    def _resolve_menu_position(self, msg, wparam, lparam):
        if msg == getattr(win32con, "WM_CONTEXTMENU", 0x007B):
            point = self._decode_lparam_point(lparam)
            if self._is_non_zero_point(point):
                return self._clamp_rect_to_screen(point[0], point[1])

        tray_rect = self._get_tray_icon_rect()
        if tray_rect:
            left, top, right, bottom = tray_rect
            center_x = int((left + right) / 2)
            center_y = int((top + bottom) / 2)
            return self._clamp_rect_to_screen(
                center_x,
                center_y,
                width=max(right - left, 1),
                height=max(bottom - top, 1),
            )
        try:
            cursor_pos = win32gui.GetCursorPos()
            return self._clamp_rect_to_screen(cursor_pos[0], cursor_pos[1])
        except Exception:
            return (0, 0)

    def _get_tray_icon_rect(self):
        if not _HAS_NOTIFYICON_GET_RECT or not self.hwnd:
            return None
        try:
            identifier = _NotifyIconIdentifier()
            identifier.cbSize = ctypes.sizeof(_NotifyIconIdentifier)
            identifier.hWnd = wintypes.HWND(self.hwnd)
            identifier.uID = 0
            identifier.guidItem = (wintypes.BYTE * 16)()
            rect = _Rect()
            result = _notify_icon_get_rect(ctypes.byref(identifier), ctypes.byref(rect))
            if result != 0:
                return None
            return rect.left, rect.top, rect.right, rect.bottom
        except Exception:
            return None

    # ---------- icon ----------

    def _load_icon(self):
        """Load an HICON from .ico directly, or convert a PNG via Pillow; else stock app icon."""
        try:
            p = self.icon_path
            if p and Path(p).exists():
                if str(p).lower().endswith(".ico"):
                    return win32gui.LoadImage(
                        0, str(p), win32con.IMAGE_ICON, 0, 0,
                        win32con.LR_LOADFROMFILE | win32con.LR_DEFAULTSIZE,
                    )
                # PNG (or other Pillow-readable raster): convert to a cached .ico
                ico_path = self._raster_to_ico(p)
                if ico_path:
                    return win32gui.LoadImage(
                        0, ico_path, win32con.IMAGE_ICON, 0, 0,
                        win32con.LR_LOADFROMFILE | win32con.LR_DEFAULTSIZE,
                    )
        except Exception as e:
            ColorPrint.yellow(f"[Win32Tray] Failed to load icon {self.icon_path}: {e}")
        # Stock application icon guarantees a visible tray icon
        return win32gui.LoadIcon(0, win32con.IDI_APPLICATION)

    @staticmethod
    def _raster_to_ico(img_path) -> Optional[str]:
        """Convert a PNG/raster image to a cached multi-size .ico; return its path or None."""
        if not PIL_AVAILABLE:
            ColorPrint.yellow("[Win32Tray] Pillow unavailable, cannot convert PNG icon")
            return None
        try:
            mtime = os.path.getmtime(img_path)
            key = hashlib.md5(f"{img_path}:{mtime}".encode("utf-8")).hexdigest()[:12]
            ico_path = os.path.join(tempfile.gettempdir(), f"pycore_tray_{key}.ico")
            if not os.path.exists(ico_path):
                img = Image.open(img_path).convert("RGBA")
                img.save(ico_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48)])
            return ico_path
        except Exception as e:
            ColorPrint.yellow(f"[Win32Tray] PNG->ICO conversion failed: {e}")
            return None

    # ---------- window ----------

    def _create_window(self):
        self._hinst = win32api.GetModuleHandle(None)
        wc = win32gui.WNDCLASS()
        wc.hInstance = self._hinst
        wc.lpszClassName = f"PycoreTrayWnd_{id(self)}"
        wc.lpfnWndProc = self._wnd_proc
        self._class_atom = win32gui.RegisterClass(wc)
        self.hwnd = win32gui.CreateWindow(
            self._class_atom, self.app_name, win32con.WS_OVERLAPPED,
            0, 0, win32con.CW_USEDEFAULT, win32con.CW_USEDEFAULT,
            0, 0, self._hinst, None,
        )
        win32gui.UpdateWindow(self.hwnd)

    def _add_icon(self):
        self._hicon = self._load_icon()
        flags = win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP
        nid = (self.hwnd, 0, flags, WM_TRAYICON, self._hicon, self.app_name)
        win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)

    def _remove_icon(self):
        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (self.hwnd, 0))
        except Exception:
            pass

    # ---------- menu ----------

    def _build_menu(self):
        """Build a fresh Win32 popup menu from current items; map command ids -> signals."""
        hmenu = win32gui.CreatePopupMenu()
        self._id_to_signal = {}
        self._default_signal = None
        self._append_items(hmenu, self.menu_items, _MENU_ID_BASE)
        return hmenu

    def _append_items(self, hmenu, items, next_id):
        """Append items (recursing into submenus via MF_POPUP); return the next free command id."""
        for item in items:
            if getattr(item, "text", None) == "---":
                win32gui.AppendMenu(hmenu, win32con.MF_SEPARATOR, 0, "")
                continue

            text = item.get_display_text()
            flags = win32con.MF_STRING
            if not item.is_enabled():
                flags |= win32con.MF_GRAYED

            submenu_items = getattr(item, "submenu", None)
            if submenu_items:
                sub_hmenu = win32gui.CreatePopupMenu()
                next_id = self._append_items(sub_hmenu, submenu_items, next_id)
                # DestroyMenu on the root destroys attached submenus recursively
                win32gui.AppendMenu(hmenu, flags | win32con.MF_POPUP, sub_hmenu, text)
                continue

            cmd_id = next_id
            next_id += 1
            win32gui.AppendMenu(hmenu, flags, cmd_id, text)

            signal = getattr(item, "action_signal", "") or ""
            if signal:
                self._id_to_signal[cmd_id] = signal
                if getattr(item, "default", False):
                    self._default_signal = signal
        return next_id

    def _show_menu(self, msg=None, wparam=None, lparam=None):
        """Display the current menu and dispatch the selected command.

        ``TPM_RETURNCMD`` avoids relying on shell-specific ``WM_COMMAND``
        routing.  Explorer may deliver either ``WM_RBUTTONUP`` or
        ``WM_CONTEXTMENU`` for a notification icon, so both are handled by
        ``_wnd_proc`` below.
        """
        now = time.monotonic()
        if now - self._last_show_menu_at < self._show_menu_guard_seconds:
            return
        self._last_show_menu_at = now

        hmenu = self._build_menu()
        try:
            self._log_to_cmd("Right click detected. Opening tray context menu.")
            pos = self._resolve_menu_position(msg, wparam, lparam)
            if not isinstance(pos, tuple) or len(pos) < 2:
                pos = (0, 0)
            self._log_to_cmd(f"Tray menu anchor point: ({pos[0]}, {pos[1]})")
            try:
                win32gui.SetForegroundWindow(self.hwnd)  # required for dismissal
            except Exception:
                pass
            command_id = win32gui.TrackPopupMenu(
                hmenu,
                win32con.TPM_LEFTALIGN
                | win32con.TPM_RIGHTBUTTON
                | getattr(win32con, "TPM_RETURNCMD", 0x0100),
                pos[0],
                pos[1],
                0,
                self.hwnd,
                None,
            )
            signal = self._id_to_signal.get(command_id)
            if signal:
                self._log_to_cmd(f"Tray menu selected: {signal}")
                ColorPrint.blue(f"[Win32Tray] Menu item -> signal: {signal}")
                THREAD_BUS.trigger_event(signal, {"signal": signal})
            win32gui.PostMessage(self.hwnd, win32con.WM_NULL, 0, 0)
        finally:
            win32gui.DestroyMenu(hmenu)

    # ---------- window proc ----------

    def _wnd_proc(self, hwnd, msg, wparam, lparam):
        context_message = getattr(win32con, "WM_CONTEXTMENU", 0x007B)

        if msg == context_message:
            self._show_menu(context_message, wparam, lparam)
            return 0

        if msg == WM_TRAYICON:
            if lparam in (win32con.WM_RBUTTONUP, context_message):
                self._show_menu(msg, wparam, lparam)
            elif lparam in (win32con.WM_LBUTTONUP, win32con.WM_LBUTTONDBLCLK):
                if self._default_signal:
                    THREAD_BUS.trigger_event(self._default_signal, {"signal": self._default_signal})
            return 0

        if msg == win32con.WM_COMMAND:
            cmd_id = wparam & 0xFFFF
            signal = self._id_to_signal.get(cmd_id)
            if signal:
                ColorPrint.blue(f"[Win32Tray] Menu item -> signal: {signal}")
                THREAD_BUS.trigger_event(signal, {"signal": signal})
            return 0

        if msg == win32con.WM_CLOSE:
            self._remove_icon()
            win32gui.DestroyWindow(hwnd)
            return 0

        if msg == win32con.WM_DESTROY:
            win32gui.PostQuitMessage(0)
            return 0

        if self._taskbar_created_msg and msg == self._taskbar_created_msg:
            # Explorer restarted -> re-add the icon
            self._add_icon()
            return 0

        return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)

    # ---------- THREAD_BUS ----------

    def _register_thread_bus_handlers(self):
        def handle_stop(event_data):
            ColorPrint.blue("[Win32Tray] Received stop request via THREAD_BUS")
            self.stop()

        def handle_update(event_data):
            items = event_data.get("menu_items")
            if items is not None:
                signature = self._menu_signature_value(items)
                if signature == self._menu_signature.get('value'):
                    return
                self._menu_signature['value'] = signature
                self.menu_items = items  # rebuilt on next right-click (GUI-thread safe)
                ColorPrint.blue("[Win32Tray] Menu updated")

        THREAD_BUS.register_event_handler("tray.request_stop", handle_stop, priority=10)
        THREAD_BUS.register_event_handler("tray.update_menu", handle_update, priority=10)
        ColorPrint.blue("[Win32Tray] THREAD_BUS event handlers registered")

        latest_menu_payload = THREAD_BUS.get_signal("tray.menu.payload")
        if isinstance(latest_menu_payload, dict):
            handle_update(latest_menu_payload)

    # ---------- lifecycle ----------

    def run(self):
        """Create the icon and pump messages (blocks until stop())."""
        if THREAD_BUS.get_signal(self._running_signal, False):
            return
        ColorPrint.blue(f"[Win32Tray] Starting native system tray: {self.app_name}")
        self._taskbar_created_msg = win32gui.RegisterWindowMessage("TaskbarCreated")
        self._create_window()
        self._add_icon()
        self._register_thread_bus_handlers()
        THREAD_BUS.signal(self._running_signal, True)
        THREAD_BUS.signal("Win32Tray_ready", {"app_name": self.app_name})
        ColorPrint.green(f"[Win32Tray] Tray icon ready: {self.app_name}")

        win32gui.PumpMessages()  # blocks until WM_QUIT (PostQuitMessage)

        THREAD_BUS.signal(self._running_signal, False)
        try:
            win32gui.UnregisterClass(self._class_atom, self._hinst)
        except Exception:
            pass
        ColorPrint.blue("[Win32Tray] Native system tray stopped")
        THREAD_BUS.signal("Win32Tray_stopped", {"app_name": self.app_name})

    def stop(self):
        """Stop the tray. Thread-safe: PostMessage marshals to the tray thread."""
        if not THREAD_BUS.get_signal(self._running_signal, False):
            return
        ColorPrint.blue("[Win32Tray] Stopping native system tray...")
        try:
            if self.hwnd:
                win32gui.PostMessage(self.hwnd, win32con.WM_CLOSE, 0, 0)
        except Exception:
            pass
        if self.trigger_shutdown_on_exit and not THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow("[Win32Tray] Triggering global shutdown...")
            THREAD_BUS.request_shutdown(reason="System tray closed", execute_handlers=True)

    def update_menu(self, menu_items: List[TrayMenuItem]):
        """Replace menu items; the menu is rebuilt lazily on next right-click."""
        signature = self._menu_signature_value(menu_items)
        if signature == self._menu_signature.get('value'):
            return
        self._menu_signature['value'] = signature
        self.menu_items = menu_items

    @staticmethod
    def _menu_signature_value(menu_items: List[TrayMenuItem]) -> str:
        """Stable signature for tray menu payloads (object/list payload)."""

        def normalize_item(item):
            children = getattr(item, "submenu", None)
            data = {
                "text": getattr(item, "text", None),
                "action_signal": getattr(item, "action_signal", ""),
                "default": bool(getattr(item, "default", False)),
            }
            if children:
                data["submenu"] = [normalize_item(sub_item) for sub_item in children]
            checked = getattr(item, "checked", None)
            if checked is not None:
                data["checked"] = checked
            if getattr(item, "enabled_getter", None) is None:
                data["enabled"] = bool(getattr(item, "enabled", True))
            return data

        normalized = {
            "items": [normalize_item(menu_item) for menu_item in menu_items],
            "codesync": THREAD_BUS.get_signal("tray.codesync.state", {}),
            "language": i18n.get_current_language(),
            "voice_subtitle_visible": THREAD_BUS.get_signal(
                "voice_subtitle_ui.window_visible", False
            ),
        }

        try:
            payload = json.dumps(
                normalized, sort_keys=True, ensure_ascii=False, default=str
            ).encode("utf-8")
            return hashlib.md5(payload).hexdigest()
        except Exception:
            return hashlib.md5(str(menu_items).encode("utf-8")).hexdigest()


class Win32SystemTrayThread(threading.Thread):
    """Thread wrapper for Win32SystemTray (project threading standard: own thread + THREAD_BUS)."""

    def __init__(
        self,
        app_name: str = "Application",
        icon_path: Optional[str] = None,
        menu_items: Optional[List[TrayMenuItem]] = None,
        trigger_shutdown_on_exit: bool = True,
        daemon: bool = True,
    ):
        super().__init__(name="Win32SystemTrayThread", daemon=daemon)
        self._config_queue = f"native_ui.win32_tray.config.{id(self)}"
        THREAD_BUS.send_message(self._config_queue, {
            "app_name": app_name,
            "icon_path": icon_path,
            "menu_items": list(menu_items or []),
            "trigger_shutdown_on_exit": bool(trigger_shutdown_on_exit),
        })
        ColorPrint.blue(f"[Win32SystemTrayThread] Initialized - App: {app_name}")

    def run(self):
        if not WIN32_AVAILABLE:
            ColorPrint.red("[Win32SystemTrayThread] pywin32 not available, cannot start")
            return
        ColorPrint.green("[Win32SystemTrayThread] Starting tray...")
        config = THREAD_BUS.receive_message(self._config_queue) or {}
        tray = Win32SystemTray(
            app_name=config.get("app_name", "Application"),
            icon_path=config.get("icon_path"),
            menu_items=config.get("menu_items"),
            trigger_shutdown_on_exit=bool(config.get("trigger_shutdown_on_exit", True)),
        )
        THREAD_BUS.trigger_event("tray.thread.started", {
            "app_name": config.get("app_name", "Application"),
            "backend": "win32",
        })
        ColorPrint.green("[Win32SystemTrayThread] Tray running...")
        tray.run()
        THREAD_BUS.trigger_event("tray.thread.stopped", {})
        ColorPrint.yellow("[Win32SystemTrayThread] Stopped")
