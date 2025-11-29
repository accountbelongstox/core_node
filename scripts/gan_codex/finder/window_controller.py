"""Interact with discovered terminal windows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

from pycore.pyfoundations.third_party import (
    get_third_package_pyautogui,
    get_third_package_pygetwindow,
)

from .models import TerminalMatch


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


@dataclass
class _WindowInfo:
    title: str
    left: int
    top: int
    width: int
    height: int
    backend_window: object


class TerminalWindowController:
    """Locate terminal windows and click a relative point within them."""

    def __init__(self, relative_point: Tuple[float, float] = (0.05, 0.95)) -> None:
        self._pyautogui = get_third_package_pyautogui()
        self._pygetwindow = get_third_package_pygetwindow()
        self.relative_point = (
            _clamp(relative_point[0]),
            _clamp(relative_point[1]),
        )

    @property
    def is_supported(self) -> bool:
        return bool(self._pyautogui and self._pygetwindow)

    def click_first_available(self, matches: Sequence[TerminalMatch]) -> bool:
        for match in matches:
            if self.click_on_match(match):
                return True
        return False

    def click_on_match(self, match: TerminalMatch) -> bool:
        if not self.is_supported:
            return False

        windows = self._candidate_windows(match)
        if not windows:
            return False

        for info in windows:
            if info.width <= 0 or info.height <= 0:
                continue

            target_x, target_y = self._compute_relative_point(info)
            if self._activate_window(info.backend_window) and self._perform_click(target_x, target_y):
                print(
                    f"[WindowController] Clicked near bottom-left of '{match.name}' "
                    f"window at ({target_x}, {target_y})."
                )
                return True

        return False

    def _candidate_windows(self, match: TerminalMatch) -> List[_WindowInfo]:
        assert self._pygetwindow
        raw_windows = self._pygetwindow.getAllWindows()
        tokens = self._build_title_tokens(match)
        candidates: List[_WindowInfo] = []
        for window in raw_windows:
            title = (window.title or "").strip()
            if not title:
                continue
            lowered = title.lower()
            if any(token in lowered for token in tokens):
                try:
                    info = _WindowInfo(
                        title=title,
                        left=int(window.left),
                        top=int(window.top),
                        width=int(window.width),
                        height=int(window.height),
                        backend_window=window,
                    )
                    candidates.append(info)
                except Exception:
                    continue
        return candidates

    def _build_title_tokens(self, match: TerminalMatch) -> List[str]:
        tokens = {match.name.lower(), match.key.lower()}
        tokens.update(part for part in match.name.lower().split() if len(part) > 2)
        # Clean up empty strings
        return [token for token in {t.strip() for t in tokens} if token]

    def _compute_relative_point(self, info: _WindowInfo) -> Tuple[int, int]:
        rel_x, rel_y = self.relative_point
        x = int(info.left + rel_x * max(info.width, 1))
        y = int(info.top + rel_y * max(info.height, 1))
        return x, y

    def _activate_window(self, window: object) -> bool:
        try:
            if hasattr(window, "isMinimized") and window.isMinimized:
                window.restore()
            if hasattr(window, "activate"):
                window.activate()
            return True
        except Exception:
            return False

    def _perform_click(self, x: int, y: int) -> bool:
        try:
            self._pyautogui.click(x, y)
            return True
        except Exception:
            return False
