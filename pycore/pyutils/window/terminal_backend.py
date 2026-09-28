# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Optional, Sequence


TERMINAL_SCROLL_PAGE_UP = "page_up"
TERMINAL_SCROLL_PAGE_DOWN = "page_down"
TERMINAL_SCROLL_BOTTOM = "bottom"
TERMINAL_SCROLL_MODES = frozenset((
    TERMINAL_SCROLL_PAGE_UP,
    TERMINAL_SCROLL_PAGE_DOWN,
    TERMINAL_SCROLL_BOTTOM,
))
TERMINAL_SCROLL_LINE_HEIGHT_PX = 18
TERMINAL_SCROLL_CHROME_HEIGHT_PX = 36
TERMINAL_SCROLL_DEFAULT_LINES = 3
TERMINAL_SCROLL_BOTTOM_STEPS = 4096
FOCUS_DELAY_SECONDS = 0.05
PASTE_DELAY_SECONDS = 0.12
TERMINAL_HISTORY_DIRECTIONS = frozenset({"up", "down"})
TERMINAL_KEY_ENTER = "Return"
TERMINAL_KEY_UP = "Up"
TERMINAL_KEY_DOWN = "Down"
TERMINAL_KEY_SHIFT = "Shift_L"
TERMINAL_KEY_CONTROL = "Control_L"
TERMINAL_KEY_END = "End"
TERMINAL_KEY_INSERT = "Insert"
HISTORY_DIRECTION_KEYS = {
    "up": TERMINAL_KEY_UP,
    "down": TERMINAL_KEY_DOWN,
}
POINTER_BUTTON_LEFT = 1
POINTER_BUTTON_RIGHT = 3
CONTROL_NONE = "none"


def terminal_scroll_steps(
    mode: str,
    window_height: int,
    lines_per_step: int = TERMINAL_SCROLL_DEFAULT_LINES,
) -> int:
    if mode == TERMINAL_SCROLL_BOTTOM:
        return -TERMINAL_SCROLL_BOTTOM_STEPS
    content_height = max(
        TERMINAL_SCROLL_LINE_HEIGHT_PX,
        window_height - TERMINAL_SCROLL_CHROME_HEIGHT_PX,
    )
    visible_lines = max(1, content_height // TERMINAL_SCROLL_LINE_HEIGHT_PX)
    page_steps = 1 if lines_per_step < 0 else max(
        1,
        (visible_lines + max(1, lines_per_step) - 1) // max(1, lines_per_step),
    )
    return page_steps if mode == TERMINAL_SCROLL_PAGE_UP else -page_steps


def build_terminal_window(
    window_id: str,
    native_id: Any,
    title: str,
    app: str,
    class_name: str,
    process_id: int,
    active: bool,
    x: int,
    y: int,
    width: int,
    height: int,
    control: str,
) -> Dict[str, Any]:
    return {
        "id": window_id,
        "native_id": native_id,
        "title": title,
        "app": app,
        "class_name": class_name,
        "process_id": int(process_id),
        "active": bool(active),
        "control": control,
        "controllable": control != CONTROL_NONE,
        "rect": {"x": int(x), "y": int(y), "width": int(width), "height": int(height)},
        "center": {"x": int(x) + int(width) // 2, "y": int(y) + int(height) // 2},
    }


def failure(error_code: str, **extra: Any) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code, **extra}


def success(window: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    return {"success": True, "error_code": None, "window": window, **extra}


class TerminalWindowBackend:
    """Platform-neutral terminal operation flow; subclasses provide the desktop primitives."""

    platform_name = ""

    def snapshot(self) -> Dict[str, Any]:
        windows = self._list_windows()
        return {
            "success": True,
            "platform": self.platform_name,
            "count": len(windows),
            "windows": windows,
            **self._inventory_meta(windows),
        }

    def activate(self, window_id: str) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        center = window["center"]
        return self._pointer_action(
            window,
            int(center["x"]),
            int(center["y"]),
            POINTER_BUTTON_LEFT,
        )

    def click_at(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        rectangle = window["rect"]
        width = max(1, int(rectangle["width"]))
        height = max(1, int(rectangle["height"]))
        target_x = int(rectangle["x"]) + min(width - 1, max(0, int(horizontal_ratio * width)))
        target_y = int(rectangle["y"]) + min(height - 1, max(0, int(vertical_ratio * height)))
        return self._pointer_action(window, target_x, target_y, POINTER_BUTTON_LEFT)

    def navigate_history(self, window_id: str, direction: str) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        key = HISTORY_DIRECTION_KEYS.get(direction)
        if key is None:
            return failure("terminal_history_direction_invalid")
        if not self._keys(window, [key]):
            return failure("terminal_history_key_failed")
        return success(window)

    def press_enter(self, window_id: str) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        time.sleep(FOCUS_DELAY_SECONDS)
        if not self._keys(window, [TERMINAL_KEY_ENTER]):
            return failure("terminal_enter_failed")
        return success(window)

    def scroll(self, window_id: str, mode: str) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        if mode not in TERMINAL_SCROLL_MODES:
            return failure("terminal_scroll_mode_invalid")
        bottom_keys = self._scroll_bottom_keys(window) if mode == TERMINAL_SCROLL_BOTTOM else None
        if bottom_keys:
            scrolled = self._keys(window, bottom_keys)
        else:
            steps = terminal_scroll_steps(
                mode,
                int(window["rect"]["height"]),
                self._wheel_lines(),
            )
            scrolled = self._wheel(window, steps)
        if not scrolled:
            return failure("terminal_scroll_failed")
        return success(window)

    def paste_and_submit(self, window_id: str) -> Dict[str, Any]:
        window = self._find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        if not self._paste(window):
            return failure("terminal_paste_failed")
        time.sleep(PASTE_DELAY_SECONDS)
        return self.press_enter(window_id)

    def capture_windows(self, regions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return {window_id: PIL image} for the requested capture regions."""
        return self._capture(regions)

    def paste_uses_primary_selection(self) -> bool:
        return False

    def desktop_integration(self, action: str) -> Dict[str, Any]:
        return failure("unsupported_platform", action=action)

    def _pointer_action(
        self,
        window: Dict[str, Any],
        x: int,
        y: int,
        button: int,
    ) -> Dict[str, Any]:
        if not window.get("controllable", True):
            return failure("terminal_window_not_controllable", window=window)
        prepared = self._raise_window(window)
        if not prepared.get("success"):
            return failure(str(prepared.get("error_code") or "terminal_raise_failed"))
        clicked = self._click(window, x, y, button)
        released = self._release_window(window, prepared)
        if not clicked:
            return failure("terminal_click_failed")
        if not released:
            return failure("terminal_raise_failed")
        return success(window, point={"x": x, "y": y})

    def _find_window(self, window_id: str) -> Optional[Dict[str, Any]]:
        if not window_id:
            return None
        return next(
            (window for window in self._list_windows() if window["id"] == window_id),
            None,
        )

    def _list_windows(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def _inventory_meta(self, windows: List[Dict[str, Any]]) -> Dict[str, Any]:
        raise NotImplementedError

    def _raise_window(self, window: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def _release_window(self, window: Dict[str, Any], prepared: Dict[str, Any]) -> bool:
        return True

    def _click(self, window: Dict[str, Any], x: int, y: int, button: int) -> bool:
        raise NotImplementedError

    def _keys(self, window: Dict[str, Any], keysym_names: Sequence[str]) -> bool:
        raise NotImplementedError

    def _wheel(self, window: Dict[str, Any], steps: int) -> bool:
        raise NotImplementedError

    def _wheel_lines(self) -> int:
        return TERMINAL_SCROLL_DEFAULT_LINES

    def _scroll_bottom_keys(self, window: Dict[str, Any]) -> Optional[List[str]]:
        return None

    def _paste(self, window: Dict[str, Any]) -> bool:
        raise NotImplementedError

    def _capture(self, regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        raise NotImplementedError


class UnsupportedTerminalBackend(TerminalWindowBackend):
    def __init__(self, platform_name: str) -> None:
        self.platform_name = platform_name

    def _list_windows(self) -> List[Dict[str, Any]]:
        return []

    def _inventory_meta(self, windows: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "session": "unknown",
            "supported": False,
            "error_code": "unsupported_platform",
        }

    def activate(self, window_id: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def click_at(self, window_id: str, horizontal_ratio: float, vertical_ratio: float) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def navigate_history(self, window_id: str, direction: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def press_enter(self, window_id: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def scroll(self, window_id: str, mode: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def paste_and_submit(self, window_id: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def _capture(self, regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        return {}
