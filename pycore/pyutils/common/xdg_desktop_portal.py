# -*- coding: utf-8 -*-
from __future__ import annotations

import secrets
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import unquote, urlparse

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_Xlib_module,
    get_third_package_jeepney_module,
)
from pycore.pyutils.common.activity_log import ActivityLog
from pycore.pyutils.common.session_dbus import (
    DBUS_ERROR_BUS_UNAVAILABLE,
    DBusReply,
    add_match,
    call_method,
    open_session_bus,
    unique_name,
    variant,
)


jeepney = get_third_package_jeepney_module()
xlib_xk = get_third_package_Xlib_module("XK")
Image = get_third_package_PIL_Image()

PORTAL_BUS_NAME = "org.freedesktop.portal.Desktop"
PORTAL_OBJECT_PATH = "/org/freedesktop/portal/desktop"
PORTAL_REQUEST_INTERFACE = "org.freedesktop.portal.Request"
PORTAL_REMOTE_DESKTOP_INTERFACE = "org.freedesktop.portal.RemoteDesktop"
PORTAL_SCREENCAST_INTERFACE = "org.freedesktop.portal.ScreenCast"
PORTAL_SCREENSHOT_INTERFACE = "org.freedesktop.portal.Screenshot"
PORTAL_SESSION_INTERFACE = "org.freedesktop.portal.Session"
PROPERTIES_INTERFACE = "org.freedesktop.DBus.Properties"
PORTAL_DEVICE_KEYBOARD = 1
PORTAL_DEVICE_POINTER = 2
PORTAL_SOURCE_MONITOR = 1
PORTAL_PERSIST_UNTIL_REVOKED = 2
PORTAL_RESPONSE_SUCCESS = 0
PORTAL_KEY_PRESSED = 1
PORTAL_KEY_RELEASED = 0
PORTAL_AXIS_VERTICAL = 0
EVDEV_BUTTON_CODES = {1: 0x110, 2: 0x112, 3: 0x111}
PORTAL_REQUEST_TIMEOUT_SECONDS = 10.0
PORTAL_AUTHORIZE_TIMEOUT_SECONDS = 120.0
PORTAL_RESTORE_TIMEOUT_SECONDS = 15.0
PORTAL_TOKEN_PATH = APP_DATA_DIR / "desktop_portal" / "remote_desktop_restore_token"
PORTAL_ERROR_UNAVAILABLE = "portal_unavailable"
PORTAL_ERROR_AUTHORIZATION_REQUIRED = "portal_authorization_required"
PORTAL_ERROR_DENIED = "portal_request_denied"
PORTAL_ERROR_TIMEOUT = "portal_request_timeout"
PORTAL_ERROR_NO_STREAM = "portal_stream_unavailable"
PORTAL_ERROR_KEY_UNMAPPED = "portal_key_unmapped"
portal_activity_log = ActivityLog("XdgDesktopPortal")


class XdgDesktopPortal:
    """RemoteDesktop/ScreenCast input and Screenshot capture; one connection owns the session."""

    def __init__(self) -> None:
        self._connection: Optional[Any] = None
        self._session_handle = ""
        self._streams: List[Dict[str, Any]] = []
        init_serialized_owner(self, "desktop.portal", "XdgDesktopPortal")

    @serialized_method
    def status(self) -> Dict[str, Any]:
        connection = self._ensure_connection()
        if connection is None:
            return {"available": False, "error_code": DBUS_ERROR_BUS_UNAVAILABLE}
        versions = {
            interface: self._interface_version(connection, interface)
            for interface in (
                PORTAL_REMOTE_DESKTOP_INTERFACE,
                PORTAL_SCREENCAST_INTERFACE,
                PORTAL_SCREENSHOT_INTERFACE,
            )
        }
        if not versions[PORTAL_REMOTE_DESKTOP_INTERFACE]:
            return {"available": False, "error_code": PORTAL_ERROR_UNAVAILABLE, "versions": versions}
        return {
            "available": True,
            "error_code": None,
            "versions": versions,
            "session_active": bool(self._session_handle),
            "authorized": bool(self._session_handle) or PORTAL_TOKEN_PATH.is_file(),
        }

    @serialized_method
    def authorize(self) -> Dict[str, Any]:
        return self._start_session(PORTAL_AUTHORIZE_TIMEOUT_SECONDS)

    @serialized_method
    def revoke(self) -> Dict[str, Any]:
        self._close_session()
        if PORTAL_TOKEN_PATH.is_file():
            PORTAL_TOKEN_PATH.unlink()
        return {"success": True, "error_code": None}

    @serialized_method
    def key_combo(self, keysym_names: Sequence[str]) -> Dict[str, Any]:
        ready = self._ready_session()
        if not ready["success"]:
            return ready
        keysyms = [int(xlib_xk.string_to_keysym(name)) for name in keysym_names]
        if any(keysym == 0 for keysym in keysyms):
            return {"success": False, "error_code": PORTAL_ERROR_KEY_UNMAPPED}
        for keysym in keysyms:
            self._notify("NotifyKeyboardKeysym", "a{sv}iu", (keysym, PORTAL_KEY_PRESSED))
        for keysym in reversed(keysyms):
            self._notify("NotifyKeyboardKeysym", "a{sv}iu", (keysym, PORTAL_KEY_RELEASED))
        return {"success": True, "error_code": None}

    @serialized_method
    def click(self, x: int, y: int, button: int = 1) -> Dict[str, Any]:
        moved = self._move_pointer(x, y)
        if not moved["success"]:
            return moved
        code = EVDEV_BUTTON_CODES.get(int(button), EVDEV_BUTTON_CODES[1])
        self._notify("NotifyPointerButton", "a{sv}iu", (code, PORTAL_KEY_PRESSED))
        self._notify("NotifyPointerButton", "a{sv}iu", (code, PORTAL_KEY_RELEASED))
        return {"success": True, "error_code": None}

    @serialized_method
    def wheel(self, x: int, y: int, steps: int) -> Dict[str, Any]:
        moved = self._move_pointer(x, y)
        if not moved["success"]:
            return moved
        self._notify("NotifyPointerAxisDiscrete", "a{sv}ui", (PORTAL_AXIS_VERTICAL, -int(steps)))
        return {"success": True, "error_code": None}

    @serialized_method
    def capture_regions(self, regions: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        """One non-interactive screenshot cropped per region; returns {region_id: PIL image}."""
        connection = self._ensure_connection()
        if connection is None or not regions:
            return {}
        response, results = self._request(
            connection,
            PORTAL_SCREENSHOT_INTERFACE,
            "Screenshot",
            "sa{sv}",
            ("",),
            {"interactive": variant("b", False)},
            PORTAL_REQUEST_TIMEOUT_SECONDS,
        )
        if response != PORTAL_RESPONSE_SUCCESS:
            portal_activity_log.warning("screenshot.failed", response=response)
            return {}
        path = Path(unquote(urlparse(str(results.get("uri", ("s", ""))[1])).path))
        images: Dict[str, Any] = {}
        with Image.open(path) as screenshot:
            frame = screenshot.convert("RGB")
        path.unlink(missing_ok=True)
        for region in regions:
            left = int(region.get("left") or 0)
            top = int(region.get("top") or 0)
            width = int(region.get("width") or 0)
            height = int(region.get("height") or 0)
            if width > 0 and height > 0:
                images[str(region["id"])] = frame.crop((left, top, left + width, top + height))
        return images

    def _ready_session(self) -> Dict[str, Any]:
        if self._session_handle:
            return {"success": True, "error_code": None}
        if not PORTAL_TOKEN_PATH.is_file():
            return {"success": False, "error_code": PORTAL_ERROR_AUTHORIZATION_REQUIRED}
        return self._start_session(PORTAL_RESTORE_TIMEOUT_SECONDS)

    def _move_pointer(self, x: int, y: int) -> Dict[str, Any]:
        ready = self._ready_session()
        if not ready["success"]:
            return ready
        stream = next(
            (
                item for item in self._streams
                if item["x"] <= x < item["x"] + item["width"]
                and item["y"] <= y < item["y"] + item["height"]
            ),
            None,
        )
        if stream is None:
            return {"success": False, "error_code": PORTAL_ERROR_NO_STREAM}
        self._notify(
            "NotifyPointerMotionAbsolute",
            "a{sv}udd",
            (int(stream["node_id"]), float(x - stream["x"]), float(y - stream["y"])),
        )
        return {"success": True, "error_code": None}

    def _start_session(self, timeout: float) -> Dict[str, Any]:
        connection = self._ensure_connection()
        if connection is None:
            return {"success": False, "error_code": DBUS_ERROR_BUS_UNAVAILABLE}
        self._close_session()
        response, results = self._request(
            connection,
            PORTAL_REMOTE_DESKTOP_INTERFACE,
            "CreateSession",
            "a{sv}",
            (),
            {"session_handle_token": variant("s", self._token())},
            PORTAL_REQUEST_TIMEOUT_SECONDS,
        )
        if response != PORTAL_RESPONSE_SUCCESS:
            return self._portal_failure(response, "create_session")
        session_handle = str(results.get("session_handle", ("s", ""))[1])
        device_options: Dict[str, Tuple[str, Any]] = {
            "types": variant("u", PORTAL_DEVICE_KEYBOARD | PORTAL_DEVICE_POINTER),
            "persist_mode": variant("u", PORTAL_PERSIST_UNTIL_REVOKED),
        }
        if PORTAL_TOKEN_PATH.is_file():
            device_options["restore_token"] = variant(
                "s",
                PORTAL_TOKEN_PATH.read_text(encoding="utf-8").strip(),
            )
        steps = (
            (PORTAL_REMOTE_DESKTOP_INTERFACE, "SelectDevices", "oa{sv}", (session_handle,), device_options, PORTAL_REQUEST_TIMEOUT_SECONDS),
            (
                PORTAL_SCREENCAST_INTERFACE,
                "SelectSources",
                "oa{sv}",
                (session_handle,),
                {"types": variant("u", PORTAL_SOURCE_MONITOR), "multiple": variant("b", True)},
                PORTAL_REQUEST_TIMEOUT_SECONDS,
            ),
            (PORTAL_REMOTE_DESKTOP_INTERFACE, "Start", "osa{sv}", (session_handle, ""), {}, timeout),
        )
        for interface, method, signature, body, options, step_timeout in steps:
            response, results = self._request(
                connection,
                interface,
                method,
                signature,
                body,
                options,
                step_timeout,
            )
            if response != PORTAL_RESPONSE_SUCCESS:
                self._session_handle = session_handle
                self._close_session()
                return self._portal_failure(response, method)
        restore_token = str(results.get("restore_token", ("s", ""))[1])
        if restore_token:
            PORTAL_TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
            PORTAL_TOKEN_PATH.write_text(restore_token, encoding="utf-8")
        self._session_handle = session_handle
        self._streams = [
            {
                "node_id": int(node_id),
                "x": int(properties.get("position", ("(ii)", (0, 0)))[1][0]),
                "y": int(properties.get("position", ("(ii)", (0, 0)))[1][1]),
                "width": int(properties.get("size", ("(ii)", (0, 0)))[1][0]),
                "height": int(properties.get("size", ("(ii)", (0, 0)))[1][1]),
            }
            for node_id, properties in results.get("streams", ("a(ua{sv})", []))[1]
        ]
        portal_activity_log.success(
            "session.started",
            session_handle=session_handle,
            streams=self._streams,
            devices=int(results.get("devices", ("u", 0))[1]),
        )
        return {"success": True, "error_code": None, "streams": self._streams}

    def _close_session(self) -> None:
        if self._session_handle and self._connection is not None:
            call_method(
                self._connection,
                PORTAL_BUS_NAME,
                self._session_handle,
                PORTAL_SESSION_INTERFACE,
                "Close",
            )
        self._session_handle = ""
        self._streams = []

    def _notify(self, method: str, signature: str, arguments: Tuple[Any, ...]) -> DBusReply:
        reply = call_method(
            self._connection,
            PORTAL_BUS_NAME,
            PORTAL_OBJECT_PATH,
            PORTAL_REMOTE_DESKTOP_INTERFACE,
            method,
            f"o{signature}",
            (self._session_handle, {}, *arguments),
        )
        if not reply.success:
            portal_activity_log.warning(
                "notify.failed",
                method=method,
                error_name=reply.error_name,
                error_message=reply.error_message,
            )
            self._session_handle = ""
        return reply

    def _ensure_connection(self) -> Optional[Any]:
        if self._connection is None:
            self._connection = open_session_bus()
        return self._connection

    def _request(
        self,
        connection: Any,
        interface: str,
        method: str,
        signature: str,
        body: Tuple[Any, ...],
        options: Dict[str, Tuple[str, Any]],
        timeout: float,
    ) -> Tuple[int, Dict[str, Any]]:
        token = self._token()
        sender = unique_name(connection).lstrip(":").replace(".", "_")
        request_path = f"{PORTAL_OBJECT_PATH}/request/{sender}/{token}"
        rule = jeepney.MatchRule(
            type="signal",
            interface=PORTAL_REQUEST_INTERFACE,
            member="Response",
            path=request_path,
        )
        add_match(connection, rule)
        with connection.filter(rule) as queue:
            reply = call_method(
                connection,
                PORTAL_BUS_NAME,
                PORTAL_OBJECT_PATH,
                interface,
                method,
                signature,
                (*body, {**options, "handle_token": variant("s", token)}),
            )
            if not reply.success:
                portal_activity_log.warning(
                    "request.rejected",
                    method=method,
                    error_name=reply.error_name,
                    error_message=reply.error_message,
                )
                return -1, {}
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                remaining = max(0.05, deadline - time.monotonic())
                try:
                    signal = connection.recv_until_filtered(queue, timeout=remaining)
                except TimeoutError:
                    break
                response, results = signal.body
                return int(response), dict(results)
        portal_activity_log.warning("request.timeout", method=method, timeout=timeout)
        return -2, {}

    @staticmethod
    def _interface_version(connection: Any, interface: str) -> int:
        reply = call_method(
            connection,
            PORTAL_BUS_NAME,
            PORTAL_OBJECT_PATH,
            PROPERTIES_INTERFACE,
            "Get",
            "ss",
            (interface, "version"),
        )
        return int(reply.value(0, ("u", 0))[1]) if reply.success else 0

    @staticmethod
    def _portal_failure(response: int, step: str) -> Dict[str, Any]:
        error_code = PORTAL_ERROR_TIMEOUT if response == -2 else PORTAL_ERROR_DENIED
        portal_activity_log.warning("session.failed", step=step, response=response)
        return {"success": False, "error_code": error_code, "step": step}

    @staticmethod
    def _token() -> str:
        return f"pycore_{secrets.token_hex(8)}"


xdg_desktop_portal = XdgDesktopPortal()


__all__ = [
    "PORTAL_ERROR_AUTHORIZATION_REQUIRED",
    "PORTAL_ERROR_UNAVAILABLE",
    "xdg_desktop_portal",
]
