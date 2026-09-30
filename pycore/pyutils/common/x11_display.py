# -*- coding: utf-8 -*-
from __future__ import annotations

import socket
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pycore.pyfoundations.desktop_session import (
    DesktopSession,
    ensure_session_environment,
    xauthority_candidates,
)
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_Xlib_module,
)
from pycore.pyutils.common.activity_log import ActivityLog


Image = get_third_package_PIL_Image()
xlib_display = get_third_package_Xlib_module("display")
xlib_x = get_third_package_Xlib_module("X")
xlib_xk = get_third_package_Xlib_module("XK")
xlib_xtest = get_third_package_Xlib_module("ext.xtest")
xlib_event = get_third_package_Xlib_module("protocol.event")
xlib_error = get_third_package_Xlib_module("error")
xlib_xauth = get_third_package_Xlib_module("xauth")
xlib_unix_connect = get_third_package_Xlib_module("support.unix_connect")

X11_ERROR_DISPLAY_UNSET = "x11_display_unset"
X11_ERROR_CONNECT_FAILED = "x11_connect_failed"
X11_NO_COOKIE_SOURCE = "no-cookie"
X11_ERROR_XTEST_MISSING = "x11_xtest_unavailable"
X11_ERROR_EWMH_MISSING = "x11_ewmh_unavailable"
EWMH_SOURCE_PAGER = 2
ACTIVATION_POLL_SECONDS = 0.02
ACTIVATION_TIMEOUT_SECONDS = 0.6
KEY_STEP_DELAY_SECONDS = 0.01
WHEEL_UP_BUTTON = 4
WHEEL_DOWN_BUTTON = 5
ALL_PLANES = 0xFFFFFFFF
NET_WM_STATE_REMOVE = 0
X11_COOKIE_AUTH_NAME = b"MIT-MAGIC-COOKIE-1"
X11_NO_COOKIE = ("", "")
x11_activity_log = ActivityLog("X11Display")
_x11_connect_cookie = threading.local()
_xlib_file_get_auth = xlib_unix_connect.get_auth


def _session_get_auth(sock: Any, dname: Any, host: Any, dno: Any) -> Tuple[Any, Any]:
    """Process-wide Xlib auth hook: the cookie chosen by this thread's connect, else
    Xlib's own strict lookup, else the session cookies (display-less Xwayland/mutter
    entries that python-xlib alone never matches), so every Xlib user connects."""
    cookie = getattr(_x11_connect_cookie, "value", None)
    if cookie is not None:
        return cookie
    name, data = _xlib_file_get_auth(sock, dname, host, dno)
    if name:
        return name, data
    session = ensure_session_environment()
    cookies, _failures = X11Display.session_cookies(session)
    return cookies[0][1] if cookies else (name, data)


xlib_unix_connect.get_auth = _session_get_auth


@dataclass(frozen=True)
class X11Window:
    xid: int
    title: str
    instance_name: str
    class_name: str
    process_id: int
    desktop: int
    x: int
    y: int
    width: int
    height: int
    hidden: bool
    active: bool

    @property
    def wm_class(self) -> str:
        return ".".join(part for part in (self.instance_name, self.class_name) if part)

    @property
    def hex_id(self) -> str:
        return f"0x{self.xid:08x}"


class X11Connection:
    """One short-lived Xlib connection; Xlib objects are never shared across threads."""

    def __init__(self, display: Any) -> None:
        self.display = display
        self.root = display.screen().root
        self._atoms: Dict[str, int] = {}

    def atom(self, name: str) -> int:
        if name not in self._atoms:
            self._atoms[name] = self.display.intern_atom(name)
        return self._atoms[name]

    def window(self, xid: int) -> Any:
        return self.display.create_resource_object("window", xid)

    def property_values(self, window: Any, name: str) -> Optional[Sequence[Any]]:
        prop = window.get_full_property(self.atom(name), xlib_x.AnyPropertyType)
        return None if prop is None else prop.value

    def property_text(self, window: Any, name: str) -> str:
        values = self.property_values(window, name)
        if values is None:
            return ""
        if isinstance(values, bytes):
            return values.decode("utf-8", errors="replace")
        return str(values)

    def property_int(self, window: Any, name: str, default: int = 0) -> int:
        values = self.property_values(window, name)
        return int(values[0]) if values is not None and len(values) else default

    def close(self) -> None:
        self.display.close()


class X11Display:
    def probe(self) -> Dict[str, Any]:
        connection, error_code = self._open()
        if connection is None:
            return {"available": False, "error_code": error_code}
        extension = connection.display.query_extension("XTEST")
        client_list = connection.property_values(connection.root, "_NET_CLIENT_LIST")
        connection.close()
        if extension is None:
            return {"available": False, "error_code": X11_ERROR_XTEST_MISSING}
        if client_list is None:
            return {"available": False, "error_code": X11_ERROR_EWMH_MISSING}
        return {"available": True, "error_code": None}

    def list_client_windows(self) -> Optional[List[X11Window]]:
        connection, _error_code = self._open()
        if connection is None:
            return None
        client_ids = connection.property_values(connection.root, "_NET_CLIENT_LIST")
        active_id = connection.property_int(connection.root, "_NET_ACTIVE_WINDOW")
        windows: List[X11Window] = []
        for xid in client_ids or ():
            window = self._read_window(connection, int(xid), active_id)
            if window is not None:
                windows.append(window)
        connection.close()
        return windows

    def window_ids(self) -> set[int]:
        windows = self.list_client_windows()
        return {window.xid for window in windows or ()}

    def find_by_title(self, title: str) -> List[int]:
        return [
            window.xid
            for window in self.list_client_windows() or ()
            if window.title == title
        ]

    def active_window(self) -> int:
        connection, _error_code = self._open()
        if connection is None:
            return 0
        active_id = connection.property_int(connection.root, "_NET_ACTIVE_WINDOW")
        connection.close()
        return active_id

    def activate(self, xid: int) -> bool:
        connection, _error_code = self._open()
        if connection is None:
            return False
        window = connection.window(xid)
        window.map()
        self._send_root_message(
            connection,
            window,
            "_NET_WM_STATE",
            [NET_WM_STATE_REMOVE, connection.atom("_NET_WM_STATE_HIDDEN"), 0, EWMH_SOURCE_PAGER, 0],
        )
        self._send_root_message(
            connection,
            window,
            "_NET_ACTIVE_WINDOW",
            [EWMH_SOURCE_PAGER, xlib_x.CurrentTime, 0, 0, 0],
        )
        window.configure(stack_mode=xlib_x.Above)
        connection.display.flush()
        deadline = time.monotonic() + ACTIVATION_TIMEOUT_SECONDS
        activated = False
        while time.monotonic() < deadline:
            connection.display.sync()
            if connection.property_int(connection.root, "_NET_ACTIVE_WINDOW") == xid:
                activated = True
                break
            time.sleep(ACTIVATION_POLL_SECONDS)
        connection.close()
        if not activated:
            x11_activity_log.warning("window.activate.unconfirmed", xid=f"0x{xid:x}")
        return activated

    def move_resize(
        self,
        xid: int,
        x: int,
        y: int,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ) -> bool:
        connection, _error_code = self._open()
        if connection is None:
            return False
        window = connection.window(xid)
        flags = (1 << 8) | (1 << 9)
        size = [0, 0]
        if width and height:
            flags |= (1 << 10) | (1 << 11)
            size = [int(width), int(height)]
        self._send_root_message(
            connection,
            window,
            "_NET_MOVERESIZE_WINDOW",
            [flags | xlib_x.NorthWestGravity, int(x), int(y), *size],
        )
        connection.display.flush()
        connection.close()
        return True

    def frame_extents(self, xid: int) -> Tuple[int, int, int, int]:
        connection, _error_code = self._open()
        if connection is None:
            return (0, 0, 0, 0)
        values = connection.property_values(connection.window(xid), "_NET_FRAME_EXTENTS")
        connection.close()
        if values is None or len(values) != 4:
            return (0, 0, 0, 0)
        return tuple(int(value) for value in values)  # type: ignore[return-value]

    def click(self, x: int, y: int, button: int = 1) -> bool:
        connection, _error_code = self._open()
        if connection is None:
            return False
        self._fake_motion(connection, x, y)
        xlib_xtest.fake_input(connection.display, xlib_x.ButtonPress, button)
        xlib_xtest.fake_input(connection.display, xlib_x.ButtonRelease, button)
        connection.display.sync()
        connection.close()
        return True

    def wheel(self, x: int, y: int, steps: int) -> bool:
        connection, _error_code = self._open()
        if connection is None:
            return False
        self._fake_motion(connection, x, y)
        button = WHEEL_UP_BUTTON if steps > 0 else WHEEL_DOWN_BUTTON
        for _index in range(abs(int(steps))):
            xlib_xtest.fake_input(connection.display, xlib_x.ButtonPress, button)
            xlib_xtest.fake_input(connection.display, xlib_x.ButtonRelease, button)
        connection.display.sync()
        connection.close()
        return True

    def key_combo(self, keysym_names: Iterable[str]) -> bool:
        connection, _error_code = self._open()
        if connection is None:
            return False
        keycodes: List[int] = []
        for name in keysym_names:
            keycode = connection.display.keysym_to_keycode(xlib_xk.string_to_keysym(name))
            if not keycode:
                connection.close()
                x11_activity_log.error("key.unmapped", keysym=name)
                return False
            keycodes.append(int(keycode))
        for keycode in keycodes:
            xlib_xtest.fake_input(connection.display, xlib_x.KeyPress, keycode)
            connection.display.sync()
            time.sleep(KEY_STEP_DELAY_SECONDS)
        for keycode in reversed(keycodes):
            xlib_xtest.fake_input(connection.display, xlib_x.KeyRelease, keycode)
        connection.display.sync()
        connection.close()
        return True

    def capture(self, xid: int) -> Optional[Any]:
        connection, _error_code = self._open()
        if connection is None:
            return None
        window = connection.window(xid)
        try:
            geometry = window.get_geometry()
            reply = window.get_image(
                0,
                0,
                int(geometry.width),
                int(geometry.height),
                xlib_x.ZPixmap,
                ALL_PLANES,
            )
        except xlib_error.XError as error:
            connection.close()
            x11_activity_log.warning(
                "window.capture.failed",
                xid=f"0x{xid:x}",
                error_type=type(error).__name__,
                error=error,
            )
            return None
        connection.close()
        size = (int(geometry.width), int(geometry.height))
        return Image.frombytes("RGB", size, reply.data, "raw", "BGRX")

    @staticmethod
    def _session_cookie(source_path: str, session: DesktopSession) -> Optional[Tuple[bytes, bytes]]:
        """Read the display's cookie in memory; display-less entries (Xwayland/mutter) match any display."""
        display_number = session.display.rpartition(":")[2].split(".", 1)[0].encode()
        entries = xlib_xauth.Xauthority(source_path).entries
        hostname = socket.gethostname().encode()
        candidates = [
            entry
            for entry in entries
            if entry[3] == X11_COOKIE_AUTH_NAME and entry[2] in (display_number, b"")
        ]
        candidates.sort(
            key=lambda entry: (
                entry[2] != display_number,
                not (entry[0] == xlib_xauth.FamilyLocal and entry[1] == hostname),
            )
        )
        return (candidates[0][3], candidates[0][4]) if candidates else None

    @staticmethod
    def session_cookies(session: DesktopSession) -> Tuple[List[Tuple[str, Tuple[Any, Any]]], List[str]]:
        """Readable session cookie files (configured first, then newest) -> (source, cookie)."""
        sources = dict.fromkeys(
            path
            for path in (session.xauthority, *xauthority_candidates(session.runtime_dir))
            if path and Path(path).is_file()
        )
        failures: List[str] = []
        cookies: List[Tuple[str, Tuple[Any, Any]]] = []
        if not session.display:
            return cookies, failures
        for source in sources:
            try:
                cookie = X11Display._session_cookie(source, session)
            except (xlib_error.XauthError, OSError) as error:
                failures.append(f"{source}: {error}")
                continue
            if cookie is not None:
                cookies.append((source, cookie))
        return cookies, failures

    @staticmethod
    def _open() -> Tuple[Optional[X11Connection], Optional[str]]:
        session = ensure_session_environment()
        if not session.display:
            return None, X11_ERROR_DISPLAY_UNSET
        attempts, failures = X11Display.session_cookies(session)
        # Each cookie first; then one attempt with no cookie at all for servers
        # reachable by host access (xhost, Xvfb).
        attempts.append((X11_NO_COOKIE_SOURCE, X11_NO_COOKIE))
        for source, cookie in attempts:
            _x11_connect_cookie.value = cookie
            try:
                display = xlib_display.Display(session.display)
            except (
                xlib_error.DisplayError,
                xlib_error.ConnectionClosedError,
                xlib_error.XauthError,
                OSError,
            ) as error:
                failures.append(f"{source}: {error}")
                continue
            finally:
                _x11_connect_cookie.value = None
            return X11Connection(display), None
        x11_activity_log.warning(
            "connect.failed",
            display=session.display,
            attempts=failures,
        )
        return None, X11_ERROR_CONNECT_FAILED

    @staticmethod
    def _fake_motion(connection: X11Connection, x: int, y: int) -> None:
        xlib_xtest.fake_input(connection.display, xlib_x.MotionNotify, x=int(x), y=int(y))
        connection.display.sync()

    @staticmethod
    def _send_root_message(
        connection: X11Connection,
        window: Any,
        message_type: str,
        data: List[int],
    ) -> None:
        event = xlib_event.ClientMessage(
            window=window,
            client_type=connection.atom(message_type),
            data=(32, (data + [0, 0, 0, 0, 0])[:5]),
        )
        connection.root.send_event(
            event,
            event_mask=xlib_x.SubstructureRedirectMask | xlib_x.SubstructureNotifyMask,
        )

    @staticmethod
    def _read_window(
        connection: X11Connection,
        xid: int,
        active_id: int,
    ) -> Optional[X11Window]:
        window = connection.window(xid)
        try:
            geometry = window.get_geometry()
            origin = window.translate_coords(connection.root, 0, 0)
            wm_class = window.get_wm_class() or ("", "")
            title = connection.property_text(window, "_NET_WM_NAME") or str(
                window.get_wm_name() or ""
            )
            states = connection.property_values(window, "_NET_WM_STATE") or ()
            process_id = connection.property_int(window, "_NET_WM_PID")
            desktop = connection.property_int(window, "_NET_WM_DESKTOP", -1)
        except xlib_error.XError as error:
            x11_activity_log.info(
                "window.read.skipped",
                xid=f"0x{xid:x}",
                error_type=type(error).__name__,
            )
            return None
        if int(geometry.width) <= 0 or int(geometry.height) <= 0:
            return None
        return X11Window(
            xid=xid,
            title=title,
            instance_name=str(wm_class[0] or ""),
            class_name=str(wm_class[1] or ""),
            process_id=process_id,
            desktop=desktop,
            x=-int(origin.x),
            y=-int(origin.y),
            width=int(geometry.width),
            height=int(geometry.height),
            hidden=connection.atom("_NET_WM_STATE_HIDDEN") in states,
            active=xid == active_id,
        )


x11_display = X11Display()


__all__ = [
    "X11_ERROR_CONNECT_FAILED",
    "X11_ERROR_DISPLAY_UNSET",
    "X11_ERROR_EWMH_MISSING",
    "X11_ERROR_XTEST_MISSING",
    "X11Window",
    "x11_display",
]
