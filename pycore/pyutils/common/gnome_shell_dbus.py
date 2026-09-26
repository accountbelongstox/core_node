# -*- coding: utf-8 -*-
from __future__ import annotations

import ast
import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.pygvar import PROJECT_ROOT
from pycore.pyutils.common.activity_log import ActivityLog
from pycore.pyutils.common.session_dbus import (
    DBUS_ERROR_ACCESS_DENIED,
    DBUS_ERROR_BUS_UNAVAILABLE,
    DBUS_ERROR_SERVICE_UNKNOWN,
    DBusReply,
    call_session_method,
    name_has_owner,
)


BRIDGE_UUID = "pycore-window-bridge@core-node"
BRIDGE_BUS_NAME = "org.corenode.PycoreWindowBridge"
BRIDGE_OBJECT_PATH = "/org/corenode/PycoreWindowBridge"
BRIDGE_INTERFACE = "org.corenode.PycoreWindowBridge"
BRIDGE_SOURCE_DIR = (
    Path(PROJECT_ROOT) / "pycore" / "static" / "gnome_shell_extensions" / BRIDGE_UUID
)
BRIDGE_METADATA_FILE = "metadata.json"
BRIDGE_CAPTURE_TIMEOUT_SECONDS = 10.0
SHELL_EXTENSIONS_BUS_NAME = "org.gnome.Shell.Extensions"
SHELL_EXTENSIONS_OBJECT_PATH = "/org/gnome/Shell/Extensions"
SHELL_EXTENSIONS_INTERFACE = "org.gnome.Shell.Extensions"
SHELL_INTROSPECT_BUS_NAME = "org.gnome.Shell.Introspect"
SHELL_INTROSPECT_OBJECT_PATH = "/org/gnome/Shell/Introspect"
SHELL_INTROSPECT_INTERFACE = "org.gnome.Shell.Introspect"
SHELL_SCHEMA = "org.gnome.shell"
ENABLED_EXTENSIONS_KEY = "enabled-extensions"
DISABLE_USER_EXTENSIONS_KEY = "disable-user-extensions"
EXTENSION_STATE_ACTIVE = 1
INTROSPECT_CLIENT_TYPE_X11 = 1

BRIDGE_STATE_ACTIVE = "active"
BRIDGE_ERROR_NOT_GNOME = "gnome_bridge_not_gnome"
BRIDGE_ERROR_NO_BUS = "gnome_bridge_session_bus_unavailable"
BRIDGE_ERROR_NOT_INSTALLED = "gnome_bridge_not_installed"
BRIDGE_ERROR_OUTDATED = "gnome_bridge_outdated"
BRIDGE_ERROR_DISABLED = "gnome_bridge_disabled"
BRIDGE_ERROR_USER_EXTENSIONS_DISABLED = "gnome_bridge_user_extensions_disabled"
BRIDGE_ERROR_RELOGIN_REQUIRED = "gnome_bridge_relogin_required"
BRIDGE_ERROR_ROOT_USER = "gnome_bridge_requires_desktop_user"
BRIDGE_ERROR_SOURCE_MISSING = "gnome_bridge_source_missing"
BRIDGE_ERROR_SETTINGS_FAILED = "gnome_bridge_settings_failed"
INTROSPECT_ERROR_DENIED = "gnome_introspect_denied"
INTROSPECT_ERROR_UNAVAILABLE = "gnome_introspect_unavailable"
gnome_shell_activity_log = ActivityLog("GnomeShellDBus")


@dataclass(frozen=True)
class BridgeWindow:
    window_id: str
    xid: int
    client_type: str
    title: str
    wm_class: str
    wm_class_instance: str
    app_id: str
    process_id: int
    minimized: bool
    focused: bool
    x: int
    y: int
    width: int
    height: int

    @property
    def is_wayland(self) -> bool:
        return self.client_type == "wayland"


def _read_bridge_version(directory: Path) -> int:
    metadata_path = directory / BRIDGE_METADATA_FILE
    if not metadata_path.is_file():
        return 0
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    return int(metadata.get("version") or 0)


BRIDGE_VERSION = _read_bridge_version(BRIDGE_SOURCE_DIR)


def _user_extension_dir() -> Path:
    data_home = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(data_home) / "gnome-shell" / "extensions" / BRIDGE_UUID


def _gsettings_list(key: str) -> Optional[List[str]]:
    result = run_args(["gsettings", "get", SHELL_SCHEMA, key])
    if not result.success:
        return None
    text = result.stdout.strip()
    if text.startswith("@as"):
        text = text[3:].strip()
    return [str(item) for item in ast.literal_eval(text)]


def _gsettings_bool(key: str) -> Optional[bool]:
    result = run_args(["gsettings", "get", SHELL_SCHEMA, key])
    if not result.success:
        return None
    return result.stdout.strip() == "true"


def _gsettings_set(key: str, value: str) -> bool:
    return run_args(["gsettings", "set", SHELL_SCHEMA, key, value]).success


class GnomeShellBridge:
    def status(self) -> Dict[str, Any]:
        session = current_desktop_session()
        installed_dir = _user_extension_dir()
        installed_version = _read_bridge_version(installed_dir)
        base = {
            "uuid": BRIDGE_UUID,
            "bundled_version": BRIDGE_VERSION,
            "installed_version": installed_version,
            "session": session.session_type,
            "desktop": session.desktop,
        }
        if not session.is_gnome:
            return {**base, "available": False, "state": BRIDGE_ERROR_NOT_GNOME}
        if not session.has_session_bus:
            return {**base, "available": False, "state": BRIDGE_ERROR_NO_BUS}
        running_version = self._running_version()
        if running_version and running_version >= BRIDGE_VERSION:
            return {**base, "available": True, "state": BRIDGE_STATE_ACTIVE}
        if installed_version == 0:
            state = BRIDGE_ERROR_NOT_INSTALLED
        elif installed_version < BRIDGE_VERSION:
            state = BRIDGE_ERROR_OUTDATED
        elif _gsettings_bool(DISABLE_USER_EXTENSIONS_KEY):
            state = BRIDGE_ERROR_USER_EXTENSIONS_DISABLED
        elif BRIDGE_UUID not in (_gsettings_list(ENABLED_EXTENSIONS_KEY) or []):
            state = BRIDGE_ERROR_DISABLED
        else:
            state = BRIDGE_ERROR_RELOGIN_REQUIRED
        return {**base, "available": False, "state": state}

    def install(self) -> Dict[str, Any]:
        if os.name == "posix" and os.geteuid() == 0:
            return {"success": False, "error_code": BRIDGE_ERROR_ROOT_USER}
        if BRIDGE_VERSION == 0:
            return {"success": False, "error_code": BRIDGE_ERROR_SOURCE_MISSING}
        target = _user_extension_dir()
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(BRIDGE_SOURCE_DIR, target, dirs_exist_ok=True)
        gnome_shell_activity_log.success("bridge.installed", target=str(target))
        return self.enable()

    def enable(self) -> Dict[str, Any]:
        if _gsettings_bool(DISABLE_USER_EXTENSIONS_KEY):
            if not _gsettings_set(DISABLE_USER_EXTENSIONS_KEY, "false"):
                return {"success": False, "error_code": BRIDGE_ERROR_SETTINGS_FAILED}
        enabled = _gsettings_list(ENABLED_EXTENSIONS_KEY)
        if enabled is None:
            return {"success": False, "error_code": BRIDGE_ERROR_SETTINGS_FAILED}
        if BRIDGE_UUID not in enabled:
            enabled.append(BRIDGE_UUID)
            if not _gsettings_set(ENABLED_EXTENSIONS_KEY, str(enabled)):
                return {"success": False, "error_code": BRIDGE_ERROR_SETTINGS_FAILED}
        self._shell_extensions_call("EnableExtension")
        status = self.status()
        return {"success": True, "error_code": None, "status": status}

    def disable(self) -> Dict[str, Any]:
        enabled = _gsettings_list(ENABLED_EXTENSIONS_KEY)
        if enabled is None:
            return {"success": False, "error_code": BRIDGE_ERROR_SETTINGS_FAILED}
        if BRIDGE_UUID in enabled:
            enabled.remove(BRIDGE_UUID)
            if not _gsettings_set(ENABLED_EXTENSIONS_KEY, str(enabled)):
                return {"success": False, "error_code": BRIDGE_ERROR_SETTINGS_FAILED}
        self._shell_extensions_call("DisableExtension")
        return {"success": True, "error_code": None, "status": self.status()}

    def list_windows(self) -> Optional[List[BridgeWindow]]:
        reply = self._call("ListWindows")
        if not reply.success:
            return None
        windows: List[BridgeWindow] = []
        for item in json.loads(str(reply.value(0, "[]"))):
            rect = item.get("rect") or {}
            xid_text = str(item.get("xid") or "")
            windows.append(BridgeWindow(
                window_id=str(item.get("id") or ""),
                xid=int(xid_text, 16) if xid_text else 0,
                client_type=str(item.get("client_type") or ""),
                title=str(item.get("title") or ""),
                wm_class=str(item.get("wm_class") or ""),
                wm_class_instance=str(item.get("wm_class_instance") or ""),
                app_id=str(item.get("sandboxed_app_id") or ""),
                process_id=int(item.get("pid") or 0),
                minimized=bool(item.get("minimized")),
                focused=bool(item.get("focused")),
                x=int(rect.get("x") or 0),
                y=int(rect.get("y") or 0),
                width=int(rect.get("width") or 0),
                height=int(rect.get("height") or 0),
            ))
        return windows

    def activate(self, window_id: str) -> bool:
        return bool(self._call("Activate", "t", (int(window_id),)).value(0, False))

    def click(self, x: int, y: int, button: int = 1) -> bool:
        return bool(self._call("PointerClick", "ddu", (float(x), float(y), int(button))).value(0, False))

    def wheel(self, x: int, y: int, steps: int) -> bool:
        return bool(self._call("Scroll", "ddi", (float(x), float(y), int(steps))).value(0, False))

    def key_combo(self, keysym_names: Sequence[str]) -> bool:
        return bool(self._call("KeyCombo", "as", (list(keysym_names),)).value(0, False))

    def capture_png(self, window_id: str) -> Optional[bytes]:
        reply = self._call(
            "CaptureWindow",
            "t",
            (int(window_id),),
            BRIDGE_CAPTURE_TIMEOUT_SECONDS,
        )
        return bytes(reply.value(0)) if reply.success else None

    def _running_version(self) -> int:
        if not name_has_owner(BRIDGE_BUS_NAME):
            return 0
        return int(self._call("GetVersion").value(0, 0) or 0)

    @staticmethod
    def _shell_extensions_call(method: str) -> DBusReply:
        return call_session_method(
            SHELL_EXTENSIONS_BUS_NAME,
            SHELL_EXTENSIONS_OBJECT_PATH,
            SHELL_EXTENSIONS_INTERFACE,
            method,
            "s",
            (BRIDGE_UUID,),
        )

    @staticmethod
    def _call(
        method: str,
        signature: str = "",
        body: tuple = (),
        timeout: float = 5.0,
    ) -> DBusReply:
        reply = call_session_method(
            BRIDGE_BUS_NAME,
            BRIDGE_OBJECT_PATH,
            BRIDGE_INTERFACE,
            method,
            signature,
            body,
            timeout,
        )
        if not reply.success and reply.error_name not in (
            DBUS_ERROR_SERVICE_UNKNOWN,
            DBUS_ERROR_BUS_UNAVAILABLE,
        ):
            gnome_shell_activity_log.warning(
                "bridge.call.failed",
                method=method,
                error_name=reply.error_name,
                error_message=reply.error_message,
            )
        return reply


class GnomeShellIntrospect:
    def list_windows(self) -> Dict[str, Any]:
        reply = call_session_method(
            SHELL_INTROSPECT_BUS_NAME,
            SHELL_INTROSPECT_OBJECT_PATH,
            SHELL_INTROSPECT_INTERFACE,
            "GetWindows",
        )
        if not reply.success:
            error_code = (
                INTROSPECT_ERROR_DENIED
                if reply.error_name == DBUS_ERROR_ACCESS_DENIED
                else INTROSPECT_ERROR_UNAVAILABLE
            )
            if reply.error_name == DBUS_ERROR_BUS_UNAVAILABLE:
                error_code = BRIDGE_ERROR_NO_BUS
            return {"available": False, "error_code": error_code, "windows": []}
        windows = []
        for window_id, properties in dict(reply.value(0, {})).items():
            values = {key: value[1] for key, value in dict(properties).items()}
            windows.append({
                "window_id": str(window_id),
                "title": str(values.get("title") or ""),
                "app_id": str(values.get("app-id") or ""),
                "wm_class": str(values.get("wm-class") or ""),
                "client_type": (
                    "x11"
                    if int(values.get("client-type") or 0) == INTROSPECT_CLIENT_TYPE_X11
                    else "wayland"
                ),
                "hidden": bool(values.get("is-hidden")),
                "focused": bool(values.get("has-focus")),
                "width": int(values.get("width") or 0),
                "height": int(values.get("height") or 0),
            })
        return {"available": True, "error_code": None, "windows": windows}


gnome_shell_bridge = GnomeShellBridge()
gnome_shell_introspect = GnomeShellIntrospect()


__all__ = [
    "BRIDGE_ERROR_NOT_GNOME",
    "BRIDGE_STATE_ACTIVE",
    "BRIDGE_UUID",
    "BridgeWindow",
    "INTROSPECT_ERROR_DENIED",
    "gnome_shell_bridge",
    "gnome_shell_introspect",
]
