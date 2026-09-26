# -*- coding: utf-8 -*-
from __future__ import annotations

from io import BytesIO
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from pycore.pyfoundations.desktop_session import DesktopSession, current_desktop_session
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image
from pycore.pyutils.common.gnome_shell_dbus import (
    BRIDGE_STATE_ACTIVE,
    BridgeWindow,
    gnome_shell_bridge,
    gnome_shell_introspect,
)
from pycore.pyutils.common.terminal_identifiers import is_linux_terminal_class
from pycore.pyutils.common.x11_display import X11Window, x11_display
from pycore.pyutils.common.xdg_desktop_portal import xdg_desktop_portal
from pycore.pyutils.window.terminal_backend import (
    CONTROL_NONE,
    TERMINAL_KEY_END,
    TERMINAL_KEY_INSERT,
    TERMINAL_KEY_SHIFT,
    TerminalWindowBackend,
    build_terminal_window,
    failure,
)


Image = get_third_package_PIL_Image()

CONTROL_X11 = "x11"
CONTROL_XWAYLAND = "xwayland"
CONTROL_GNOME_BRIDGE = "gnome_bridge"
CONTROL_PORTAL = "portal"
X11_WINDOW_PREFIX = "x11:"
GNOME_WINDOW_PREFIX = "gnome:"
INTROSPECT_WINDOW_PREFIX = "introspect:"
INTEGRATION_ACTIONS = frozenset({
    "status",
    "install_bridge",
    "enable_bridge",
    "disable_bridge",
    "authorize_portal",
    "revoke_portal",
})


class LinuxTerminalBackend(TerminalWindowBackend):
    """X11/Xwayland via Xlib, native Wayland via the GNOME bridge, portal as input/capture fallback."""

    platform_name = "linux"

    def _list_windows(self) -> List[Dict[str, Any]]:
        session = current_desktop_session()
        windows: List[Dict[str, Any]] = []
        x11_windows = x11_display.list_client_windows() if session.has_x11_display else None
        x11_control = CONTROL_XWAYLAND if session.is_wayland else CONTROL_X11
        covered_xids = set()
        for window in x11_windows or ():
            covered_xids.add(window.xid)
            if is_linux_terminal_class(window.wm_class):
                windows.append(self._x11_terminal(window, x11_control))
        if session.is_gnome and session.is_wayland and session.has_session_bus:
            bridge_windows = gnome_shell_bridge.list_windows()
            if bridge_windows is not None:
                for window in bridge_windows:
                    if window.xid and window.xid in covered_xids:
                        continue
                    if self._bridge_is_terminal(window):
                        windows.append(self._bridge_terminal(window))
            else:
                windows.extend(self._introspect_terminals())
        windows.sort(key=lambda item: (
            int(item["rect"]["y"]),
            int(item["rect"]["x"]),
            str(item["title"]).lower(),
            str(item["native_id"]),
        ))
        return windows

    def _inventory_meta(self, windows: List[Dict[str, Any]]) -> Dict[str, Any]:
        session = current_desktop_session()
        capabilities = self._capabilities(session)
        x11_ready = bool(capabilities[CONTROL_X11]["available"])
        bridge_ready = bool(capabilities[CONTROL_GNOME_BRIDGE]["available"])
        supported = x11_ready or bridge_ready
        control_modes = sorted({
            str(window["control"]) for window in windows if window.get("controllable")
        })
        if not control_modes:
            if x11_ready:
                control_modes.append(CONTROL_XWAYLAND if session.is_wayland else CONTROL_X11)
            if bridge_ready:
                control_modes.append(CONTROL_GNOME_BRIDGE)
        return {
            "session": session.session_type,
            "supported": supported,
            "error_code": self._error_code(session, capabilities, supported),
            "notice_code": self._notice_code(session, capabilities, windows),
            "platform_profile": session.profile(),
            "control_modes": control_modes,
            "capabilities": capabilities,
        }

    def paste_uses_primary_selection(self) -> bool:
        return True

    def desktop_integration(self, action: str) -> Dict[str, Any]:
        if action not in INTEGRATION_ACTIONS:
            return failure("desktop_integration_action_invalid", action=action)
        handlers: Dict[str, Callable[[], Dict[str, Any]]] = {
            "install_bridge": gnome_shell_bridge.install,
            "enable_bridge": gnome_shell_bridge.enable,
            "disable_bridge": gnome_shell_bridge.disable,
            "authorize_portal": xdg_desktop_portal.authorize,
            "revoke_portal": xdg_desktop_portal.revoke,
        }
        result = handlers[action]() if action in handlers else {"success": True, "error_code": None}
        session = current_desktop_session()
        return {
            **result,
            "action": action,
            "platform_profile": session.profile(),
            "capabilities": self._capabilities(session),
        }

    def _raise_window(self, window: Dict[str, Any]) -> Dict[str, Any]:
        control = str(window["control"])
        if control in (CONTROL_X11, CONTROL_XWAYLAND):
            activated = x11_display.activate(int(str(window["native_id"]), 16))
        elif control == CONTROL_GNOME_BRIDGE:
            activated = gnome_shell_bridge.activate(str(window["native_id"]))
        else:
            activated = False
        if not activated:
            return {"success": False, "error_code": "terminal_raise_failed"}
        return {"success": True}

    def _click(self, window: Dict[str, Any], x: int, y: int, button: int) -> bool:
        return self._dispatch(
            window,
            lambda: x11_display.click(x, y, button),
            lambda: gnome_shell_bridge.click(x, y, button),
            lambda: bool(xdg_desktop_portal.click(x, y, button).get("success")),
        )

    def _keys(self, window: Dict[str, Any], keysym_names: Sequence[str]) -> bool:
        names = list(keysym_names)
        return self._dispatch(
            window,
            lambda: x11_display.key_combo(names),
            lambda: gnome_shell_bridge.key_combo(names),
            lambda: bool(xdg_desktop_portal.key_combo(names).get("success")),
        )

    def _wheel(self, window: Dict[str, Any], steps: int) -> bool:
        center = window["center"]
        x = int(center["x"])
        y = int(center["y"])
        return self._dispatch(
            window,
            lambda: x11_display.wheel(x, y, steps),
            lambda: gnome_shell_bridge.wheel(x, y, steps),
            lambda: bool(xdg_desktop_portal.wheel(x, y, steps).get("success")),
        )

    def _scroll_bottom_keys(self, window: Dict[str, Any]) -> Optional[List[str]]:
        return [TERMINAL_KEY_SHIFT, TERMINAL_KEY_END]

    def _paste(self, window: Dict[str, Any]) -> bool:
        return self._keys(window, [TERMINAL_KEY_SHIFT, TERMINAL_KEY_INSERT])

    def _capture(self, regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        images: Dict[str, Any] = {}
        missing: List[Dict[str, Any]] = []
        for region in regions:
            window_id = str(region.get("id") or "")
            image = None
            if window_id.startswith(X11_WINDOW_PREFIX):
                image = x11_display.capture(int(window_id[len(X11_WINDOW_PREFIX):], 16))
            elif window_id.startswith(GNOME_WINDOW_PREFIX):
                png = gnome_shell_bridge.capture_png(window_id[len(GNOME_WINDOW_PREFIX):])
                image = Image.open(BytesIO(png)).convert("RGB") if png else None
            if image is not None:
                images[window_id] = image
            else:
                missing.append(region)
        if missing and current_desktop_session().is_wayland:
            images.update(xdg_desktop_portal.capture_regions(missing))
        return images

    @staticmethod
    def _dispatch(
        window: Dict[str, Any],
        x11_action: Callable[[], bool],
        bridge_action: Callable[[], bool],
        portal_action: Callable[[], bool],
    ) -> bool:
        control = str(window["control"])
        if control in (CONTROL_X11, CONTROL_XWAYLAND) and x11_action():
            return True
        if control == CONTROL_GNOME_BRIDGE and bridge_action():
            return True
        return current_desktop_session().is_wayland and portal_action()

    @staticmethod
    def _x11_terminal(window: X11Window, control: str) -> Dict[str, Any]:
        return build_terminal_window(
            f"{X11_WINDOW_PREFIX}{window.hex_id}",
            window.hex_id,
            window.title,
            window.wm_class,
            window.wm_class,
            window.process_id,
            window.active,
            window.x,
            window.y,
            window.width,
            window.height,
            control,
        )

    @staticmethod
    def _bridge_is_terminal(window: BridgeWindow) -> bool:
        return any(
            is_linux_terminal_class(value)
            for value in (window.wm_class, window.wm_class_instance, window.app_id)
            if value
        )

    @staticmethod
    def _bridge_terminal(window: BridgeWindow) -> Dict[str, Any]:
        class_name = ".".join(
            part for part in (window.wm_class_instance, window.wm_class) if part
        )
        return build_terminal_window(
            f"{GNOME_WINDOW_PREFIX}{window.window_id}",
            window.window_id,
            window.title,
            window.app_id or window.wm_class,
            class_name,
            window.process_id,
            window.focused,
            window.x,
            window.y,
            window.width,
            window.height,
            CONTROL_GNOME_BRIDGE,
        )

    @staticmethod
    def _introspect_terminals() -> List[Dict[str, Any]]:
        listing = gnome_shell_introspect.list_windows()
        return [
            build_terminal_window(
                f"{INTROSPECT_WINDOW_PREFIX}{item['window_id']}",
                item["window_id"],
                item["title"],
                item["app_id"] or item["wm_class"],
                item["wm_class"],
                0,
                item["focused"],
                0,
                0,
                item["width"],
                item["height"],
                CONTROL_NONE,
            )
            for item in listing["windows"]
            if item["client_type"] == "wayland"
            and (is_linux_terminal_class(item["wm_class"]) or is_linux_terminal_class(item["app_id"]))
        ]

    @staticmethod
    def _capabilities(session: DesktopSession) -> Dict[str, Dict[str, Any]]:
        x11_probe = (
            x11_display.probe()
            if session.has_x11_display
            else {"available": False, "error_code": "x11_display_unset"}
        )
        bridge_status = (
            gnome_shell_bridge.status()
            if session.is_gnome and session.is_wayland
            else {"available": False, "state": "gnome_bridge_not_applicable"}
        )
        introspect = (
            gnome_shell_introspect.list_windows()
            if session.is_gnome and not bridge_status.get("available")
            else {"available": False, "error_code": "gnome_introspect_not_needed"}
        )
        portal_status = (
            xdg_desktop_portal.status()
            if session.is_wayland
            else {"available": False, "error_code": "portal_not_applicable"}
        )
        return {
            CONTROL_X11: {
                "available": bool(x11_probe["available"]),
                "error_code": x11_probe.get("error_code"),
                "mode": CONTROL_XWAYLAND if session.is_wayland else CONTROL_X11,
            },
            CONTROL_GNOME_BRIDGE: {
                "available": bool(bridge_status.get("available")),
                "state": bridge_status.get("state"),
                "installed_version": bridge_status.get("installed_version", 0),
                "bundled_version": bridge_status.get("bundled_version", 0),
            },
            "gnome_introspect": {
                "available": bool(introspect.get("available")),
                "error_code": introspect.get("error_code"),
            },
            CONTROL_PORTAL: {
                "available": bool(portal_status.get("available")),
                "error_code": portal_status.get("error_code"),
                "authorized": bool(portal_status.get("authorized")),
                "session_active": bool(portal_status.get("session_active")),
            },
        }

    @staticmethod
    def _error_code(
        session: DesktopSession,
        capabilities: Dict[str, Dict[str, Any]],
        supported: bool,
    ) -> Optional[str]:
        if supported:
            return None
        if not session.has_display:
            return "graphical_session_unavailable"
        if session.is_gnome and session.is_wayland:
            return str(capabilities[CONTROL_GNOME_BRIDGE]["state"])
        return str(capabilities[CONTROL_X11]["error_code"] or "terminal_enumeration_failed")

    @staticmethod
    def _notice_code(
        session: DesktopSession,
        capabilities: Dict[str, Dict[str, Any]],
        windows: List[Dict[str, Any]],
    ) -> Optional[str]:
        if any(not window.get("controllable") for window in windows):
            return "terminal_windows_not_controllable"
        bridge_state = str(capabilities[CONTROL_GNOME_BRIDGE]["state"] or "")
        if session.is_gnome and session.is_wayland and bridge_state != BRIDGE_STATE_ACTIVE:
            return bridge_state
        return None


linux_terminal_backend = LinuxTerminalBackend()
