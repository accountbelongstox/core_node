# -*- coding: utf-8 -*-
"""Cross-platform system notification entry point (shared library).

One call surfaces a notification on the user's desktop:

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

Never raises; safe to call from any thread.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Optional

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

TRAY_SHOW_NOTIFICATION_EVENT = "tray.show_notification"
FDO_NOTIFY_DEST = "org.freedesktop.Notifications"
FDO_NOTIFY_PATH = "/org/freedesktop/Notifications"
FDO_NOTIFY_METHOD = "org.freedesktop.Notifications.Notify"
NOTIFY_APP_NAME = "pycore"

_MESSAGE_CAP = 240


def _display_available() -> bool:
    return has_graphical_display()


def _gdbus_notify(title: str, message: str, duration_ms: int) -> bool:
    """freedesktop Notify over the session bus via gdbus (no libnotify needed)."""
    binary = shutil.which("gdbus")
    if not binary or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        return False
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
            from pycore.pyutils.common.service_config import UI_ENABLE_TRAY
            if UI_ENABLE_TRAY:
                THREAD_BUS.trigger_event(
                    TRAY_SHOW_NOTIFICATION_EVENT,
                    {"title": title, "message": message, "duration_ms": int(duration_ms)},
                    async_mode=True,
                )
                return True
        except Exception:
            pass
        return _toast_fallback(title, message, duration_ms, copy_text)

    if _gdbus_notify(title, message, duration_ms) or _notify_send(title, message, duration_ms):
        return True
    return _toast_fallback(title, message, duration_ms, copy_text)


def _toast_fallback(title: str, message: str, duration_ms: int, copy_text: Optional[str]) -> bool:
    try:
        from pycore.pyutils.desktop.toast_stack import show_desktop_toast
        return show_desktop_toast(title=title, message=message, copy_text=copy_text, duration_ms=duration_ms)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[SystemNotification] fallback toast failed: {exc}")
        return False


__all__ = ["show_system_notification", "TRAY_SHOW_NOTIFICATION_EVENT"]
