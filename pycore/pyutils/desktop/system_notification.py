# -*- coding: utf-8 -*-
"""Cross-platform system notification entry point (shared library).

One call surfaces a notification in the OS notification area (bottom-right on
Windows and most Linux desktops); every pycore notification goes through here.

- Linux/BSD: the freedesktop ``org.freedesktop.Notifications.Notify`` D-Bus
  call through ``gdbus`` (GLib, present on every GTK/GNOME/Xfce desktop; tray
  indicators via AppIndicator/Ayatana SNI cannot display bubbles themselves),
  then ``notify-send`` (libnotify-bin, often not installed), then the tkinter
  toast stack.
- Windows: the THREAD_BUS ``tray.show_notification`` event, handled by the
  owning tray backend (Qt ``QSystemTrayIcon.showMessage`` or the Win32
  ``Shell_NotifyIcon`` NIF_INFO balloon — rendered as a toast by the shell on
  Windows 10+). Falls back to the tkinter toast stack when no native tray
  backend is enabled.
- Anything else / any failure: tkinter toast stack, else silently skipped.

Click-to-copy (``copy_text``): Linux sends the freedesktop "default" action and
copies on its ``ActionInvoked`` signal (one shared ``gdbus monitor`` thread);
Windows tray backends copy on a balloon click (Win32 ``NIN_BALLOONUSERCLICK``,
Qt ``messageClicked``) through :func:`copy_notification_text`.

Never raises; safe to call from any thread.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
from typing import Dict, Optional

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

TRAY_SHOW_NOTIFICATION_EVENT = "tray.show_notification"
FDO_NOTIFY_DEST = "org.freedesktop.Notifications"
FDO_NOTIFY_PATH = "/org/freedesktop/Notifications"
FDO_NOTIFY_METHOD = "org.freedesktop.Notifications.Notify"
FDO_ACTION_DEFAULT = "default"
NOTIFY_APP_NAME = "pycore"
NOTIFY_REPLY_TIMEOUT_SECONDS = 5
COPY_REGISTRY_CAP = 64

_MESSAGE_CAP = 240
_NOTIFY_ID_RE = re.compile(r"\(uint32 (\d+),?\)")
_ACTION_RE = re.compile(r"ActionInvoked \(uint32 (\d+), '([^']*)'\)")
_CLOSED_RE = re.compile(r"NotificationClosed \(uint32 (\d+),")
_copy_lock = threading.Lock()
_copy_by_id: Dict[int, str] = {}
_monitor_started = False


def copy_notification_text(text: str) -> bool:
    """Copy a clicked notification's payload (shared by every tray backend)."""
    if not text:
        return False
    from pycore.pyutils.common.clipboard_text import set_clipboard_text
    return set_clipboard_text(text)


def _action_monitor(binary: str) -> None:
    """Copy on ActionInvoked for ids registered by _gdbus_notify_with_copy."""
    try:
        proc = subprocess.Popen(
            [binary, "monitor", "--session", "--dest", FDO_NOTIFY_DEST, "--object-path", FDO_NOTIFY_PATH],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
    except OSError:
        return
    for line in proc.stdout or []:
        match = _ACTION_RE.search(line)
        if match:
            with _copy_lock:
                text = _copy_by_id.pop(int(match.group(1)), "")
            if text:
                copy_notification_text(text)
            continue
        match = _CLOSED_RE.search(line)
        if match:
            with _copy_lock:
                _copy_by_id.pop(int(match.group(1)), None)


def _ensure_action_monitor(binary: str) -> None:
    global _monitor_started
    with _copy_lock:
        if _monitor_started:
            return
        _monitor_started = True
    threading.Thread(target=_action_monitor, args=(binary,), name="NotifyActionMonitor", daemon=True).start()


def _copy_action_label() -> str:
    from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
    from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
    return i18n.get(I18nKeys.TOAST_ACTION_COPY).replace("'", "")


def _gdbus_notify_with_copy(binary: str, title: str, message: str, duration_ms: int, copy_text: str) -> None:
    """Notify with a "default" (click) action, then remember id -> copy_text."""
    try:
        out = subprocess.run(
            [
                binary, "call", "--session",
                "--dest", FDO_NOTIFY_DEST,
                "--object-path", FDO_NOTIFY_PATH,
                "--method", FDO_NOTIFY_METHOD,
                NOTIFY_APP_NAME, "0", "", title, message,
                f"['{FDO_ACTION_DEFAULT}', '{_copy_action_label()}']", "{}",
                str(max(1000, int(duration_ms))),
            ],
            capture_output=True, text=True, timeout=NOTIFY_REPLY_TIMEOUT_SECONDS,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return
    match = _NOTIFY_ID_RE.search(out or "")
    if not match:
        return
    with _copy_lock:
        _copy_by_id[int(match.group(1))] = copy_text
        while len(_copy_by_id) > COPY_REGISTRY_CAP:
            _copy_by_id.pop(next(iter(_copy_by_id)))


def _display_available() -> bool:
    return has_graphical_display()


def _gdbus_notify(title: str, message: str, duration_ms: int, copy_text: Optional[str] = None) -> bool:
    """freedesktop Notify over the session bus via gdbus (no libnotify needed)."""
    binary = shutil.which("gdbus")
    if not binary or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        return False
    if copy_text:
        _ensure_action_monitor(binary)
        threading.Thread(
            target=_gdbus_notify_with_copy,
            args=(binary, title, message, duration_ms, copy_text),
            name="NotifyWithCopy", daemon=True,
        ).start()
        return True
    try:
        subprocess.Popen(
            [
                binary, "call", "--session",
                "--dest", FDO_NOTIFY_DEST,
                "--object-path", FDO_NOTIFY_PATH,
                "--method", FDO_NOTIFY_METHOD,
                NOTIFY_APP_NAME, "0", "", title, message, "[]", "{}",
                str(max(1000, int(duration_ms))),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except OSError:
        return False


def _notify_send(title: str, message: str, duration_ms: int) -> bool:
    """freedesktop notification via the libnotify CLI. Linux/Unix only."""
    binary = shutil.which("notify-send")
    if not binary:
        return False
    try:
        subprocess.Popen(
            [binary, "-a", NOTIFY_APP_NAME, "-t", str(max(1000, int(duration_ms))), title, message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except OSError:
        return False


def show_system_notification(
    title: str,
    message: str,
    duration_ms: int = 5000,
    copy_text: Optional[str] = None,
) -> bool:
    """Pop a desktop/tray notification; returns True when some surface accepted it."""
    title = str(title or "").strip() or "pycore"
    message = str(message or "").strip()
    if len(message) > _MESSAGE_CAP:
        message = message[:_MESSAGE_CAP].rstrip() + "..."
    if not message:
        return False
    if not _display_available():
        return False

    if sys.platform == "win32":
        # The owning tray backend (Qt or Win32) listens for this event and shows
        # the balloon/toast on its own thread. When no native tray backend runs,
        # fall back to the tkinter toast stack.
        try:
            from pycore.pyutils.common.service_config import qt_tray_enabled
            if qt_tray_enabled():
                THREAD_BUS.trigger_event(
                    TRAY_SHOW_NOTIFICATION_EVENT,
                    {
                        "title": title,
                        "message": message,
                        "duration_ms": int(duration_ms),
                        "copy_text": copy_text or "",
                    },
                    async_mode=True,
                )
                return True
        except Exception:
            pass
        return _toast_fallback(title, message, duration_ms, copy_text)

    if _gdbus_notify(title, message, duration_ms, copy_text) or _notify_send(title, message, duration_ms):
        return True
    return _toast_fallback(title, message, duration_ms, copy_text)


def _toast_fallback(title: str, message: str, duration_ms: int, copy_text: Optional[str]) -> bool:
    try:
        from pycore.pyutils.desktop.toast_stack import show_desktop_toast
        return show_desktop_toast(title=title, message=message, copy_text=copy_text, duration_ms=duration_ms)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemNotification] fallback toast failed: {exc}")
        return False


__all__ = ["copy_notification_text", "show_system_notification", "TRAY_SHOW_NOTIFICATION_EVENT"]
