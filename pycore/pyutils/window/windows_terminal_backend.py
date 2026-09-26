# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Optional, Sequence

from pycore.pyutils.common.terminal_identifiers import (
    WINDOWS_TERMINAL_HOST_CLASS,
    WINDOWS_TERMINAL_PROCESS_NAMES,
    WINDOWS_TERMINAL_WINDOW_CLASSES,
)
from pycore.pyutils.window.ops import (
    bring_window_to_top,
    click_screen_point,
    enum_windows,
    get_foreground_window,
    get_window_class_name,
    get_window_process_name,
    get_window_rect,
    get_window_thread_process_id,
    get_wheel_scroll_lines,
    is_window_topmost,
    press_native_key_combo,
    scroll_mouse_wheel,
    set_window_topmost,
    show_window_without_activation,
)
from pycore.pyutils.window.screen_capture import grab_screen_regions
from pycore.pyutils.window.terminal_backend import (
    FOCUS_DELAY_SECONDS,
    TERMINAL_KEY_CONTROL,
    TERMINAL_KEY_DOWN,
    TERMINAL_KEY_END,
    TERMINAL_KEY_ENTER,
    TERMINAL_KEY_SHIFT,
    TERMINAL_KEY_UP,
    TerminalWindowBackend,
    build_terminal_window,
)


WINDOW_ID_PREFIX = "win32:"
CONTROL_WIN32 = "win32"
NATIVE_KEY_NAMES = {
    TERMINAL_KEY_ENTER: "ENTER",
    TERMINAL_KEY_UP: "UP",
    TERMINAL_KEY_DOWN: "DOWN",
    TERMINAL_KEY_SHIFT: "SHIFT",
    TERMINAL_KEY_CONTROL: "CTRL",
    TERMINAL_KEY_END: "END",
}
NATIVE_BUTTON_NAMES = {1: "left", 3: "right"}


class WindowsTerminalBackend(TerminalWindowBackend):
    platform_name = "windows"

    def _list_windows(self) -> List[Dict[str, Any]]:
        foreground = get_foreground_window()
        windows: List[Dict[str, Any]] = []
        for native_id, title in enum_windows():
            window = self._build_terminal_window(int(native_id), title, foreground)
            if window is not None:
                windows.append(window)
        windows.sort(key=lambda item: (
            int(item["rect"]["y"]),
            int(item["rect"]["x"]),
            str(item["title"]).lower(),
            int(item["native_id"]),
        ))
        return windows

    def _inventory_meta(self, windows: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "session": CONTROL_WIN32,
            "supported": True,
            "error_code": None,
            "control_modes": [CONTROL_WIN32],
        }

    def _raise_window(self, window: Dict[str, Any]) -> Dict[str, Any]:
        native_id = int(window["native_id"])
        was_topmost = is_window_topmost(native_id)
        show_window_without_activation(native_id)
        time.sleep(FOCUS_DELAY_SECONDS)
        if not bring_window_to_top(native_id):
            if not was_topmost:
                set_window_topmost(native_id, False)
            return {"success": False, "error_code": "terminal_raise_failed"}
        time.sleep(FOCUS_DELAY_SECONDS)
        if get_window_rect(native_id) is None:
            if not was_topmost:
                set_window_topmost(native_id, False)
            return {"success": False, "error_code": "terminal_coordinates_unavailable"}
        return {"success": True, "was_topmost": was_topmost}

    def _release_window(self, window: Dict[str, Any], prepared: Dict[str, Any]) -> bool:
        return bool(prepared["was_topmost"]) or set_window_topmost(
            int(window["native_id"]),
            False,
        )

    def _click(self, window: Dict[str, Any], x: int, y: int, button: int) -> bool:
        return click_screen_point(x, y, NATIVE_BUTTON_NAMES.get(button, "left"))

    def _keys(self, window: Dict[str, Any], keysym_names: Sequence[str]) -> bool:
        native_keys = [NATIVE_KEY_NAMES.get(name, name) for name in keysym_names]
        return press_native_key_combo(native_keys)

    def _wheel(self, window: Dict[str, Any], steps: int) -> bool:
        return scroll_mouse_wheel(steps)

    def _wheel_lines(self) -> int:
        return get_wheel_scroll_lines()

    def _scroll_bottom_keys(self, window: Dict[str, Any]) -> Optional[List[str]]:
        if str(window.get("class_name") or "").strip().lower() == WINDOWS_TERMINAL_HOST_CLASS.lower():
            return [TERMINAL_KEY_CONTROL, TERMINAL_KEY_SHIFT, TERMINAL_KEY_END]
        return None

    def _paste(self, window: Dict[str, Any]) -> bool:
        rectangle = get_window_rect(int(window["native_id"]))
        if rectangle is None:
            return False
        left, top, right, bottom = rectangle
        return click_screen_point(
            left + max(1, right - left) // 2,
            top + max(1, bottom - top) // 2,
            "right",
        )

    def _capture(self, regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        return grab_screen_regions(list(regions))

    def _build_terminal_window(
        self,
        native_id: int,
        title: str,
        foreground: int,
    ) -> Optional[Dict[str, Any]]:
        class_name = get_window_class_name(native_id)
        process_info = get_window_thread_process_id(native_id)
        process_id = int(process_info[1]) if process_info is not None else 0
        process_name = get_window_process_name(process_id)
        if not self._is_terminal(class_name, process_name):
            return None
        rectangle = get_window_rect(native_id)
        if rectangle is None:
            return None
        left, top, right, bottom = rectangle
        width = max(0, right - left)
        height = max(0, bottom - top)
        if width == 0 or height == 0:
            return None
        return build_terminal_window(
            f"{WINDOW_ID_PREFIX}{native_id}",
            native_id,
            title,
            process_name or class_name,
            class_name,
            process_id,
            native_id == foreground,
            left,
            top,
            width,
            height,
            CONTROL_WIN32,
        )

    @staticmethod
    def _is_terminal(class_name: str, process_name: str) -> bool:
        return (
            class_name.strip().lower() in WINDOWS_TERMINAL_WINDOW_CLASSES
            or process_name.strip().lower() in WINDOWS_TERMINAL_PROCESS_NAMES
        )


windows_terminal_backend = WindowsTerminalBackend()
