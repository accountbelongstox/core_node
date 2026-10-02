# -*- coding: utf-8 -*-
"""Save the window that holds the input focus and put focus (and the pointer) back after code that activates other windows."""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Iterator, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.window.terminal_backend import FOCUS_DELAY_SECONDS, TerminalWindowBackend
from pycore.pyutils.window.terminal_platform import terminal_backend

RESTORE_ATTEMPTS = 2
ERROR_NOT_RESTORABLE = "focus_not_restorable"
ERROR_RESTORE_UNCONFIRMED = "focus_restore_unconfirmed"
ERROR_BACKEND_RAISED = "focus_backend_failed"


@dataclass(frozen=True)
class FocusToken:
    focused: Optional[Dict[str, Any]]
    pointer: Optional[Tuple[int, int]]
    error_code: Optional[str]

    @property
    def window_label(self) -> str:
        if self.focused is None:
            return "-"
        return f"{self.focused['id']} title={self.focused['title']!r}"


class FocusGuard:
    def __init__(self, backend: TerminalWindowBackend = terminal_backend) -> None:
        self._backend = backend

    def capture_focus(self, label: str = "FocusGuard") -> FocusToken:
        """Never raises; a token without a window means focus could not be read (error_code says why)."""
        try:
            focused = self._backend.focused_window()
            pointer = self._backend.pointer_position()
        except Exception as exc:  # noqa: BLE001 - focus preservation must never fail the caller
            ColorPrint.yellow(f"[{label}] focus not saved reason={ERROR_BACKEND_RAISED}: {type(exc).__name__}: {exc}")
            return FocusToken(None, None, ERROR_BACKEND_RAISED)
        if not focused.get("success"):
            error_code = str(focused.get("error_code") or ERROR_NOT_RESTORABLE)
            ColorPrint.blue(f"[{label}] focus not saved reason={error_code}")
            return FocusToken(None, pointer, error_code)
        token = FocusToken(focused, pointer, None if focused.get("restorable") else ERROR_NOT_RESTORABLE)
        ColorPrint.blue(
            f"[{label}] focus saved source={focused['source']} window={token.window_label}"
            f"{'' if focused.get('restorable') else f' reason={ERROR_NOT_RESTORABLE}'}"
        )
        return token

    def restore_focus(self, token: FocusToken, label: str = "FocusGuard") -> bool:
        """Pointer first (focus-follows-mouse), then the window; verified by re-reading the focus, retried once."""
        try:
            self._restore_pointer(token)
            if token.focused is None:
                return False
            if token.error_code:
                ColorPrint.blue(f"[{label}] focus restore skipped reason={token.error_code} window={token.window_label}")
                return False
            for _attempt in range(RESTORE_ATTEMPTS):
                if self._is_focused(token) or (self._backend.focus_window(token.focused) and self._settled(token)):
                    ColorPrint.green(f"[{label}] focus restored window={token.window_label}")
                    return True
                time.sleep(FOCUS_DELAY_SECONDS)
            ColorPrint.yellow(
                f"[{label}] focus restore failed reason={ERROR_RESTORE_UNCONFIRMED} window={token.window_label}"
            )
        except Exception as exc:  # noqa: BLE001 - focus preservation must never fail the caller
            ColorPrint.yellow(
                f"[{label}] focus restore failed reason={ERROR_BACKEND_RAISED} window={token.window_label}: "
                f"{type(exc).__name__}: {exc}"
            )
        return False

    @contextmanager
    def preserved(self, label: str = "FocusGuard") -> Iterator[FocusToken]:
        token = self.capture_focus(label)
        try:
            yield token
        finally:
            self.restore_focus(token, label)

    def _is_focused(self, token: FocusToken) -> bool:
        current = self._backend.focused_window()
        return bool(current.get("success")) and current.get("key") == token.focused["key"]

    def _settled(self, token: FocusToken) -> bool:
        time.sleep(FOCUS_DELAY_SECONDS)
        return self._is_focused(token)

    def _restore_pointer(self, token: FocusToken) -> None:
        if token.pointer is not None and self._backend.pointer_position() != token.pointer:
            self._backend.move_pointer(*token.pointer)


focus_guard = FocusGuard()


__all__ = ["FocusGuard", "FocusToken", "focus_guard"]
