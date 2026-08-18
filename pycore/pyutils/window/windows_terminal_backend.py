# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

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
    press_native_key,
    press_native_key_combo,
    scroll_mouse_wheel,
    set_window_topmost,
    show_window_without_activation,
)
from pycore.pyutils.window.terminal_backend import (
    TERMINAL_SCROLL_BOTTOM,
    TERMINAL_SCROLL_MODES,
    terminal_scroll_steps,
)


WINDOW_ID_PREFIX = "win32:"
FOCUS_DELAY_SECONDS = 0.05
PASTE_DELAY_SECONDS = 0.12
HISTORY_DIRECTION_KEYS = {
    "up": "UP",
    "down": "DOWN",
}


class WindowsTerminalBackend:
    def snapshot(self) -> Dict[str, Any]:
        windows = self._list_terminal_windows()
        return {
            "success": True,
            "platform": "windows",
            "session": "win32",
            "supported": True,
            "error_code": None,
            "count": len(windows),
            "windows": windows,
        }

    def activate(self, window_id: str) -> Dict[str, Any]:
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")
        prepared = self._prepare_window(window)
        if not prepared["success"]:
            return self._failure(str(prepared["error_code"]))
        rectangle = prepared["rect"]
        left, top, right, bottom = rectangle
        center_x = left + max(1, right - left) // 2
        center_y = top + max(1, bottom - top) // 2
        clicked = click_screen_point(center_x, center_y, "left")
        topmost_restored = self._restore_topmost(prepared)
        if not clicked:
            return self._failure("terminal_click_failed")
        if not topmost_restored:
            return self._failure("terminal_raise_failed")
        return {"success": True, "error_code": None, "window": window}

    def click_at(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")
        prepared = self._prepare_window(window)
        if not prepared["success"]:
            return self._failure(str(prepared["error_code"]))

        left, top, right, bottom = prepared["rect"]
        width = max(1, right - left)
        height = max(1, bottom - top)
        target_x = left + min(width - 1, max(0, int(horizontal_ratio * width)))
        target_y = top + min(height - 1, max(0, int(vertical_ratio * height)))
        clicked = click_screen_point(target_x, target_y, "left")
        topmost_restored = self._restore_topmost(prepared)
        if not clicked:
            return self._failure("terminal_click_failed")
        if not topmost_restored:
            return self._failure("terminal_raise_failed")
        return {
            "success": True,
            "error_code": None,
            "window": window,
            "point": {"x": target_x, "y": target_y},
        }

    def navigate_history(
        self,
        window_id: str,
        direction: str,
    ) -> Dict[str, Any]:
        window = self._find_terminal_window(window_id)
        key = HISTORY_DIRECTION_KEYS.get(direction)
        if window is None:
            return self._failure("terminal_window_not_found")
        if key is None:
            return self._failure("terminal_history_direction_invalid")
        if not press_native_key(key):
            return self._failure("terminal_history_key_failed")
        return {"success": True, "error_code": None, "window": window}

    def scroll(
        self,
        window_id: str,
        mode: str,
    ) -> Dict[str, Any]:
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")
        if mode not in TERMINAL_SCROLL_MODES:
            return self._failure("terminal_scroll_mode_invalid")
        if (
            mode == TERMINAL_SCROLL_BOTTOM
            and str(window.get("class_name") or "").strip().lower()
            == WINDOWS_TERMINAL_HOST_CLASS.lower()
        ):
            if not press_native_key_combo(["CTRL", "SHIFT", "END"]):
                return self._failure("terminal_scroll_failed")
            return {"success": True, "error_code": None, "window": window}
        rectangle = window["rect"]
        steps = terminal_scroll_steps(
            mode,
            int(rectangle["height"]),
            get_wheel_scroll_lines(),
        )
        if not scroll_mouse_wheel(steps):
            return self._failure("terminal_scroll_failed")
        return {"success": True, "error_code": None, "window": window}

    def paste_and_submit(self, window_id: str) -> Dict[str, Any]:
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")

        native_id = int(window["native_id"])
        rectangle = get_window_rect(native_id)
        if rectangle is None:
            return self._failure("terminal_coordinates_unavailable")

        left, top, right, bottom = rectangle
        center_x = left + max(1, right - left) // 2
        center_y = top + max(1, bottom - top) // 2
        if not click_screen_point(center_x, center_y, "right"):
            return self._failure("terminal_right_click_failed")
        time.sleep(PASTE_DELAY_SECONDS)
        if not press_native_key("ENTER"):
            return self._failure("terminal_enter_failed")
        return {"success": True, "error_code": None, "window": window}

    @staticmethod
    def _prepare_window(window: Dict[str, Any]) -> Dict[str, Any]:
        native_id = int(window["native_id"])
        was_topmost = is_window_topmost(native_id)
        show_window_without_activation(native_id)
        time.sleep(FOCUS_DELAY_SECONDS)
        if not bring_window_to_top(native_id):
            if not was_topmost:
                set_window_topmost(native_id, False)
            return {"success": False, "error_code": "terminal_raise_failed"}
        time.sleep(FOCUS_DELAY_SECONDS)
        rectangle = get_window_rect(native_id)
        if rectangle is None:
            if not was_topmost:
                set_window_topmost(native_id, False)
            return {
                "success": False,
                "error_code": "terminal_coordinates_unavailable",
            }
        return {
            "success": True,
            "error_code": None,
            "native_id": native_id,
            "was_topmost": was_topmost,
            "rect": rectangle,
        }

    @staticmethod
    def _restore_topmost(prepared: Dict[str, Any]) -> bool:
        return bool(prepared["was_topmost"]) or set_window_topmost(
            int(prepared["native_id"]),
            False,
        )

    def _list_terminal_windows(self) -> List[Dict[str, Any]]:
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
        return {
            "id": f"{WINDOW_ID_PREFIX}{native_id}",
            "native_id": native_id,
            "title": title,
            "app": process_name or class_name,
            "class_name": class_name,
            "process_id": process_id,
            "active": native_id == foreground,
            "rect": {
                "x": left,
                "y": top,
                "width": width,
                "height": height,
            },
            "center": {
                "x": left + width // 2,
                "y": top + height // 2,
            },
        }

    def _find_terminal_window(self, window_id: str) -> Optional[Dict[str, Any]]:
        native_id = self._parse_window_id(window_id)
        if native_id is None:
            return None
        foreground = get_foreground_window()
        for current_id, title in enum_windows():
            if int(current_id) == native_id:
                return self._build_terminal_window(native_id, title, foreground)
        return None

    @staticmethod
    def _parse_window_id(window_id: str) -> Optional[int]:
        if not window_id.startswith(WINDOW_ID_PREFIX):
            return None
        value = window_id[len(WINDOW_ID_PREFIX):]
        if not value.isdecimal():
            return None
        return int(value)

    @staticmethod
    def _is_terminal(class_name: str, process_name: str) -> bool:
        normalized_class = class_name.strip().lower()
        normalized_process = process_name.strip().lower()
        return (
            normalized_class in WINDOWS_TERMINAL_WINDOW_CLASSES
            or normalized_process in WINDOWS_TERMINAL_PROCESS_NAMES
        )

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


windows_terminal_backend = WindowsTerminalBackend()
