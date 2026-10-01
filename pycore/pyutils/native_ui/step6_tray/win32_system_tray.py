#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Native Windows tray icon (pywin32 Shell_NotifyIcon) with its own message loop.

Contract shared with TkinterSystemTray: __init__(app_name, icon_path, menu_items,
trigger_shutdown_on_exit), run() (blocking), stop() and update_menu(items)
(thread-safe). Menu clicks emit the item's action_signal via THREAD_BUS.
"""

import hashlib
import json
import os
import sys
import ctypes
import ctypes.wintypes as wintypes
import time
import threading
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_win32api,
    get_third_package_win32con,
    get_third_package_win32gui,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step1_config.tray_config import TRAY_EVENT_SOURCE, TrayMenuItem
from pycore.pyutils.native_ui.step11_desktop.system_notification import copy_notification_text

WM_USER = 0x0400
ICON_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48)]
BALLOON_TITLE_CAP = 63
BALLOON_MESSAGE_CAP = 255
BALLOON_MIN_MS = 1000
BALLOON_MAX_MS = 30000
BALLOON_DEFAULT_MS = 5000


def win32_available() -> bool:
    """pywin32 win32gui/win32con/win32api are importable (resolved on first call)."""
    return (
        get_third_package_win32gui() is not None
        and get_third_package_win32con() is not None
        and get_third_package_win32api() is not None
    )


if sys.platform == "win32":
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
WM_TRAYICON = WM_USER + 20
WM_SHOW_BALLOON = WM_USER + 21
# Shell callback event for a click on our balloon (legacy callback mode: lParam).
NIN_BALLOONUSERCLICK = WM_USER + 5
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
        if not win32_available():
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
        self._last_right_click_started_at = None
        self._balloon_signal = f"native_ui.win32_tray.balloon.{id(self)}"
        self._balloon_copy_text = ""

    @staticmethod
    def _tray_timing_log(node, timing):
        """Log a tray-to-window timing node without changing dispatch behavior."""
        if not isinstance(timing, dict):
            ColorPrint.blue(f"[TrayTiming] {node} wall={time.strftime('%Y-%m-%d %H:%M:%S')} ")
            return
        started_at = timing.get("started_at")
        elapsed_ms = (time.perf_counter() - started_at) * 1000 if started_at else 0.0
        ColorPrint.blue(
            f"[TrayTiming] id={timing.get('trace_id', '?')} {node} "
            f"wall={time.strftime('%Y-%m-%d %H:%M:%S')} elapsed={elapsed_ms:.3f}ms"
        )

    @staticmethod
    def _decode_signed_short(value):
        if value > 0x7FFF:
            return value - 0x10000
        return value

    @staticmethod
    def _clamp_rect_to_screen(x, y, width=1, height=1):
        win32con = get_third_package_win32con()
        win32api = get_third_package_win32api()
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

    def _resolve_menu_position(self, msg, wparam, lparam):
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
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
        except win32gui.error as exc:
            ColorPrint.yellow(f"[Win32Tray] GetCursorPos failed: {exc}")
            return (0, 0)
        return self._clamp_rect_to_screen(cursor_pos[0], cursor_pos[1])

    def _get_tray_icon_rect(self):
        if not _HAS_NOTIFYICON_GET_RECT or not self.hwnd:
            return None
        identifier = _NotifyIconIdentifier()
        identifier.cbSize = ctypes.sizeof(_NotifyIconIdentifier)
        identifier.hWnd = wintypes.HWND(self.hwnd)
        identifier.uID = 0
        identifier.guidItem = (wintypes.BYTE * 16)()
        rect = _Rect()
        try:
            result = _notify_icon_get_rect(ctypes.byref(identifier), ctypes.byref(rect))
        except OSError as exc:
            ColorPrint.yellow(f"[Win32Tray] Shell_NotifyIconGetRect failed hwnd={self.hwnd}: {exc}")
            return None
        if result != 0:
            return None
        return rect.left, rect.top, rect.right, rect.bottom

    # ---------- icon ----------

    def _load_icon(self):
        """Load an HICON from .ico directly, or convert a PNG via Pillow; else stock app icon."""
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        p = self.icon_path
        ico_path = None
        if p and Path(p).exists():
            ico_path = str(p) if str(p).lower().endswith(".ico") else self._raster_to_ico(p)
        if ico_path:
            try:
                return win32gui.LoadImage(
                    0, ico_path, win32con.IMAGE_ICON, 0, 0,
                    win32con.LR_LOADFROMFILE | win32con.LR_DEFAULTSIZE,
                )
            except win32gui.error as exc:
                ColorPrint.yellow(f"[Win32Tray] Failed to load icon {ico_path}: {exc}")
        # Stock application icon guarantees a visible tray icon
        return win32gui.LoadIcon(0, win32con.IDI_APPLICATION)

    @staticmethod
    def _raster_to_ico(img_path) -> Optional[str]:
        """Convert a PNG/raster image to a cached multi-size .ico; return its path or None."""
        image_module = get_third_package_PIL_Image()
        if image_module is None:
            ColorPrint.yellow("[Win32Tray] Pillow unavailable, cannot convert PNG icon")
            return None
        try:
            mtime = os.path.getmtime(img_path)
            key = hashlib.md5(f"{img_path}:{mtime}".encode("utf-8")).hexdigest()[:12]
            ico_path = str(TMP_DIR / f"pycore_tray_{key}.ico")
            if not os.path.exists(ico_path):
                img = image_module.open(img_path).convert("RGBA")
                img.save(ico_path, format="ICO", sizes=ICON_SIZES)
        except OSError as exc:
            ColorPrint.yellow(f"[Win32Tray] PNG->ICO conversion failed path={img_path}: {exc}")
            return None
        return ico_path

    # ---------- window ----------

    def _create_window(self):
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        win32api = get_third_package_win32api()
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
        win32gui = get_third_package_win32gui()
        self._hicon = self._load_icon()
        flags = win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP
        nid = (self.hwnd, 0, flags, WM_TRAYICON, self._hicon, self.app_name)
        win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)

    def _remove_icon(self):
        win32gui = get_third_package_win32gui()
        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (self.hwnd, 0))
        except win32gui.error as exc:
            ColorPrint.yellow(f"[Win32Tray] NIM_DELETE failed hwnd={self.hwnd}: {exc}")

    # ---------- menu ----------

    def _build_menu(self):
        """Build a fresh Win32 popup menu from current items; map command ids -> signals."""
        win32gui = get_third_package_win32gui()
        hmenu = win32gui.CreatePopupMenu()
        self._id_to_signal = {}
        self._default_signal = None
        self._append_items(hmenu, self.menu_items, _MENU_ID_BASE)
        return hmenu

    def _append_items(self, hmenu, items, next_id):
        """Append items (recursing into submenus via MF_POPUP); return the next free command id."""
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        for item in items:
            if item.is_separator():
                win32gui.AppendMenu(hmenu, win32con.MF_SEPARATOR, 0, "")
                continue

            text = item.get_display_text()
            flags = win32con.MF_STRING
            if not item.is_enabled():
                flags |= win32con.MF_GRAYED

            submenu_items = item.submenu
            if submenu_items:
                sub_hmenu = win32gui.CreatePopupMenu()
                next_id = self._append_items(sub_hmenu, submenu_items, next_id)
                # DestroyMenu on the root destroys attached submenus recursively
                win32gui.AppendMenu(hmenu, flags | win32con.MF_POPUP, sub_hmenu, text)
                continue

            cmd_id = next_id
            next_id += 1
            win32gui.AppendMenu(hmenu, flags, cmd_id, text)

            signal = item.action_signal
            if signal:
                self._id_to_signal[cmd_id] = signal
                if item.default:
                    self._default_signal = signal
        return next_id

    def _show_menu(self, msg=None, wparam=None, lparam=None):
        """Display the current menu and dispatch the selected command.

        ``TPM_RETURNCMD`` avoids relying on shell-specific ``WM_COMMAND``
        routing.  Explorer may deliver either ``WM_RBUTTONUP`` or
        ``WM_CONTEXTMENU`` for a notification icon, so both are handled by
        ``_wnd_proc`` below.
        """
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        now = time.monotonic()
        if now - self._last_show_menu_at < self._show_menu_guard_seconds:
            return
        self._last_show_menu_at = now

        hmenu = self._build_menu()
        try:
            ColorPrint.blue("[Win32Tray] Right click detected. Opening tray context menu.")
            pos = self._resolve_menu_position(msg, wparam, lparam)
            if not isinstance(pos, tuple) or len(pos) < 2:
                pos = (0, 0)
            ColorPrint.blue(f"[Win32Tray] Tray menu anchor point: ({pos[0]}, {pos[1]})")
            try:
                win32gui.SetForegroundWindow(self.hwnd)  # required for dismissal
            except win32gui.error as exc:
                ColorPrint.yellow(f"[Win32Tray] SetForegroundWindow failed hwnd={self.hwnd}: {exc}")
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
                started_at = self._last_right_click_started_at or time.perf_counter()
                timing = {
                    "trace_id": f"{threading.get_ident()}-{time.time_ns()}",
                    "started_at": started_at,
                }
                self._tray_timing_log("menu_selected", timing)
                ColorPrint.blue(f"[Win32Tray] Tray menu selected: {signal}")
                ColorPrint.blue(f"[Win32Tray] Menu item -> signal: {signal}")
                THREAD_BUS.trigger_event(signal, {"signal": signal, "source": TRAY_EVENT_SOURCE, "_tray_timing": timing})
                self._tray_timing_log("thread_bus_trigger_returned", timing)
            win32gui.PostMessage(self.hwnd, win32con.WM_NULL, 0, 0)
        finally:
            win32gui.DestroyMenu(hmenu)
            self._last_right_click_started_at = None

    # ---------- window proc ----------

    def _wnd_proc(self, hwnd, msg, wparam, lparam):
        win32gui = get_third_package_win32gui()
        win32con = get_third_package_win32con()
        context_message = getattr(win32con, "WM_CONTEXTMENU", 0x007B)

        if msg == context_message:
            self._last_right_click_started_at = time.perf_counter()
            ColorPrint.blue(
                f"[TrayTiming] right_click_received wall={time.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            self._show_menu(context_message, wparam, lparam)
            return 0

        if msg == WM_TRAYICON:
            if lparam == NIN_BALLOONUSERCLICK:
                copy_text = self._balloon_copy_text
                self._balloon_copy_text = ""
                if copy_text:
                    copy_notification_text(copy_text)
                return 0
            if lparam in (win32con.WM_RBUTTONUP, context_message):
                if self._last_right_click_started_at is None:
                    self._last_right_click_started_at = time.perf_counter()
                    ColorPrint.blue(
                        f"[TrayTiming] right_click_received wall={time.strftime('%Y-%m-%d %H:%M:%S')}"
                    )
                self._show_menu(msg, wparam, lparam)
            elif lparam in (win32con.WM_LBUTTONUP, win32con.WM_LBUTTONDBLCLK):
                if self._default_signal:
                    timing = {
                        "trace_id": f"{threading.get_ident()}-{time.time_ns()}",
                        "started_at": time.perf_counter(),
                    }
                    self._tray_timing_log("left_click_received", timing)
                    THREAD_BUS.trigger_event(
                        self._default_signal,
                        {"signal": self._default_signal, "_tray_timing": timing},
                    )
                    self._tray_timing_log("thread_bus_trigger_returned", timing)
            return 0

        if msg == WM_SHOW_BALLOON:
            self._drain_balloon_queue()
            return 0

        if msg == win32con.WM_COMMAND:
            cmd_id = wparam & 0xFFFF
            signal = self._id_to_signal.get(cmd_id)
            if signal:
                ColorPrint.blue(f"[Win32Tray] Menu item -> signal: {signal}")
                THREAD_BUS.trigger_event(signal, {"signal": signal, "source": TRAY_EVENT_SOURCE})
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

    # ---------- balloon notification ----------

    def request_balloon(self, title: str, message: str, duration_ms: int = 5000, copy_text: str = ""):
        """Thread-safe entry: queue a balloon and marshal to the tray thread.

        Shell_NotifyIcon NIF_INFO balloon on the owned icon (legacy but still
        rendered by the shell as a toast on Windows 10+). One balloon at a time
        per taskbar — newer requests replace the queued one.
        """
        THREAD_BUS.signal(self._balloon_signal, {
            "title": str(title or self.app_name)[:BALLOON_TITLE_CAP],
            "message": str(message or "")[:BALLOON_MESSAGE_CAP],
            "duration_ms": max(BALLOON_MIN_MS, min(int(duration_ms or BALLOON_DEFAULT_MS), BALLOON_MAX_MS)),
            "copy_text": str(copy_text or ""),
        })
        self._post(WM_SHOW_BALLOON)

    def _post(self, message):
        win32gui = get_third_package_win32gui()
        if not self.hwnd:
            return
        try:
            win32gui.PostMessage(self.hwnd, message, 0, 0)
        except win32gui.error as exc:
            ColorPrint.yellow(f"[Win32Tray] PostMessage failed hwnd={self.hwnd} msg={message}: {exc}")

    def _drain_balloon_queue(self):
        win32gui = get_third_package_win32gui()
        pending = THREAD_BUS.get_signal(self._balloon_signal)
        THREAD_BUS.clear_signal(self._balloon_signal)
        if not pending or not self.hwnd:
            return
        # One balloon at a time per taskbar: the shown one owns the click payload.
        self._balloon_copy_text = pending.get("copy_text") or ""
        try:
            flags = win32gui.NIF_INFO
            nid = (
                self.hwnd, 0, flags, 0, 0, "",
                pending["message"], pending["duration_ms"], pending["title"],
                win32gui.NIIF_INFO,
            )
            win32gui.Shell_NotifyIcon(win32gui.NIM_MODIFY, nid)
        except win32gui.error as exc:
            ColorPrint.yellow(f"[Win32Tray] Balloon failed title={pending['title']!r}: {exc}")

    # ---------- THREAD_BUS ----------

    def _register_thread_bus_handlers(self):
        def handle_stop(event_data):
            ColorPrint.blue("[Win32Tray] Received stop request via THREAD_BUS")
            self.stop()

        def handle_update(event_data):
            items = event_data.get("menu_items")
            if items is not None:
                self.update_menu(items)

        def handle_notification(event_data):
            if not isinstance(event_data, dict):
                return
            self.request_balloon(
                event_data.get("title") or self.app_name,
                event_data.get("message") or "",
                event_data.get("duration_ms") or BALLOON_DEFAULT_MS,
                event_data.get("copy_text") or "",
            )

        THREAD_BUS.register_event_handler("tray.request_stop", handle_stop, priority=10)
        THREAD_BUS.register_event_handler("tray.update_menu", handle_update, priority=10)
        THREAD_BUS.register_event_handler(BusSignals.TRAY_SHOW_NOTIFICATION, handle_notification, priority=10)
        ColorPrint.blue("[Win32Tray] THREAD_BUS event handlers registered")

        latest_menu_payload = THREAD_BUS.get_signal(BusSignals.TRAY_MENU_PAYLOAD)
        if isinstance(latest_menu_payload, dict):
            handle_update(latest_menu_payload)

    # ---------- lifecycle ----------

    def run(self):
        """Create the icon and pump messages (blocks until stop())."""
        win32gui = get_third_package_win32gui()
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
        except win32gui.error as exc:
            ColorPrint.yellow(f"[Win32Tray] UnregisterClass failed: {exc}")
        ColorPrint.blue("[Win32Tray] Native system tray stopped")
        THREAD_BUS.signal("Win32Tray_stopped", {"app_name": self.app_name})

    def stop(self):
        """Stop the tray. Thread-safe: PostMessage marshals to the tray thread."""
        win32con = get_third_package_win32con()
        if not THREAD_BUS.get_signal(self._running_signal, False):
            return
        ColorPrint.blue("[Win32Tray] Stopping native system tray...")
        self._post(win32con.WM_CLOSE)
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
            data = {"text": item.text, "action_signal": item.action_signal, "default": bool(item.default)}
            if item.submenu:
                data["submenu"] = [normalize_item(sub_item) for sub_item in item.submenu]
            if item.checked is not None:
                data["checked"] = item.checked
            if item.enabled_getter is None:
                data["enabled"] = bool(item.enabled)
            return data

        normalized = {
            "items": [normalize_item(menu_item) for menu_item in menu_items],
            "codesync": THREAD_BUS.get_signal(BusSignals.TRAY_CODESYNC_STATE, {}),
            "language": i18n.get_current_language(),
            "voice_subtitle_visible": THREAD_BUS.get_signal(
                BusSignals.VOICE_SUBTITLE_UI_WINDOW_VISIBLE, False
            ),
        }

        payload = json.dumps(normalized, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
        return hashlib.md5(payload).hexdigest()


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
        if not win32_available():
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
