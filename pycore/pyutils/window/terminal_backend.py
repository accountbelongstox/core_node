# -*- coding: utf-8 -*-
from typing import Any, Dict, Protocol


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


class TerminalWindowBackend(Protocol):
    def snapshot(self) -> Dict[str, Any]:
        ...

    def activate(self, window_id: str) -> Dict[str, Any]:
        ...

    def click_at(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        ...

    def navigate_history(
        self,
        window_id: str,
        direction: str,
    ) -> Dict[str, Any]:
        ...

    def press_enter(self, window_id: str) -> Dict[str, Any]:
        ...

    def scroll(
        self,
        window_id: str,
        mode: str,
    ) -> Dict[str, Any]:
        ...

    def paste_and_submit(self, window_id: str) -> Dict[str, Any]:
        ...
