# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import re
import shutil
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyutils.common.terminal_identifiers import is_linux_terminal_class
from pycore.pyutils.window.terminal_backend import (
    TERMINAL_SCROLL_BOTTOM,
    TERMINAL_SCROLL_MODES,
    terminal_scroll_steps,
)


WINDOW_ID_PREFIX = "x11:"
FOCUS_DELAY_SECONDS = 0.05
PASTE_DELAY_SECONDS = 0.12
INTEGER_PATTERN = re.compile(r"^-?\d+$")
HEX_WINDOW_PATTERN = re.compile(r"^0x[0-9a-fA-F]+$")
HISTORY_DIRECTION_KEYS = {
    "up": "Up",
    "down": "Down",
}


class LinuxTerminalBackend:
    def snapshot(self) -> Dict[str, Any]:
        capability = self._capability()
        windows, enumerated = (
            self._list_terminal_windows()
            if capability["supported"]
            else ([], False)
        )
        supported = bool(capability["supported"] and enumerated)
        error_code = capability["error_code"]
        if capability["supported"] and not enumerated:
            error_code = "terminal_enumeration_failed"
        return {
            "success": True,
            "platform": "linux",
            "session": capability["session"],
            "supported": supported,
            "error_code": error_code,
            "count": len(windows),
            "windows": windows,
        }

    def activate(self, window_id: str) -> Dict[str, Any]:
        prepared = self._prepare_window(window_id)
        if not prepared["success"]:
            return self._failure(str(prepared["error_code"]))
        window = prepared["window"]
        xdotool_path = str(prepared["xdotool_path"])
        rectangle = window["rect"]
        center_x = int(rectangle["x"]) + int(rectangle["width"]) // 2
        center_y = int(rectangle["y"]) + int(rectangle["height"]) // 2
        moved = exec_silent([
            xdotool_path,
            "mousemove",
            "--sync",
            str(center_x),
            str(center_y),
        ])
        if not moved.success:
            return self._failure("terminal_pointer_move_failed")
        clicked = exec_silent([xdotool_path, "click", "1"])
        if not clicked.success:
            return self._failure("terminal_click_failed")
        return {"success": True, "error_code": None, "window": window}

    def click_at(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        prepared = self._prepare_window(window_id)
        if not prepared["success"]:
            return self._failure(str(prepared["error_code"]))
        window = prepared["window"]
        xdotool_path = str(prepared["xdotool_path"])
        rectangle = window["rect"]
        width = max(1, int(rectangle["width"]))
        height = max(1, int(rectangle["height"]))
        target_x = int(rectangle["x"]) + min(
            width - 1,
            max(0, int(horizontal_ratio * width)),
        )
        target_y = int(rectangle["y"]) + min(
            height - 1,
            max(0, int(vertical_ratio * height)),
        )
        moved = exec_silent([
            xdotool_path,
            "mousemove",
            "--sync",
            str(target_x),
            str(target_y),
        ])
        if not moved.success:
            return self._failure("terminal_pointer_move_failed")
        clicked = exec_silent([xdotool_path, "click", "1"])
        if not clicked.success:
            return self._failure("terminal_click_failed")
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
        capability = self._capability()
        key = HISTORY_DIRECTION_KEYS.get(direction)
        if not capability["supported"]:
            return self._failure(str(capability["error_code"]))
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")
        if key is None:
            return self._failure("terminal_history_direction_invalid")
        pressed = exec_silent([
            str(capability["xdotool_path"]),
            "key",
            key,
        ])
        if not pressed.success:
            return self._failure("terminal_history_key_failed")
        return {"success": True, "error_code": None, "window": window}

    def scroll(
        self,
        window_id: str,
        mode: str,
    ) -> Dict[str, Any]:
        capability = self._capability()
        if not capability["supported"]:
            return self._failure(str(capability["error_code"]))
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")
        if mode not in TERMINAL_SCROLL_MODES:
            return self._failure("terminal_scroll_mode_invalid")
        if mode == TERMINAL_SCROLL_BOTTOM:
            scrolled = exec_silent([
                str(capability["xdotool_path"]),
                "key",
                "shift+End",
            ])
            if not scrolled.success:
                return self._failure("terminal_scroll_failed")
            return {"success": True, "error_code": None, "window": window}
        steps = terminal_scroll_steps(
            mode,
            int(window["rect"]["height"]),
        )
        button = "4" if steps > 0 else "5"
        scrolled = exec_silent([
            str(capability["xdotool_path"]),
            "click",
            "--repeat",
            str(abs(steps)),
            "--delay",
            "0",
            button,
        ])
        if not scrolled.success:
            return self._failure("terminal_scroll_failed")
        return {"success": True, "error_code": None, "window": window}

    def paste_and_submit(self, window_id: str) -> Dict[str, Any]:
        capability = self._capability()
        if not capability["supported"]:
            return self._failure(str(capability["error_code"]))
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")

        rectangle = window["rect"]
        center_x = int(rectangle["x"]) + int(rectangle["width"]) // 2
        center_y = int(rectangle["y"]) + int(rectangle["height"]) // 2
        xdotool_path = str(capability["xdotool_path"])
        moved = exec_silent([
            xdotool_path,
            "mousemove",
            "--sync",
            str(center_x),
            str(center_y),
        ])
        if not moved.success:
            return self._failure("terminal_pointer_move_failed")
        clicked = exec_silent([xdotool_path, "click", "3"])
        if not clicked.success:
            return self._failure("terminal_right_click_failed")
        time.sleep(PASTE_DELAY_SECONDS)
        entered = exec_silent([xdotool_path, "key", "Return"])
        if not entered.success:
            return self._failure("terminal_enter_failed")
        return {"success": True, "error_code": None, "window": window}

    def _prepare_window(self, window_id: str) -> Dict[str, Any]:
        capability = self._capability()
        if not capability["supported"]:
            return self._failure(str(capability["error_code"]))
        window = self._find_terminal_window(window_id)
        if window is None:
            return self._failure("terminal_window_not_found")

        native_id = str(window["native_id"])
        wmctrl_path = str(capability["wmctrl_path"])
        xdotool_path = str(capability["xdotool_path"])
        mapped = exec_silent([xdotool_path, "windowmap", "--sync", native_id])
        if not mapped.success:
            return self._failure("terminal_restore_failed")
        wm_activated = exec_silent([wmctrl_path, "-i", "-a", native_id])
        x11_activated = exec_silent([xdotool_path, "windowactivate", native_id])
        raised = exec_silent([xdotool_path, "windowraise", native_id])
        if not (wm_activated.success or x11_activated.success or raised.success):
            return self._failure("terminal_raise_failed")
        time.sleep(FOCUS_DELAY_SECONDS)
        refreshed_window = self._find_terminal_window(window_id)
        return {
            "success": True,
            "error_code": None,
            "window": refreshed_window or window,
            "xdotool_path": xdotool_path,
        }

    def _capability(self) -> Dict[str, Any]:
        session = self._session_type()
        wmctrl_path = shutil.which("wmctrl")
        xdotool_path = shutil.which("xdotool")
        if session == "wayland":
            return self._capability_result(
                session,
                False,
                "wayland_global_control_unavailable",
                wmctrl_path,
                xdotool_path,
            )
        if not os.environ.get("DISPLAY"):
            return self._capability_result(
                session,
                False,
                "graphical_session_unavailable",
                wmctrl_path,
                xdotool_path,
            )
        if wmctrl_path is None:
            return self._capability_result(
                session,
                False,
                "wmctrl_unavailable",
                wmctrl_path,
                xdotool_path,
            )
        if xdotool_path is None:
            return self._capability_result(
                session,
                False,
                "xdotool_unavailable",
                wmctrl_path,
                xdotool_path,
            )
        return self._capability_result(
            session,
            True,
            None,
            wmctrl_path,
            xdotool_path,
        )

    def _list_terminal_windows(self) -> Tuple[List[Dict[str, Any]], bool]:
        capability = self._capability()
        wmctrl_path = str(capability["wmctrl_path"])
        xdotool_path = str(capability["xdotool_path"])
        active_result = exec_silent([xdotool_path, "getactivewindow"])
        active_id = int(active_result.stdout.strip()) if (
            active_result.success and active_result.stdout.strip().isdecimal()
        ) else 0
        result = exec_silent([wmctrl_path, "-l", "-p", "-G", "-x"])
        if not result.success:
            return [], False

        windows: List[Dict[str, Any]] = []
        for line in result.stdout.splitlines():
            window = self._parse_wmctrl_line(line, active_id)
            if window is not None:
                windows.append(window)
        windows.sort(key=lambda item: (
            int(item["rect"]["y"]),
            int(item["rect"]["x"]),
            str(item["title"]).lower(),
            str(item["native_id"]),
        ))
        return windows, True

    def _parse_wmctrl_line(
        self,
        line: str,
        active_id: int,
    ) -> Optional[Dict[str, Any]]:
        parts = line.split(None, 9)
        if len(parts) < 9:
            return None
        (
            native_id,
            _desktop,
            process_id_text,
            x_text,
            y_text,
            width_text,
            height_text,
            class_name,
            _host,
        ) = parts[:9]
        title = parts[9] if len(parts) > 9 else ""
        numeric_values = (process_id_text, x_text, y_text, width_text, height_text)
        if not HEX_WINDOW_PATTERN.match(native_id):
            return None
        if not all(INTEGER_PATTERN.match(value) for value in numeric_values):
            return None
        if not is_linux_terminal_class(class_name):
            return None

        process_id = int(process_id_text)
        x = int(x_text)
        y = int(y_text)
        width = int(width_text)
        height = int(height_text)
        if width <= 0 or height <= 0:
            return None
        numeric_id = int(native_id, 16)
        return {
            "id": f"{WINDOW_ID_PREFIX}{native_id.lower()}",
            "native_id": native_id.lower(),
            "title": title,
            "app": class_name,
            "class_name": class_name,
            "process_id": process_id,
            "active": numeric_id == active_id,
            "rect": {
                "x": x,
                "y": y,
                "width": width,
                "height": height,
            },
            "center": {
                "x": x + width // 2,
                "y": y + height // 2,
            },
        }

    def _find_terminal_window(self, window_id: str) -> Optional[Dict[str, Any]]:
        if not window_id.startswith(WINDOW_ID_PREFIX):
            return None
        native_id = window_id[len(WINDOW_ID_PREFIX):]
        if not HEX_WINDOW_PATTERN.match(native_id):
            return None
        normalized_id = native_id.lower()
        windows, enumerated = self._list_terminal_windows()
        if not enumerated:
            return None
        for window in windows:
            if str(window["native_id"]) == normalized_id:
                return window
        return None

    @staticmethod
    def _session_type() -> str:
        configured = str(os.environ.get("XDG_SESSION_TYPE") or "").strip().lower()
        if configured:
            return configured
        if os.environ.get("WAYLAND_DISPLAY"):
            return "wayland"
        if os.environ.get("DISPLAY"):
            return "x11"
        return "unknown"

    @staticmethod
    def _capability_result(
        session: str,
        supported: bool,
        error_code: Optional[str],
        wmctrl_path: Optional[str],
        xdotool_path: Optional[str],
    ) -> Dict[str, Any]:
        return {
            "session": session,
            "supported": supported,
            "error_code": error_code,
            "wmctrl_path": wmctrl_path,
            "xdotool_path": xdotool_path,
        }

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


linux_terminal_backend = LinuxTerminalBackend()
