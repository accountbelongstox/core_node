# -*- coding: utf-8 -*-
from __future__ import annotations

import re
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pycore.pyutils.common.terminal_identifiers import (
    WINDOWS_TERMINAL_HOST_CLASS,
    WINDOWS_TERMINAL_PROCESS_NAMES,
    WINDOWS_TERMINAL_WINDOW_CLASSES,
    WSL_TERMINAL_PROCESS_NAMES,
)
from pycore.pyutils.window.ops import (
    bring_window_to_top,
    click_screen_point,
    enum_windows,
    get_cursor_position,
    get_foreground_window,
    get_window_class_name,
    get_window_process_name,
    get_window_rect,
    get_window_text,
    get_window_thread_process_id,
    get_wheel_scroll_lines,
    is_window_topmost,
    WM_COMMAND,
    post_window_message,
    press_native_key_combo,
    restore_foreground_window,
    scroll_mouse_wheel,
    set_cursor_position,
    set_window_text,
    set_window_topmost,
    show_window_without_activation,
)
from pycore.pyutils.window.screen_capture import grab_screen_regions
from pycore.pyutils.window.terminal_backend import (
    FOCUS_DELAY_SECONDS,
    FOCUS_READY_TIMEOUT_SECONDS,
    SCROLL_PAGE_KEYS,
    TERMINAL_KEY_CONTROL,
    TERMINAL_KEY_DOWN,
    TERMINAL_KEY_END,
    TERMINAL_KEY_ENTER,
    TERMINAL_KEY_ESCAPE,
    TERMINAL_KEY_PAGE_DOWN,
    TERMINAL_KEY_PAGE_UP,
    TERMINAL_KEY_SHIFT,
    TERMINAL_KEY_TAB,
    TERMINAL_KEY_UP,
    TerminalWindowBackend,
    build_terminal_window,
    failure,
    focus_entry,
)


WINDOW_ID_PREFIX = "win32:"
CONTROL_WIN32 = "win32"
FOCUS_SOURCE_WIN32 = "win32"
FOCUS_ERROR_NONE_FOCUSED = "no_focused_window"
NATIVE_KEY_NAMES = {
    TERMINAL_KEY_ENTER: "ENTER",
    TERMINAL_KEY_UP: "UP",
    TERMINAL_KEY_DOWN: "DOWN",
    TERMINAL_KEY_SHIFT: "SHIFT",
    TERMINAL_KEY_CONTROL: "CTRL",
    TERMINAL_KEY_END: "END",
    TERMINAL_KEY_PAGE_UP: "PRIOR",
    TERMINAL_KEY_PAGE_DOWN: "NEXT",
    TERMINAL_KEY_ESCAPE: "ESCAPE",
    TERMINAL_KEY_TAB: "TAB",
}
NATIVE_BUTTON_NAMES = {1: "left", 3: "right"}
# A Linux shell prompt or path in the tab title (user@host:..., ~/..., /path) marks a WSL shell.
LINUX_SHELL_TITLE_PATTERN = re.compile(r"(^|\s)[\w.-]+@[\w.-]+:|(^|\s)~(/|\s|$)|^/[\w.-]+/|\bwsl\b", re.IGNORECASE)
SHELL_OS_WINDOWS = "windows"
SHELL_OS_LINUX = "linux"
# Windows Terminal pastes on Ctrl+Shift+V. A classic console gets its own
# Edit > Paste command (WM_COMMAND 0xFFF1): a right-click would COPY a QuickEdit
# selection the activation click may have started instead of pasting.
WINDOWS_TERMINAL_PASTE_KEYS = ("CTRL", "SHIFT", "V")
CONSOLE_PASTE_COMMAND_ID = 0xFFF1
# Windows Terminal: selectAll (Ctrl+Shift+A) covers the whole buffer and copy
# (Ctrl+Shift+C) dismisses the selection. A classic console uses its Edit menu
# Select All / Copy commands, which also cover the scrollback.
CONSOLE_COPY_COMMAND_ID = 0xFFF0
CONSOLE_SELECT_ALL_COMMAND_ID = 0xFFF5


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

    def focused_window(self) -> Dict[str, Any]:
        native_id = get_foreground_window()
        if not native_id:
            return failure(FOCUS_ERROR_NONE_FOCUSED)
        return focus_entry(FOCUS_SOURCE_WIN32, f"{WINDOW_ID_PREFIX}{native_id}", str(native_id), get_window_text(native_id))

    def focus_window(self, focused: Dict[str, Any]) -> bool:
        return restore_foreground_window(int(focused["id"]))

    def pointer_position(self) -> Optional[Tuple[int, int]]:
        return get_cursor_position()

    def move_pointer(self, x: int, y: int) -> bool:
        return set_cursor_position(x, y)

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

    def _keys(self, window: Dict[str, Any], keysym_names: Sequence[str], hold_seconds: float = 0.0) -> bool:
        native_keys = [NATIVE_KEY_NAMES.get(name, name) for name in keysym_names]
        return press_native_key_combo(native_keys, hold_seconds)

    def _input_target_ready(self, window: Dict[str, Any]) -> bool:
        native_id = int(window["native_id"])
        deadline = time.monotonic() + FOCUS_READY_TIMEOUT_SECONDS
        while not self._owns_foreground(native_id, int(window.get("process_id") or 0)):
            if time.monotonic() >= deadline:
                return False
            restore_foreground_window(native_id)
            time.sleep(FOCUS_DELAY_SECONDS)
        return True

    @staticmethod
    def _owns_foreground(native_id: int, process_id: int) -> bool:
        foreground = get_foreground_window()
        if foreground == native_id:
            return True
        process_info = get_window_thread_process_id(foreground) if foreground else None
        return bool(process_id and process_info is not None and int(process_info[1]) == process_id)

    def _wheel(self, window: Dict[str, Any], steps: int) -> bool:
        return scroll_mouse_wheel(steps)

    def _wheel_lines(self) -> int:
        return get_wheel_scroll_lines()

    # Windows Terminal scrollUpPage / scrollDownPage default bindings; a classic
    # console scrolls its buffer on the wheel.
    def _scroll_page_keys(self, window: Dict[str, Any], mode: str) -> Optional[List[str]]:
        if self._is_terminal_host(window):
            return [TERMINAL_KEY_CONTROL, TERMINAL_KEY_SHIFT, SCROLL_PAGE_KEYS[mode]]
        return None

    def _scroll_bottom_keys(self, window: Dict[str, Any]) -> Optional[List[str]]:
        if self._is_terminal_host(window):
            return [TERMINAL_KEY_CONTROL, TERMINAL_KEY_SHIFT, TERMINAL_KEY_END]
        return None

    def _shell_os(self, window: Dict[str, Any]) -> str:
        if str(window.get("app") or "").lower() in WSL_TERMINAL_PROCESS_NAMES:
            return SHELL_OS_LINUX
        return SHELL_OS_LINUX if LINUX_SHELL_TITLE_PATTERN.search(str(window.get("title") or "")) else SHELL_OS_WINDOWS

    def _set_title(self, window: Dict[str, Any], title: str) -> bool:
        return set_window_text(int(window["native_id"]), title)

    def _paste(self, window: Dict[str, Any]) -> bool:
        if self._is_terminal_host(window):
            return press_native_key_combo(list(WINDOWS_TERMINAL_PASTE_KEYS))
        return self._console_command(window, CONSOLE_PASTE_COMMAND_ID)

    def _select_all(self, window: Dict[str, Any]) -> bool:
        if self._is_terminal_host(window):
            return super()._select_all(window)
        return self._console_command(window, CONSOLE_SELECT_ALL_COMMAND_ID)

    def _copy_selection(self, window: Dict[str, Any]) -> bool:
        if self._is_terminal_host(window):
            return super()._copy_selection(window)
        return self._console_command(window, CONSOLE_COPY_COMMAND_ID)

    @staticmethod
    def _is_terminal_host(window: Dict[str, Any]) -> bool:
        return str(window.get("class_name") or "").strip().lower() == WINDOWS_TERMINAL_HOST_CLASS.lower()

    @staticmethod
    def _console_command(window: Dict[str, Any], command_id: int) -> bool:
        return post_window_message(int(window["native_id"]), WM_COMMAND, command_id, 0)

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
