# -*- coding: utf-8 -*-
"""OS-level capture of a whole browser window (page, tab strip and docked DevTools): raise it first, then grab it.

Windows: Win32 window list + SetForegroundWindow + screen region grab.
Linux X11/Xwayland: X11 client list + activate + window image.
Linux GNOME Wayland: the pycore window bridge when active, else one desktop screenshot via the
xdg screenshot portal after the caller has focused the browser window.
Undocked DevTools windows of the same browser are captured as extra images where windows can be listed.
"""

from __future__ import annotations

import time
from io import BytesIO
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.desktop_session import current_desktop_session
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image
from pycore.pyutils.common.gnome_shell_dbus import gnome_shell_bridge
from pycore.pyutils.common.x11_display import x11_display
from pycore.pyutils.common.xdg_desktop_portal import xdg_desktop_portal
from pycore.pyutils.window.activator import WindowActivator
from pycore.pyutils.window.screen_capture import grab_screen_regions

LABEL = "BrowserWindowCapture"
WINDOWS_BROWSER_CLASSES = ("Chrome_WidgetWin_1",)
LINUX_BROWSER_CLASS_PARTS = ("chrome", "chromium", "brave", "msedge", "microsoft-edge", "vivaldi", "opera")
DEVTOOLS_TITLE_PREFIX = "DevTools"
RAISE_SETTLE_SECONDS = 0.5
METHOD_WIN32 = "win32"
METHOD_X11 = "x11"
METHOD_GNOME_BRIDGE = "gnome_bridge"
METHOD_PORTAL_SCREEN = "portal_screen"
ERROR_NO_WINDOW = "browser_window_not_found"
ERROR_CAPTURE_FAILED = "browser_window_capture_failed"


def _is_browser_class(class_name: str) -> bool:
    lowered = class_name.lower()
    return any(part in lowered for part in LINUX_BROWSER_CLASS_PARTS)


def _is_devtools(title: str) -> bool:
    return title.startswith(DEVTOOLS_TITLE_PREFIX)


def _pick_main(windows: List[Any], title_of: Callable[[Any], str], title_hint: str) -> Optional[Any]:
    """The browser window showing the hinted tab title, else the first non-DevTools browser window."""
    regular = [window for window in windows if not _is_devtools(title_of(window))]
    hint = title_hint.strip().lower()
    if hint:
        for window in regular:
            if hint in title_of(window).lower():
                return window
    return regular[0] if regular else None


class BrowserWindowCapture:
    def capture(self, title_hint: str = "") -> Dict[str, Any]:
        """Raise the browser window whose title contains `title_hint` and capture it.

        Returns {success, method, images: [{label, image (PIL RGB)}], error_code?}; never raises.
        """
        try:
            result = self._capture_win32(title_hint) if current_desktop_session().platform == "Windows" else self._capture_linux(title_hint)
        except Exception as exc:  # noqa: BLE001 - desktop APIs are an external boundary
            ColorPrint.yellow(f"[{LABEL}] capture raised: {type(exc).__name__}: {exc}")
            result = {"success": False, "error_code": ERROR_CAPTURE_FAILED, "images": []}
        return result

    @staticmethod
    def _result(method: str, images: List[Dict[str, Any]], error_code: str = ERROR_CAPTURE_FAILED) -> Dict[str, Any]:
        if images:
            return {"success": True, "method": method, "images": images}
        return {"success": False, "method": method, "images": [], "error_code": error_code}

    # ---- Windows ------------------------------------------------------------------

    def _capture_win32(self, title_hint: str) -> Dict[str, Any]:
        activator = WindowActivator()
        windows = [window for window in activator.list_visible_windows() if window["class"] in WINDOWS_BROWSER_CLASSES]
        main = _pick_main(windows, lambda window: str(window["title"]), title_hint)
        if main is None:
            return self._result(METHOD_WIN32, [], ERROR_NO_WINDOW)
        activator.activate_window_by_handle(int(main["handle"]))
        time.sleep(RAISE_SETTLE_SECONDS)
        targets = [main, *(window for window in windows if _is_devtools(str(window["title"])))]
        regions = []
        for index, window in enumerate(targets):
            left, top, right, bottom = window["rect"]
            regions.append({"id": str(index), "left": left, "top": top, "width": right - left, "height": bottom - top})
        grabbed = grab_screen_regions(regions)
        images = [
            {"label": str(targets[int(region_id)]["title"]), "image": image}
            for region_id, image in sorted(grabbed.items(), key=lambda item: int(item[0]))
        ]
        return self._result(METHOD_WIN32, images)

    # ---- Linux --------------------------------------------------------------------

    def _capture_linux(self, title_hint: str) -> Dict[str, Any]:
        session = current_desktop_session()
        if session.has_x11_display:
            result = self._capture_x11(title_hint)
            if result["success"] or not session.is_wayland:
                return result
        if session.is_wayland and session.is_gnome:
            result = self._capture_gnome_bridge(title_hint)
            if result["success"]:
                return result
        if session.is_wayland:
            return self._capture_portal_screen()
        return self._result(METHOD_X11, [], ERROR_NO_WINDOW)

    def _capture_x11(self, title_hint: str) -> Dict[str, Any]:
        windows = [window for window in x11_display.list_client_windows() or [] if _is_browser_class(window.wm_class)]
        main = _pick_main(windows, lambda window: window.title, title_hint)
        if main is None:
            return self._result(METHOD_X11, [], ERROR_NO_WINDOW)
        x11_display.activate(main.xid)
        time.sleep(RAISE_SETTLE_SECONDS)
        images = []
        for window in [main, *(window for window in windows if _is_devtools(window.title))]:
            image = x11_display.capture(window.xid)
            if image is not None:
                images.append({"label": window.title, "image": image})
        return self._result(METHOD_X11, images)

    def _capture_gnome_bridge(self, title_hint: str) -> Dict[str, Any]:
        if not gnome_shell_bridge.status().get("available"):
            return self._result(METHOD_GNOME_BRIDGE, [], ERROR_NO_WINDOW)
        windows = [
            window
            for window in gnome_shell_bridge.list_windows() or []
            if _is_browser_class(f"{window.wm_class} {window.app_id}")
        ]
        main = _pick_main(windows, lambda window: window.title, title_hint)
        if main is None:
            return self._result(METHOD_GNOME_BRIDGE, [], ERROR_NO_WINDOW)
        gnome_shell_bridge.activate(main.window_id)
        time.sleep(RAISE_SETTLE_SECONDS)
        Image = get_third_package_PIL_Image()
        images = []
        for window in [main, *(window for window in windows if _is_devtools(window.title))]:
            png = gnome_shell_bridge.capture_png(window.window_id)
            if png:
                images.append({"label": window.title, "image": Image.open(BytesIO(png)).convert("RGB")})
        return self._result(METHOD_GNOME_BRIDGE, images)

    def _capture_portal_screen(self) -> Dict[str, Any]:
        time.sleep(RAISE_SETTLE_SECONDS)
        frame = xdg_desktop_portal.capture_screen()
        images = [{"label": "screen", "image": frame}] if frame is not None else []
        return self._result(METHOD_PORTAL_SCREEN, images)


browser_window_capture = BrowserWindowCapture()

__all__ = ["BrowserWindowCapture", "browser_window_capture"]
