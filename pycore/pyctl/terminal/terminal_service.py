# -*- coding: utf-8 -*-
from __future__ import annotations

import platform
import time
from typing import Any, Dict, Optional

from pycore.pyctl.terminal.terminal_state_repository import (
    TerminalStateRepository,
    terminal_state_repository,
)
from pycore.pyutils.clipboard.clipboard_manager import clipboard_manager
from pycore.pyutils.window.screen_capture import capture_screen_regions_base64
from pycore.pyutils.window.terminal_backend import (
    TERMINAL_SCROLL_MODES,
    TerminalWindowBackend,
)


SYSTEM_NAME = platform.system()
CLIPBOARD_RESTORE_DELAY_SECONDS = 0.12
SCROLL_CAPTURE_DELAY_SECONDS = 0.28
HISTORY_DIRECTIONS = {"up", "down"}
# Empty submissions still press Enter in the target terminal: pasting a single
# space is the safest cross-backend equivalent of an empty command line.
EMPTY_INPUT_TEXT = " "

if SYSTEM_NAME == "Windows":
    from pycore.pyutils.window.windows_terminal_backend import windows_terminal_backend as terminal_backend
elif SYSTEM_NAME == "Linux":
    from pycore.pyutils.window.linux_terminal_backend import linux_terminal_backend as terminal_backend
else:
    terminal_backend = None


class TerminalService:
    def __init__(
        self,
        backend: TerminalWindowBackend | None,
        state_repository: TerminalStateRepository,
    ) -> None:
        self._backend = backend
        self._state_repository = state_repository

    def snapshot(self) -> Dict[str, Any]:
        if self._backend is None:
            snapshot = {
                "success": True,
                "platform": SYSTEM_NAME.lower(),
                "session": "unknown",
                "supported": False,
                "error_code": "unsupported_platform",
                "count": 0,
                "windows": [],
            }
        else:
            snapshot = self._backend.snapshot()
        platform_name = str(snapshot.get("platform") or SYSTEM_NAME.lower()).lower()
        windows = self._state_repository.reconcile_windows(
            platform_name,
            list(snapshot.get("windows") or []),
        )
        snapshot["windows"] = windows
        snapshot["count"] = len(windows)
        snapshot["online_count"] = sum(
            1 for window in windows if bool(window.get("online"))
        )
        snapshot["stored_count"] = snapshot["count"] - snapshot["online_count"]
        if snapshot.get("supported") and snapshot["online_count"]:
            self._attach_window_screenshots(snapshot)
        snapshot["refreshed_at"] = int(time.time() * 1000)
        return snapshot

    def activate(self, window_id: str) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        return self._backend.activate(window_id)

    def click(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        if not (
            0.0 <= horizontal_ratio <= 1.0
            and 0.0 <= vertical_ratio <= 1.0
        ):
            return self._failure("terminal_click_coordinates_invalid")
        return self._backend.click_at(
            window_id,
            horizontal_ratio,
            vertical_ratio,
        )

    def save_draft(self, terminal_number: int, text: str) -> Dict[str, Any]:
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        return self._state_repository.save_draft(terminal_number, text)

    def navigate_history(
        self,
        window_id: str,
        direction: str,
    ) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        if direction not in HISTORY_DIRECTIONS:
            return self._failure("terminal_history_direction_invalid")
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        return self._backend.navigate_history(window_id, direction)

    def scroll(
        self,
        window_id: str,
        mode: str,
    ) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        if mode not in TERMINAL_SCROLL_MODES:
            return self._failure("terminal_scroll_mode_invalid")
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        action = self._backend.scroll(window_id, mode)
        if not action.get("success"):
            return action
        time.sleep(SCROLL_CAPTURE_DELAY_SECONDS)
        screenshot = self._capture_window_screenshot(action.get("window") or {})
        if screenshot is None:
            return {
                **action,
                "success": False,
                "error_code": "terminal_screenshot_failed",
            }
        return {**action, "screenshot": screenshot}

    def save_preview_expanded(
        self,
        terminal_number: int,
        expanded: bool,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        return self._state_repository.save_preview_expanded(
            terminal_number,
            expanded,
        )

    def read_text(
        self,
        terminal_number: int,
        content_kind: str,
        log_id: str = "",
    ) -> Optional[str]:
        if terminal_number <= 0:
            return None
        return self._state_repository.read_text(
            terminal_number,
            content_kind,
            log_id,
        )

    def input_text(
        self,
        window_id: str,
        terminal_number: int,
        text: str,
    ) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        content = text if text else EMPTY_INPUT_TEXT

        pending_log = self._state_repository.begin_submission(
            terminal_number,
            content,
        )
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        log_id = str(pending_log.get("id") or "")
        clipboard_backup = clipboard_manager.get_text()
        backup_text = clipboard_backup if clipboard_backup is not None else ""
        if not clipboard_manager.set_text(content):
            return self._complete_input(
                terminal_number,
                log_id,
                self._failure("clipboard_write_failed"),
            )

        action: Dict[str, Any] = self._failure("terminal_input_failed")
        clipboard_restored = False
        try:
            activation = self._backend.activate(window_id)
            action = (
                self._backend.paste_and_submit(window_id)
                if activation.get("success")
                else activation
            )
            time.sleep(CLIPBOARD_RESTORE_DELAY_SECONDS)
        finally:
            clipboard_restored = clipboard_manager.set_text(backup_text)

        success = bool(action.get("success")) and clipboard_restored
        error_code = action.get("error_code")
        if not clipboard_restored:
            error_code = "clipboard_restore_failed"
        return self._complete_input(
            terminal_number,
            log_id,
            {
                **action,
                "success": success,
                "error_code": error_code,
                "clipboard_restored": clipboard_restored,
            },
        )

    def press_enter(
        self,
        window_id: str,
        terminal_number: int,
    ) -> Dict[str, Any]:
        if self._backend is None:
            return self._failure("unsupported_platform")
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")

        pending_log = self._state_repository.begin_submission(
            terminal_number,
            "",
            update_draft=False,
        )
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        log_id = str(pending_log.get("id") or "")
        activation = self._backend.activate(window_id)
        action = (
            self._backend.press_enter(window_id)
            if activation.get("success")
            else activation
        )
        return self._complete_input(terminal_number, log_id, action)

    def submit_scheduled(
        self,
        terminal_number: int,
        window_id: str,
        text: str,
    ) -> Dict[str, Any]:
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        content = text if text else EMPTY_INPUT_TEXT
        if self._backend is None:
            return self._log_rejected_input(
                terminal_number,
                content,
                "unsupported_platform",
            )
        if not window_id:
            return self._log_rejected_input(
                terminal_number,
                content,
                "terminal_window_offline",
            )
        return self.input_text(window_id, terminal_number, content)

    def _log_rejected_input(
        self,
        terminal_number: int,
        text: str,
        error_code: str,
    ) -> Dict[str, Any]:
        pending_log = self._state_repository.begin_submission(
            terminal_number,
            text,
        )
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        return self._complete_input(
            terminal_number,
            str(pending_log.get("id") or ""),
            self._failure(error_code),
        )

    def _complete_input(
        self,
        terminal_number: int,
        log_id: str,
        action: Dict[str, Any],
    ) -> Dict[str, Any]:
        success = bool(action.get("success"))
        error_code = action.get("error_code")
        log_entry = self._state_repository.complete_submission(
            terminal_number,
            log_id,
            success,
            str(error_code) if error_code else None,
        )
        return {**action, "log": log_entry}

    @staticmethod
    def _attach_window_screenshots(snapshot: Dict[str, Any]) -> None:
        windows = snapshot.get("windows") or []
        regions = [
            TerminalService._window_capture_region(window)
            for window in windows
            if bool(window.get("online"))
        ]
        screenshots = capture_screen_regions_base64(regions)
        for window in windows:
            if bool(window.get("online")):
                window["screenshot"] = screenshots.get(str(window.get("id") or ""))

    @staticmethod
    def _capture_window_screenshot(
        window: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        window_id = str(window.get("id") or "")
        if not window_id:
            return None
        screenshots = capture_screen_regions_base64([
            TerminalService._window_capture_region(window),
        ])
        return screenshots.get(window_id)

    @staticmethod
    def _window_capture_region(window: Dict[str, Any]) -> Dict[str, Any]:
        rectangle = window.get("rect") or {}
        return {
            "id": str(window.get("id") or ""),
            "left": int(rectangle.get("x") or 0),
            "top": int(rectangle.get("y") or 0),
            "width": int(rectangle.get("width") or 0),
            "height": int(rectangle.get("height") or 0),
        }

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


terminal_service = TerminalService(terminal_backend, terminal_state_repository)
