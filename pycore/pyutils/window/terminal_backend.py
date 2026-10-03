# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from contextlib import nullcontext
from typing import Any, ContextManager, Dict, Iterable, List, Optional, Sequence, Tuple

from pycore.pyutils.window.screen_capture import get_primary_monitor_rect


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
# Enter must reach the terminal application as its own input event: a bracketed
# paste (Claude Code, shells) swallows or merges an Enter that arrives while the
# paste is still being consumed, so the settle time grows with the pasted text.
PASTE_SETTLE_BASE_SECONDS = 0.3
PASTE_SETTLE_PER_CHARACTER_SECONDS = 0.0004
PASTE_SETTLE_MAX_SECONDS = 3.0
ENTER_HOLD_SECONDS = 0.04
# A pasted message is submitted with several Enters: an agent still consuming the paste
# can swallow the first one; Enter on an already empty prompt does nothing.
SUBMIT_ENTER_PRESSES = 3
SUBMIT_ENTER_INTERVAL_SECONDS = 0.5
# Before a message is pasted, a few Enters move an agent past a confirmation screen ("Do you want
# to proceed? 1. Yes") it may be stuck on; Enter on an empty prompt does nothing.
PRE_SUBMIT_ENTER_PRESSES = 3
PRE_SUBMIT_ENTER_INTERVAL_SECONDS = 0.3
FOCUS_READY_TIMEOUT_SECONDS = 1.0
SELECT_ALL_DELAY_SECONDS = 0.15
TERMINAL_HISTORY_DIRECTIONS = frozenset({"up", "down"})
TERMINAL_KEY_ENTER = "Return"
TERMINAL_KEY_UP = "Up"
TERMINAL_KEY_DOWN = "Down"
TERMINAL_KEY_SHIFT = "Shift_L"
TERMINAL_KEY_CONTROL = "Control_L"
TERMINAL_KEY_END = "End"
TERMINAL_KEY_INSERT = "Insert"
TERMINAL_KEY_A = "a"
TERMINAL_KEY_C = "c"
TERMINAL_KEY_K = "k"
TERMINAL_KEY_U = "u"
TERMINAL_KEY_PAGE_UP = "Prior"
TERMINAL_KEY_PAGE_DOWN = "Next"
TERMINAL_KEY_ESCAPE = "Escape"
TERMINAL_KEY_TAB = "Tab"
HISTORY_DIRECTION_KEYS = {
    "up": TERMINAL_KEY_UP,
    "down": TERMINAL_KEY_DOWN,
}
SCROLL_PAGE_KEYS = {
    TERMINAL_SCROLL_PAGE_UP: TERMINAL_KEY_PAGE_UP,
    TERMINAL_SCROLL_PAGE_DOWN: TERMINAL_KEY_PAGE_DOWN,
}
# Quick keys sent to the terminal application as-is.
TERMINAL_KEY_ACTIONS = {
    "escape": (TERMINAL_KEY_ESCAPE,),
    "ctrl_c": (TERMINAL_KEY_CONTROL, TERMINAL_KEY_C),
    "tab": (TERMINAL_KEY_TAB,),
    "shift_tab": (TERMINAL_KEY_SHIFT, TERMINAL_KEY_TAB),
}
# Clears the input line before a paste: Ctrl+K deletes to the line end, repeated
# Ctrl+U deletes to the line start across lines (Claude Code multiline input,
# readline shells). Ctrl+C / Esc are not used: they interrupt a running turn.
CLEAR_INPUT_LINE_END_KEYS = (TERMINAL_KEY_CONTROL, TERMINAL_KEY_K)
CLEAR_INPUT_LINE_START_KEYS = (TERMINAL_KEY_CONTROL, TERMINAL_KEY_U)
CLEAR_INPUT_LINE_START_REPEAT = 32
CLEAR_INPUT_SETTLE_SECONDS = 0.15
# A shell prompt (quick commands) of a Windows shell is cleared with Esc: PSReadLine
# and cmd treat Ctrl+K / Ctrl+U as literal ^K / ^U characters.
CLEAR_WINDOWS_SHELL_KEYS = (TERMINAL_KEY_ESCAPE,)
SHELL_OS_WINDOWS = "windows"
SHELL_OS_LINUX = "linux"
# Force run: Ctrl+C stops the running command, then the input line is cleared.
INTERRUPT_KEYS = (TERMINAL_KEY_CONTROL, TERMINAL_KEY_C)
INTERRUPT_SETTLE_SECONDS = 0.5
# Agent choice menus (Claude Code, Codex, Kimi...) start on the first option; Down moves one row.
OPTION_STEP_SECONDS = 0.06
POINTER_BUTTON_LEFT = 1
POINTER_BUTTON_RIGHT = 3
CONTROL_NONE = "none"
FOCUS_UNSUPPORTED = "focus_unsupported"
DESKTOP_WINDOW_ID = "desktop"
# Desktop view key ids (UI) -> key names the backends press; a single a-z / 0-9 character is its own name.
DESKTOP_KEY_NAMES = {
    "enter": TERMINAL_KEY_ENTER,
    "escape": "Escape",
    "tab": "Tab",
    "backspace": "BackSpace",
    "delete": "Delete",
    "space": "space",
    "up": TERMINAL_KEY_UP,
    "down": TERMINAL_KEY_DOWN,
    "left": "Left",
    "right": "Right",
    "home": "Home",
    "end": "End",
    "page_up": "Prior",
    "page_down": "Next",
    "ctrl": "Control_L",
    "alt": "Alt_L",
    "shift": "Shift_L",
}
DESKTOP_KEY_MAX_COMBO = 4


def focus_entry(source: str, key: str, window_id: str, title: str, restorable: bool = True, **extra: Any) -> Dict[str, Any]:
    """The window holding the input focus; key identifies it across backends (same X11 window via bridge or Xlib)."""
    return {
        "success": True,
        "error_code": None,
        "source": source,
        "key": key,
        "id": window_id,
        "title": title,
        "restorable": restorable,
        **extra,
    }


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


def paste_settle_seconds(content_length: int) -> float:
    return min(
        PASTE_SETTLE_MAX_SECONDS,
        PASTE_SETTLE_BASE_SECONDS + max(0, int(content_length)) * PASTE_SETTLE_PER_CHARACTER_SECONDS,
    )


def failure(error_code: str, **extra: Any) -> Dict[str, Any]:
    return {"success": False, "error_code": error_code, **extra}


def success(window: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    return {"success": True, "error_code": None, "window": window, **extra}


class TerminalWindowBackend:
    """Platform-neutral terminal operation flow; subclasses provide the desktop primitives."""

    platform_name = ""

    def snapshot(self) -> Dict[str, Any]:
        windows = self._list_windows()
        for window in windows:
            window.setdefault("shell_os", self._shell_os(window))
        return {
            "success": True,
            "platform": self.platform_name,
            "count": len(windows),
            "windows": windows,
            **self._inventory_meta(windows),
        }

    def activate(self, window_id: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
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
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        rectangle = window["rect"]
        width = max(1, int(rectangle["width"]))
        height = max(1, int(rectangle["height"]))
        target_x = int(rectangle["x"]) + min(width - 1, max(0, int(horizontal_ratio * width)))
        target_y = int(rectangle["y"]) + min(height - 1, max(0, int(vertical_ratio * height)))
        return self._pointer_action(window, target_x, target_y, POINTER_BUTTON_LEFT)

    # Minimum seconds between two real desktop grabs; viewers polling faster reuse the last frame.
    desktop_capture_interval_seconds = 0.0

    def capture_desktop(self) -> Optional[Dict[str, Any]]:
        """{image, rect} of the primary monitor, or None when the screen cannot be grabbed."""
        rect = get_primary_monitor_rect()
        if rect is None:
            return None
        region = {
            "id": DESKTOP_WINDOW_ID,
            "left": rect["x"],
            "top": rect["y"],
            "width": rect["width"],
            "height": rect["height"],
        }
        image = self._capture([region]).get(DESKTOP_WINDOW_ID)
        return None if image is None else {"image": image, "rect": rect}

    def desktop_click(
        self,
        horizontal_ratio: float,
        vertical_ratio: float,
        button: int = POINTER_BUTTON_LEFT,
        clicks: int = 1,
    ) -> Dict[str, Any]:
        rect = get_primary_monitor_rect()
        if rect is None:
            return failure("terminal_coordinates_unavailable")
        window = self._desktop_window()
        blocked = self._input_blocked(window)
        if blocked:
            return failure(blocked, window=window)
        width = max(1, int(rect["width"]))
        height = max(1, int(rect["height"]))
        target_x = int(rect["x"]) + min(width - 1, max(0, int(horizontal_ratio * width)))
        target_y = int(rect["y"]) + min(height - 1, max(0, int(vertical_ratio * height)))
        for _index in range(max(1, int(clicks))):
            if not self._click(window, target_x, target_y, button):
                return failure("terminal_click_failed")
        return success(window, point={"x": target_x, "y": target_y})

    def desktop_key(self, key_names: Sequence[str]) -> Dict[str, Any]:
        window = self._desktop_window()
        blocked = self._input_blocked(window)
        if blocked:
            return failure(blocked, window=window)
        with self._input_guard():
            if not self._keys(window, list(key_names)):
                return failure("terminal_key_failed")
        return success(window)

    def _desktop_window(self) -> Dict[str, Any]:
        """Synthetic window standing for the whole desktop, for the pointer / key primitives."""
        return {
            "id": DESKTOP_WINDOW_ID,
            "native_id": "0",
            "control": CONTROL_NONE,
            "controllable": True,
            "process_id": 0,
        }

    def navigate_history(self, window_id: str, direction: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        key = HISTORY_DIRECTION_KEYS.get(direction)
        if key is None:
            return failure("terminal_history_direction_invalid")
        with self._input_guard():
            sent = self._keys(window, [key])
        if not sent:
            return failure("terminal_history_key_failed")
        return success(window)

    def press_enter(self, window_id: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        with self._input_guard():
            return self._press_enter(window)

    def move_selection(self, window_id: str, steps: int) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        with self._input_guard():
            if not self._input_target_ready(window):
                return failure("terminal_focus_failed")
            key = TERMINAL_KEY_DOWN if steps >= 0 else TERMINAL_KEY_UP
            for _ in range(abs(steps)):
                if not self._keys(window, [key]):
                    return failure("terminal_key_failed")
                time.sleep(OPTION_STEP_SECONDS)
        return success(window)

    def set_title(self, window_id: str, title: str) -> Dict[str, Any]:
        window = self.find_window(window_id)
        if window is None:
            return failure("terminal_window_not_found")
        if not self._set_title(window, title):
            return failure("terminal_title_unsupported")
        return success(window)

    def press_key(self, window_id: str, key: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        keys = TERMINAL_KEY_ACTIONS.get(key)
        if keys is None:
            return failure("terminal_key_invalid")
        with self._input_guard():
            if not self._input_target_ready(window):
                return failure("terminal_focus_failed")
            sent = self._keys(window, list(keys))
        if not sent:
            return failure("terminal_key_failed")
        return success(window)

    def scroll(self, window_id: str, mode: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        if mode not in TERMINAL_SCROLL_MODES:
            return failure("terminal_scroll_mode_invalid")
        # Keys scroll the emulator's own scrollback; a wheel event reaches an
        # alternate-screen app (Claude Code, less, vim) as Up/Down arrows instead.
        scroll_keys = (
            self._scroll_bottom_keys(window)
            if mode == TERMINAL_SCROLL_BOTTOM
            else self._scroll_page_keys(window, mode)
        )
        if scroll_keys:
            with self._input_guard():
                scrolled = self._keys(window, scroll_keys)
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

    def paste_and_submit(
        self,
        window_id: str,
        content_length: int = 0,
        clear_first: bool = False,
        interrupt_first: bool = False,
        shell_prompt: bool = False,
    ) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        with self._input_guard():
            if not self._input_target_ready(window):
                return failure("terminal_focus_failed")
            if interrupt_first:
                if not self._keys(window, list(INTERRUPT_KEYS)):
                    return failure("terminal_key_failed")
                time.sleep(INTERRUPT_SETTLE_SECONDS)
            clearing = clear_first or interrupt_first
            if clearing and not self._clear_input(window, shell_prompt):
                return failure("terminal_clear_failed")
            if clear_first and not interrupt_first and content_length <= 0:
                return success(window)
            # Cleared first, so leftover input is never submitted by these Enters; cleared again after,
            # since a confirmation screen the Enters closed may have left input behind it.
            if not self._press_enters(window, PRE_SUBMIT_ENTER_PRESSES, PRE_SUBMIT_ENTER_INTERVAL_SECONDS):
                return failure("terminal_enter_failed")
            if clearing and not self._clear_input(window, shell_prompt):
                return failure("terminal_clear_failed")
            if not self._paste(window):
                return failure("terminal_paste_failed")
            time.sleep(paste_settle_seconds(content_length))
            pressed = self._press_enter(window)
            for _ in range(SUBMIT_ENTER_PRESSES - 1):
                if not pressed.get("success"):
                    break
                time.sleep(SUBMIT_ENTER_INTERVAL_SECONDS)
                pressed = self._press_enter(window)
            return pressed

    def copy_all(self, window_id: str) -> Dict[str, Any]:
        window, blocked = self._input_window(window_id)
        if window is None:
            return blocked
        with self._input_guard():
            if not self._select_all(window):
                return failure("terminal_select_all_failed")
            time.sleep(SELECT_ALL_DELAY_SECONDS)
            if not self._copy_selection(window):
                return failure("terminal_copy_failed")
        return success(window)

    def capture_windows(self, regions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return {window_id: PIL image} for the requested capture regions."""
        return self._capture(regions)

    def paste_uses_primary_selection(self) -> bool:
        return False

    def desktop_integration(self, action: str) -> Dict[str, Any]:
        return failure("unsupported_platform", action=action)

    def focused_window(self) -> Dict[str, Any]:
        """focus_entry(...) for the window holding the input focus, else failure(error_code)."""
        return failure(FOCUS_UNSUPPORTED)

    def focus_window(self, focused: Dict[str, Any]) -> bool:
        return False

    def pointer_position(self) -> Optional[Tuple[int, int]]:
        return None

    def move_pointer(self, x: int, y: int) -> bool:
        return False

    def _press_enters(self, window: Dict[str, Any], presses: int, interval_seconds: float) -> bool:
        for index in range(presses):
            if index:
                time.sleep(interval_seconds)
            if not self._press_enter(window).get("success"):
                return False
        time.sleep(interval_seconds)
        return True

    def _press_enter(self, window: Dict[str, Any]) -> Dict[str, Any]:
        if not self._input_target_ready(window):
            return failure("terminal_focus_failed")
        time.sleep(FOCUS_DELAY_SECONDS)
        if not self._keys(window, [TERMINAL_KEY_ENTER], ENTER_HOLD_SECONDS):
            return failure("terminal_enter_failed")
        return success(window)

    def _input_target_ready(self, window: Dict[str, Any]) -> bool:
        """True once synthesized keys will reach this window; backends that cannot verify focus accept."""
        return True

    def _shell_os(self, window: Dict[str, Any]) -> str:
        """OS of the shell inside the terminal (quick commands pick that OS's command line)."""
        return self.platform_name

    def _set_title(self, window: Dict[str, Any], title: str) -> bool:
        """Set the OS window title; backends without a native setter refuse."""
        return False

    def _clear_input(self, window: Dict[str, Any], shell_prompt: bool = False) -> bool:
        if shell_prompt and self._shell_os(window) == SHELL_OS_WINDOWS:
            if not self._keys(window, list(CLEAR_WINDOWS_SHELL_KEYS)):
                return False
            time.sleep(CLEAR_INPUT_SETTLE_SECONDS)
            return True
        if not self._keys(window, list(CLEAR_INPUT_LINE_END_KEYS)):
            return False
        for _ in range(CLEAR_INPUT_LINE_START_REPEAT):
            if not self._keys(window, list(CLEAR_INPUT_LINE_START_KEYS)):
                return False
        time.sleep(CLEAR_INPUT_SETTLE_SECONDS)
        return True

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

    def _input_window(self, window_id: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        """(window, {}) when synthesized input can reach the window, else (None, failure)."""
        window = self.find_window(window_id)
        if window is None:
            return None, failure("terminal_window_not_found")
        blocked = self._input_blocked(window)
        if blocked:
            return None, failure(blocked, window=window)
        return window, {}

    def _input_blocked(self, window: Dict[str, Any]) -> Optional[str]:
        """Error code when the OS would drop synthesized input for this window, else None."""
        return None

    def find_window(self, window_id: str) -> Optional[Dict[str, Any]]:
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

    def _keys(self, window: Dict[str, Any], keysym_names: Sequence[str], hold_seconds: float = 0.0) -> bool:
        raise NotImplementedError

    def _input_guard(self) -> ContextManager[None]:
        """Scope around synthesized key sequences on the activated window."""
        return nullcontext()

    def _wheel(self, window: Dict[str, Any], steps: int) -> bool:
        raise NotImplementedError

    def _wheel_lines(self) -> int:
        return TERMINAL_SCROLL_DEFAULT_LINES

    def _scroll_page_keys(self, window: Dict[str, Any], mode: str) -> Optional[List[str]]:
        """Scrollback page keys of the terminal emulator; None falls back to the mouse wheel."""
        return None

    def _scroll_bottom_keys(self, window: Dict[str, Any]) -> Optional[List[str]]:
        return None

    def _paste(self, window: Dict[str, Any]) -> bool:
        raise NotImplementedError

    def _select_all(self, window: Dict[str, Any]) -> bool:
        return self._keys(window, [TERMINAL_KEY_CONTROL, TERMINAL_KEY_SHIFT, TERMINAL_KEY_A])

    def _copy_selection(self, window: Dict[str, Any]) -> bool:
        return self._keys(window, [TERMINAL_KEY_CONTROL, TERMINAL_KEY_SHIFT, TERMINAL_KEY_C])

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

    def press_key(self, window_id: str, key: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def set_title(self, window_id: str, title: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def move_selection(self, window_id: str, steps: int) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def scroll(self, window_id: str, mode: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def paste_and_submit(
        self,
        window_id: str,
        content_length: int = 0,
        clear_first: bool = False,
        interrupt_first: bool = False,
        shell_prompt: bool = False,
    ) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def copy_all(self, window_id: str) -> Dict[str, Any]:
        return failure("unsupported_platform")

    def _capture(self, regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        return {}
