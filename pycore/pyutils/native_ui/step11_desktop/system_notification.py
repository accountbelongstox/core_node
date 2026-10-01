# -*- coding: utf-8 -*-
"""Cross-platform system notification entry point.

- Linux/BSD: freedesktop ``Notify`` over D-Bus via ``gdbus``, then
  ``notify-send``, then the tkinter toast stack.
- Windows: the THREAD_BUS ``tray.show_notification`` event handled by the
  owning tray backend; the toast stack when no native tray backend runs.

Click-to-copy (``copy_text``): Linux sends the freedesktop "default" action and
copies on ``ActionInvoked`` (one shared ``gdbus monitor`` thread); Windows tray
backends copy on a balloon click through :func:`copy_notification_text`.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
from collections import OrderedDict
from typing import Optional

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue, init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.clipboard_text import set_clipboard_text
from pycore.pyutils.common.service_config import UI_ENABLE_TRAY
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n
from pycore.pyutils.native_ui.step11_desktop.toast_stack import desktop_toast_stack

FDO_NOTIFY_DEST = "org.freedesktop.Notifications"
FDO_NOTIFY_PATH = "/org/freedesktop/Notifications"
FDO_NOTIFY_METHOD = "org.freedesktop.Notifications.Notify"
FDO_ACTION_DEFAULT = "default"
NOTIFY_APP_NAME = "pycore"
NOTIFY_REPLY_TIMEOUT_SECONDS = 5
NOTIFY_MIN_DURATION_MS = 1000
COPY_REGISTRY_CAP = 64
MESSAGE_CAP = 240

_NOTIFY_ID_RE = re.compile(r"\(uint32 (\d+),?\)")
_ACTION_RE = re.compile(r"ActionInvoked \(uint32 (\d+), '([^']*)'\)")
_CLOSED_RE = re.compile(r"NotificationClosed \(uint32 (\d+),")


def copy_notification_text(text: str) -> bool:
    """Copy a clicked notification's payload (shared by every tray backend)."""
    if not text:
        return False
    return set_clipboard_text(text)


class NotificationCopyRegistry:
    """Bounded notification id -> copy text map owned by one THREAD_BUS worker."""

    def __init__(self) -> None:
        self.entries: OrderedDict = OrderedDict()
        self.monitor_started = SerializedValue(False, name="NotifyActionMonitorStarted")
        init_serialized_owner(self, "native_ui.notification_copy", "NotificationCopyRegistry")

    @serialized_method
    def store(self, notify_id: int, text: str) -> None:
        self.entries[notify_id] = text
        while len(self.entries) > COPY_REGISTRY_CAP:
            self.entries.popitem(last=False)

    @serialized_method
    def pop(self, notify_id: int) -> str:
        return self.entries.pop(notify_id, "")


notification_copy_registry = NotificationCopyRegistry()


def _notify_argv(binary: str, title: str, message: str, actions: str, duration_ms: int) -> list:
    return [
        binary, "call", "--session",
        "--dest", FDO_NOTIFY_DEST,
        "--object-path", FDO_NOTIFY_PATH,
        "--method", FDO_NOTIFY_METHOD,
        NOTIFY_APP_NAME, "0", "", title, message, actions, "{}",
        str(max(NOTIFY_MIN_DURATION_MS, int(duration_ms))),
    ]


class NotifyActionMonitorThread(threading.Thread):
    """Copy on ActionInvoked for ids registered by NotifyWithCopyThread."""

    def __init__(self, binary: str) -> None:
        super().__init__(name="NotifyActionMonitorThread", daemon=True)
        self.binary = binary

    def run(self) -> None:
        argv = [self.binary, "monitor", "--session", "--dest", FDO_NOTIFY_DEST, "--object-path", FDO_NOTIFY_PATH]
        try:
            proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        except OSError as exc:
            ColorPrint.yellow(f"[SystemNotification] gdbus monitor failed argv={argv}: {exc}")
            return
        for line in proc.stdout or []:
            match = _ACTION_RE.search(line)
            if match:
                copy_notification_text(notification_copy_registry.pop(int(match.group(1))))
                continue
            match = _CLOSED_RE.search(line)
            if match:
                notification_copy_registry.pop(int(match.group(1)))


class NotifyWithCopyThread(threading.Thread):
    """Notify with a "default" (click) action, then remember id -> copy_text."""

    def __init__(self, binary: str, title: str, message: str, duration_ms: int, copy_text: str) -> None:
        super().__init__(name="NotifyWithCopyThread", daemon=True)
        self.binary = binary
        self.title = title
        self.message = message
        self.duration_ms = duration_ms
        self.copy_text = copy_text

    def run(self) -> None:
        label = i18n.get(I18nKeys.TOAST_ACTION_COPY).replace("'", "")
        argv = _notify_argv(self.binary, self.title, self.message, f"['{FDO_ACTION_DEFAULT}', '{label}']", self.duration_ms)
        try:
            out = subprocess.run(argv, capture_output=True, text=True, timeout=NOTIFY_REPLY_TIMEOUT_SECONDS).stdout
        except (OSError, subprocess.SubprocessError) as exc:
            ColorPrint.yellow(f"[SystemNotification] gdbus notify failed title={self.title!r}: {exc}")
            return
        match = _NOTIFY_ID_RE.search(out or "")
        if match:
            notification_copy_registry.store(int(match.group(1)), self.copy_text)


def _spawn(argv: list) -> bool:
    try:
        subprocess.Popen(argv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as exc:
        ColorPrint.yellow(f"[SystemNotification] spawn failed argv0={argv[0]}: {exc}")
        return False
    return True


def _gdbus_notify(title: str, message: str, duration_ms: int, copy_text: Optional[str]) -> bool:
    """freedesktop Notify over the session bus via gdbus (no libnotify needed)."""
    binary = shutil.which("gdbus")
    if not binary or not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
        return False
    if not copy_text:
        return _spawn(_notify_argv(binary, title, message, "[]", duration_ms))
    if notification_copy_registry.monitor_started.compare_and_set(False, True):
        NotifyActionMonitorThread(binary).start()
    NotifyWithCopyThread(binary, title, message, duration_ms, copy_text).start()
    return True


def _notify_send(title: str, message: str, duration_ms: int) -> bool:
    """freedesktop notification via the libnotify CLI."""
    binary = shutil.which("notify-send")
    if not binary:
        return False
    return _spawn([binary, "-a", NOTIFY_APP_NAME, "-t", str(max(NOTIFY_MIN_DURATION_MS, int(duration_ms))), title, message])


def show_system_notification(
    title: str,
    message: str,
    duration_ms: int = 5000,
    copy_text: Optional[str] = None,
) -> bool:
    """Pop a desktop/tray notification; True when some surface accepted it."""
    title = str(title or "").strip() or NOTIFY_APP_NAME
    message = str(message or "").strip()
    if len(message) > MESSAGE_CAP:
        message = message[:MESSAGE_CAP].rstrip() + "..."
    if not message or not has_graphical_display():
        return False

    if sys.platform == "win32":
        if UI_ENABLE_TRAY:
            THREAD_BUS.trigger_event(
                BusSignals.TRAY_SHOW_NOTIFICATION,
                {"title": title, "message": message, "duration_ms": int(duration_ms), "copy_text": copy_text or ""},
                async_mode=True,
            )
            return True
        return desktop_toast_stack.show(title, message, copy_text, duration_ms)

    if _gdbus_notify(title, message, duration_ms, copy_text) or _notify_send(title, message, duration_ms):
        return True
    return desktop_toast_stack.show(title, message, copy_text, duration_ms)
