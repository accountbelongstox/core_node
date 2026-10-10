# -*- coding: utf-8 -*-
from __future__ import annotations

import hashlib
import json
import re
import secrets
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.system_launcher import open_file_with_notepad
from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyctl.terminal.terminal_capture_store import terminal_capture_store
from pycore.pyctl.terminal.terminal_image_store import ERROR_IMAGE_MISSING, terminal_image_store
from pycore.pyctl.terminal.terminal_permission_mode import (
    CYCLE_KEY,
    SWITCH_TARGET_MODES,
    permission_mode,
    tail_diff,
    terminal_permission_modes,
)
from pycore.pyctl.terminal.terminal_prompt_detector import waiting_prompt
from pycore.pyctl.terminal.terminal_screenshot_cache import (
    TerminalScreenshotCache,
    terminal_screenshot_cache,
)
from pycore.pyctl.terminal.terminal_text_ocr import recognize_region_text
from pycore.pyctl.terminal.terminal_voice_dictation import (
    ERROR_AUDIO_INVALID,
    ERROR_NO_TRANSCRIPT,
    ERROR_UNAVAILABLE,
    TerminalVoiceDictation,
    resolve_recordings,
)
from pycore.pyctl.terminal.terminal_virtual_agents import (
    VirtualAgentTerminals,
    is_virtual_window,
    virtual_agent_terminals,
)
from pycore.pyctl.terminal.terminal_window_views import assign_short_titles
from pycore.pyctl.terminal.terminal_snapshot_collector import (
    TerminalSnapshotCollector,
)
from pycore.pyctl.terminal.terminal_state_repository import (
    TerminalStateRepository,
    terminal_state_repository,
)
from pycore.pyutils.agent_cli.headless_agent_cli import agent_kinds
from pycore.pyutils.clipboard.clipboard_manager import clipboard_manager
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.launcher.text_editor_finder import text_editor_finder
from pycore.pyutils.window.focus_guard import focus_guard
from pycore.pyutils.window.screen_capture import encode_desktop_jpeg
from pycore.pyutils.window.terminal_backend import (
    DESKTOP_KEY_MAX_COMBO,
    DESKTOP_KEY_NAMES,
    POINTER_BUTTON_LEFT,
    POINTER_BUTTON_RIGHT,
    TERMINAL_HISTORY_DIRECTIONS,
    TERMINAL_KEY_ACTIONS,
    TERMINAL_SCROLL_MODES,
    TerminalWindowBackend,
)
from pycore.pyutils.window.terminal_attachment import format_attachment_reference
from pycore.pyutils.window.terminal_platform import terminal_backend


CLIPBOARD_RESTORE_DELAY_SECONDS = 0.12
DESKTOP_CLICK_BUTTONS = frozenset((POINTER_BUTTON_LEFT, POINTER_BUTTON_RIGHT))
DESKTOP_CLICK_MAX_COUNT = 2
DESKTOP_KEY_CHARACTER = re.compile(r"[a-z0-9]")
SCROLL_CAPTURE_DELAY_SECONDS = 0.28
TERMINAL_EVENT_SCHEMA_VERSION = 1
# Relay device events are capped at 64 KiB of canonical JSON; a snapshot that
# does not fit is announced without a body and the viewer refetches it.
TERMINAL_EVENT_SNAPSHOT_MAX_BYTES = 48000
# Empty submissions still press Enter in the target terminal: pasting a single
# space is the safest cross-backend equivalent of an empty command line.
EMPTY_INPUT_TEXT = " "
# Terminal copy is asynchronous: the clipboard is polled until it holds
# non-blank text other than the sentinel written before the select-all/copy
# keys, read identically twice (an X11/Xwayland owner hand-off briefly reads as
# an empty string). Select-all also owns PRIMARY on Linux, the fallback source.
CAPTURE_POLL_INTERVAL_SECONDS = 0.1
CAPTURE_POLL_ATTEMPTS = 30
CAPTURE_SENTINEL_PREFIX = "pycore-terminal-capture-"
CAPTURE_FOCUS_LABEL = "TerminalCapture"
CUSTOM_TITLE_MAX_CHARS = 120
CHOICE_MAX_OPTIONS = 9
CHOICE_SETTLE_SECONDS = 0.15
TERMINAL_LOG_SEARCH_RESULTS = int(relay_contract.limit("terminal_log_search_results"))
# shift+tab cycles at most manual/accept edits/plan/auto/bypass; one more step closes the cycle.
MODE_SWITCH_MAX_STEPS = 6
MODE_SWITCH_SETTLE_SECONDS = 0.5
MODE_SWITCH_POLL_ATTEMPTS = 6
MODE_SWITCH_FOCUS_LABEL = "TerminalPermissionMode"
TERMINAL_TEXT_MIN_WORD_CHARS = relay_contract.limit("terminal_text_min_word_chars")
ERROR_VIRTUAL_UNSUPPORTED = "terminal_virtual_unsupported"
# Keys that stop the running turn of a virtual agent window (the CLI process is killed).
VIRTUAL_CANCEL_KEYS = frozenset(("ctrl_c", "escape"))


class TerminalService:
    def __init__(
        self,
        backend: TerminalWindowBackend,
        state_repository: TerminalStateRepository,
        screenshot_cache: TerminalScreenshotCache,
        virtual_agents: VirtualAgentTerminals,
    ) -> None:
        self._backend = backend
        self._state_repository = state_repository
        self._screenshot_cache = screenshot_cache
        self._virtual = virtual_agents
        self._frame_texts: Dict[str, Dict[str, Any]] = {}
        self._frame_texts_lock = threading.Lock()
        self._desktop_frame: Optional[Dict[str, Any]] = None
        self._desktop_frame_at = 0.0
        self._desktop_frame_lock = threading.Lock()
        # Focus, pointer and clipboard are process-wide: every window action
        # (RPC routes and the scheduler alike) runs on this one input owner.
        init_serialized_owner(self, "pyctl.terminal.input", "TerminalInputThread")
        self._collector = TerminalSnapshotCollector(
            self._collect_snapshot,
            self._screenshot_cache.has_demand,
            self._publish_snapshot,
            self.finalize_snapshot,
        )
        self._virtual.set_change_listener(self.refresh_snapshot)

    def register_snapshot_decorator(self, decorate) -> None:
        self._collector.register_decorator(decorate)

    def snapshot(
        self,
        viewer_id: str = "",
        visible_window_ids: Iterable[str] = (),
    ) -> Dict[str, Any]:
        normalized_viewer = str(viewer_id or "").strip()
        normalized_visible = sorted(
            {str(value) for value in visible_window_ids if str(value)}
        )
        window_ids = tuple(normalized_visible)
        stored, collected_at, renew_due = self._collector.read(
            normalized_viewer,
            window_ids,
        )
        if renew_due:
            self._screenshot_cache.renew_demand(
                normalized_viewer,
                normalized_visible,
            )
            self._collector.mark_renewed(normalized_viewer, window_ids)
        served = self._collector.serve(stored, collected_at)
        return {
            **served,
            "windows": [dict(window) for window in served["windows"]],
        }

    def _collect_snapshot(self) -> Dict[str, Any]:
        snapshot = self._backend.snapshot()
        platform_name = str(snapshot["platform"]).lower()
        windows = self._state_repository.reconcile_windows(
            platform_name,
            self._live_windows(snapshot),
        )
        self._virtual.bind(windows)
        snapshot["agent_kinds"] = agent_kinds()
        assign_short_titles(windows)
        snapshot["windows"] = windows
        snapshot["count"] = len(windows)
        snapshot["online_count"] = sum(
            1 for window in windows if bool(window.get("online"))
        )
        snapshot["stored_count"] = snapshot["count"] - snapshot["online_count"]
        self._attach_window_screenshot_resources(snapshot)
        snapshot["screenshot_revision"] = self._screenshot_cache.revision()
        snapshot["state_revision"] = self._state_revision(snapshot)
        snapshot["refreshed_at"] = int(time.time() * 1000)
        terminal_activity_log.debug(
            "snapshot.completed",
            window_count=snapshot["count"],
            online_count=snapshot["online_count"],
            state_revision=snapshot["state_revision"],
        )
        return snapshot

    def _live_windows(self, snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Desktop windows of the backend plus the virtual agent windows (which need no desktop)."""
        return [
            *list(snapshot.get("windows") or []),
            *self._virtual.windows(str(snapshot["platform"]).lower()),
        ]

    def create_virtual(self, kind: str) -> Dict[str, Any]:
        """New virtual agent window of kind; its conversation starts with the first message."""
        created = self._virtual.create(kind)
        if created.get("success"):
            self._collector.collect()
        return created

    def close_virtual(self, window_id: str) -> Dict[str, Any]:
        """Stop the window's running turn, forget its conversation and remove its stored terminal state."""
        closed = self._virtual.close(window_id)
        if not closed.get("success"):
            return closed
        terminal_number = int(closed.get("terminal_number") or 0)
        if terminal_number <= 0:
            self._collector.collect()
            return {**closed, "removed_terminal_numbers": []}
        removed = self.remove_offline(terminal_number)
        return {**closed, "removed_terminal_numbers": removed.get("removed_terminal_numbers") or []}

    def _send_virtual(
        self,
        window_id: str,
        terminal_number: int,
        content: str,
        source: str,
        interrupt_first: bool,
    ) -> Dict[str, Any]:
        """A message to a virtual window starts one background turn of its CLI; sent = the turn started."""
        pending_log = self._state_repository.begin_submission(terminal_number, content, source)
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        action = self._virtual.send(window_id, content, interrupt_first)
        return self._complete_input(terminal_number, str(pending_log.get("id") or ""), action)

    def _publish_snapshot(self, snapshot: Dict[str, Any]) -> None:
        THREAD_BUS.trigger_event(
            TERMINAL_CHANGED_EVENT,
            {
                "schema_version": TERMINAL_EVENT_SCHEMA_VERSION,
                "event_type": TERMINAL_CHANGED_EVENT,
                "revision": int(snapshot.get("screenshot_revision") or 0),
                "state_revision": str(snapshot.get("state_revision") or ""),
                "snapshot": TerminalService._event_snapshot(snapshot),
            },
            async_mode=True,
        )

    @staticmethod
    def _event_snapshot(snapshot: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        event_snapshot = {
            **snapshot,
            "windows": [
                {key: value for key, value in window.items() if key != "logs"}
                for window in snapshot.get("windows") or []
            ],
        }
        encoded = json.dumps(
            event_snapshot,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")
        return (
            event_snapshot
            if len(encoded) <= TERMINAL_EVENT_SNAPSHOT_MAX_BYTES
            else None
        )

    def renew_viewer_demand(
        self,
        viewer_id: str,
        visible_window_ids: Iterable[str],
        focus_window_id: str = "",
        force_window_ids: Iterable[str] = (),
    ) -> Dict[str, Any]:
        lease = self._screenshot_cache.renew_demand(
            viewer_id,
            visible_window_ids,
            focus_window_id,
            force_window_ids,
        )
        for window_id in lease["force_window_ids"]:
            window = self._collector.online_window(window_id)
            if window is not None and not window.get("virtual"):
                self._screenshot_cache.capture_now(
                    TerminalService.window_capture_region(window)
                )
        if lease["focus_window_id"]:
            window = self._collector.online_window(lease["focus_window_id"])
            if window is not None and not window.get("virtual"):
                self._screenshot_cache.refresh_focus(
                    TerminalService.window_capture_region(window)
                )
        return {
            "viewer_id": lease["viewer_id"],
            "window_ids": lease["window_ids"],
            "lease_seconds": lease["lease_seconds"],
            "screenshots": self._screenshot_cache.metadata_many(
                [*lease["window_ids"], *lease["force_window_ids"]]
            ),
        }

    def refresh_snapshot(self) -> Dict[str, Any]:
        """Collect now (decorators run) regardless of viewer demand."""
        return self._collector.collect()

    def finalize_snapshot(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        snapshot["state_revision"] = self._state_revision(snapshot)
        return snapshot

    def read_screenshot(
        self,
        window_id: str,
        digest: str,
    ) -> Optional[Dict[str, Any]]:
        return self._screenshot_cache.read_resource(window_id, digest)

    def screenshot_captured_at(self, window_id: str) -> int:
        """Capture time (ms) of the window's newest changed frame, 0 when it has none."""
        frame = self._screenshot_cache.metadata(window_id)
        return int(frame.get("captured_at") or 0) if frame else 0

    def read_screenshot_text(self, window_id: str, digest: str) -> Dict[str, Any]:
        """OCR text of the window frame ``digest``; cached per window until the frame changes."""
        if not window_id or not digest:
            return self._failure("terminal_window_id_required")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        with self._frame_texts_lock:
            cached = self._frame_texts.get(window_id)
        if cached is not None and cached["digest"] == digest:
            return dict(cached)
        frame = self._screenshot_cache.metadata(window_id)
        if frame is None or str(frame.get("digest") or "") != digest:
            return self._failure("terminal_screenshot_stale")
        window = self._collector.online_window(window_id)
        if window is None:
            return self._failure("terminal_window_offline")
        recognized = recognize_region_text(TerminalService.window_capture_region(window))
        text = str(recognized.get("text") or "").strip("\n")
        readable = bool(text.strip()) and len(re.findall(r"\w", text)) >= TERMINAL_TEXT_MIN_WORD_CHARS
        result: Dict[str, Any] = {
            "success": readable,
            "window_id": window_id,
            "digest": digest,
            "text": text if readable else "",
            "engine": recognized.get("engine"),
            "error_code": None if readable else str(recognized.get("error") or "terminal_text_unreadable"),
        }
        with self._frame_texts_lock:
            current = self._screenshot_cache.metadata(window_id)
            self._frame_texts = {
                key: value
                for key, value in self._frame_texts.items()
                if self._collector.online_window(key) is not None
            }
            if current is not None and str(current.get("digest") or "") == digest:
                self._frame_texts[window_id] = result
        return dict(result)

    def resolve_window_id(self, terminal_number: int) -> str:
        if terminal_number <= 0:
            return ""
        return self._state_repository.resolve_window_id(terminal_number)

    @serialized_method
    def activate(self, window_id: str) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        return self._backend.activate(window_id)

    @serialized_method
    def click(
        self,
        window_id: str,
        horizontal_ratio: float,
        vertical_ratio: float,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
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

    def desktop_integration(self, action: str) -> Dict[str, Any]:
        return self._backend.desktop_integration(action)

    def read_desktop_screenshot(self) -> Optional[Dict[str, Any]]:
        """JPEG of the primary monitor, grabbed only while a viewer asks and at most once per backend interval."""
        with self._desktop_frame_lock:
            if (
                self._desktop_frame is not None
                and time.monotonic() - self._desktop_frame_at < self._backend.desktop_capture_interval_seconds
            ):
                return self._desktop_frame
            captured = self._backend.capture_desktop()
            if captured is None:
                return None
            self._desktop_frame = {
                "body": encode_desktop_jpeg(captured["image"]),
                "mime": "image/jpeg",
                "width": int(captured["rect"]["width"]),
                "height": int(captured["rect"]["height"]),
            }
            self._desktop_frame_at = time.monotonic()
            return self._desktop_frame

    @serialized_method
    def desktop_click(
        self,
        horizontal_ratio: float,
        vertical_ratio: float,
        button: int,
        clicks: int,
    ) -> Dict[str, Any]:
        if not (
            0.0 <= horizontal_ratio <= 1.0
            and 0.0 <= vertical_ratio <= 1.0
        ):
            return self._failure("terminal_click_coordinates_invalid")
        if button not in DESKTOP_CLICK_BUTTONS or not 1 <= clicks <= DESKTOP_CLICK_MAX_COUNT:
            return self._failure("terminal_click_coordinates_invalid")
        return self._backend.desktop_click(horizontal_ratio, vertical_ratio, button, clicks)

    @serialized_method
    def desktop_key(self, keys: List[str]) -> Dict[str, Any]:
        names = [DESKTOP_KEY_NAMES.get(key) or (key if DESKTOP_KEY_CHARACTER.fullmatch(key) else "") for key in keys]
        if not names or len(names) > DESKTOP_KEY_MAX_COMBO or not all(names):
            return self._failure("terminal_key_invalid")
        return self._backend.desktop_key(names)

    def save_draft(self, terminal_number: int, text: str) -> Dict[str, Any]:
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        return self._state_repository.save_draft(terminal_number, text)

    @serialized_method
    def navigate_history(
        self,
        window_id: str,
        direction: str,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if direction not in TERMINAL_HISTORY_DIRECTIONS:
            return self._failure("terminal_history_direction_invalid")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        return self._backend.navigate_history(window_id, direction)

    @serialized_method
    def press_key(
        self,
        window_id: str,
        key: str,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if key not in TERMINAL_KEY_ACTIONS:
            return self._failure("terminal_key_invalid")
        if is_virtual_window(window_id):
            if key in VIRTUAL_CANCEL_KEYS:
                return self._virtual.cancel(window_id)
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        return self._backend.press_key(window_id, key)

    @serialized_method
    def switch_permission_mode(
        self,
        window_id: str,
        terminal_number: int,
        target: str,
    ) -> Dict[str, Any]:
        """Cycle the agent's permission mode with shift+tab until the footer shows the target; every step compares the exported text before and after."""
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        if target not in SWITCH_TARGET_MODES:
            return self._failure("terminal_permission_mode_invalid")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        with focus_guard.preserved(MODE_SWITCH_FOCUS_LABEL):
            return self._cycle_permission_mode(window_id, terminal_number, target)

    def _cycle_permission_mode(self, window_id: str, terminal_number: int, target: str) -> Dict[str, Any]:
        exported = self.export_text(window_id, terminal_number)
        if not exported.get("success"):
            return exported
        text = exported["text"]
        terminal_permission_modes.observe(window_id, text)
        mode = permission_mode(text)
        if mode is None:
            return self._failure("terminal_permission_mode_unknown")
        if waiting_prompt(text):
            return self._failure("terminal_prompt_waiting")
        modes = [mode]
        steps: List[Dict[str, Any]] = []
        while mode != target:
            if len(steps) >= MODE_SWITCH_MAX_STEPS or (len(modes) > 1 and mode == modes[0]):
                terminal_permission_modes.record_cycle(window_id, modes)
                return {**self._failure("terminal_permission_mode_unavailable"), "modes": modes, "steps": steps}
            pressed = self._backend.press_key(window_id, CYCLE_KEY)
            if not pressed.get("success"):
                return {**pressed, "modes": modes, "steps": steps}
            exported, changes = self._await_text_change(window_id, terminal_number, text)
            if not exported.get("success"):
                return {**exported, "modes": modes, "steps": steps}
            after = exported["text"]
            mode = permission_mode(after)
            steps.append({"from": modes[-1], "to": mode, "changes": changes})
            if not changes or mode is None:
                return {**self._failure("terminal_permission_mode_unchanged"), "modes": modes, "steps": steps}
            terminal_permission_modes.observe(window_id, after)
            modes.append(mode)
            text = after
        terminal_permission_modes.record_cycle(window_id, modes)
        terminal_activity_log.info(
            "permission_mode.switched",
            terminal_number=terminal_number,
            target=target,
            modes=modes,
            steps=len(steps),
        )
        return {
            "success": True,
            "error_code": None,
            "mode": mode,
            "modes": modes,
            "steps": steps,
            "auto_supported": terminal_permission_modes.auto_supported(window_id),
        }

    def _await_text_change(self, window_id: str, terminal_number: int, before: str) -> Tuple[Dict[str, Any], List[str]]:
        """Export until the tail differs from before (the agent repaints its footer asynchronously)."""
        exported: Dict[str, Any] = self._failure("terminal_capture_empty")
        changes: List[str] = []
        for _attempt in range(MODE_SWITCH_POLL_ATTEMPTS):
            time.sleep(MODE_SWITCH_SETTLE_SECONDS)
            exported = self.export_text(window_id, terminal_number)
            if not exported.get("success"):
                return exported, []
            changes = tail_diff(before, exported["text"])
            if changes:
                break
        return exported, changes

    @serialized_method
    def scroll(
        self,
        window_id: str,
        mode: str,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if mode not in TERMINAL_SCROLL_MODES:
            return self._failure("terminal_scroll_mode_invalid")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
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
        return {**action, "screenshot_resource": screenshot}

    @serialized_method
    def choose_option(
        self,
        window_id: str,
        terminal_number: int,
        option: int,
        text: str = "",
        from_option: int = 1,
    ) -> Dict[str, Any]:
        """Answer an agent choice menu: move from the selected option (from_option) to the 1-based option, then Enter, or paste text + Enter."""
        if not window_id:
            return self._failure("terminal_window_id_required")
        if not 1 <= option <= CHOICE_MAX_OPTIONS:
            return self._failure("terminal_choice_invalid")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        moved = self._backend.move_selection(window_id, option - max(1, from_option))
        if not moved.get("success"):
            return moved
        time.sleep(CHOICE_SETTLE_SECONDS)
        if text:
            return self.input_text(window_id, terminal_number, text, activate_window=False)
        return self.press_enter(window_id, terminal_number, activate_window=False)

    @serialized_method
    def rename(self, terminal_number: int, title: str) -> Dict[str, Any]:
        """Store the custom name (empty clears it) and best-effort set the OS window title."""
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        custom_title = " ".join(title.split())[:CUSTOM_TITLE_MAX_CHARS]
        saved = self._state_repository.save_custom_title(terminal_number, custom_title)
        if not saved.get("success"):
            return saved
        os_result: Dict[str, Any] = {"success": False, "error_code": None}
        window_id = self._state_repository.resolve_window_id(terminal_number)
        if custom_title and window_id:
            os_result = self._backend.set_title(window_id, custom_title)
        return {
            **saved,
            "os_title_applied": bool(os_result.get("success")),
            "os_error_code": os_result.get("error_code"),
        }

    def remove_offline(self, terminal_number: int) -> Dict[str, Any]:
        """Forget an offline terminal: stored state, merged records and its captures."""
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        live = self._backend.snapshot()
        removed = self._state_repository.remove_offline_terminal(
            str(live["platform"]).lower(),
            self._live_windows(live),
            terminal_number,
        )
        if not removed.get("success"):
            return removed
        removed["removed_capture_count"] = sum(
            terminal_capture_store.delete_terminal(number)
            for number in removed["removed_terminal_numbers"]
        )
        terminal_activity_log.info(
            "terminal.removed",
            terminal_number=terminal_number,
            removed_terminal_numbers=removed["removed_terminal_numbers"],
        )
        self._collector.collect()
        return removed

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

    def search_logs(self, query: str) -> Dict[str, Any]:
        """Sent messages of every terminal containing query, newest first."""
        return {
            "success": True,
            "query": query,
            "results": self._state_repository.search_logs(query, TERMINAL_LOG_SEARCH_RESULTS),
        }

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

    def read_log_texts(
        self,
        terminal_number: int,
        log_ids: Sequence[str],
    ) -> Dict[str, str]:
        if terminal_number <= 0:
            return {}
        return self._state_repository.read_log_texts(terminal_number, log_ids)

    @serialized_method
    def input_text(
        self,
        window_id: str,
        terminal_number: int,
        text: str,
        source: str = "input",
        clear_first: bool = False,
        interrupt_first: bool = False,
        activate_window: bool = True,
        shell_prompt: bool = False,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        if is_virtual_window(window_id):
            if not text.strip():
                if interrupt_first:
                    return self._virtual.cancel(window_id)
                return {"success": True, "error_code": None}
            return self._send_virtual(window_id, terminal_number, text, source, interrupt_first)
        content = text if text else EMPTY_INPUT_TEXT

        pending_log = self._state_repository.begin_submission(
            terminal_number,
            content,
            source,
        )
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        log_id = str(pending_log.get("id") or "")
        clipboard_backup = clipboard_manager.snapshot()
        if not clipboard_manager.set_text(
            content,
            self._backend.paste_uses_primary_selection(),
            transient=True,
        ):
            return self._complete_input(
                terminal_number,
                log_id,
                self._failure("clipboard_write_failed"),
            )

        action: Dict[str, Any] = self._failure("terminal_input_failed")
        clipboard_restored = False
        try:
            activation = self._backend.activate(window_id) if activate_window else {"success": True}
            action = (
                self._backend.paste_and_submit(
                    window_id, len(text), clear_first, interrupt_first, shell_prompt,
                )
                if activation.get("success")
                else activation
            )
            time.sleep(CLIPBOARD_RESTORE_DELAY_SECONDS)
        finally:
            clipboard_restored = clipboard_manager.restore_snapshot(clipboard_backup)

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

    @serialized_method
    def dictate_voice(
        self,
        window_id: str,
        terminal_number: int,
        recordings: List[str],
        text: str = "",
        clear_first: bool = False,
        interrupt_first: bool = False,
        agent: str = "",
    ) -> Dict[str, Any]:
        """Type recordings through the agent's hold-to-talk dictation, append text, submit. ERROR_UNAVAILABLE = nothing typed.
        agent="codex" plays through Codex realtime voice (F8 toggle) instead: the model hears the audio directly."""
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)
        if not TerminalVoiceDictation.available():
            return self._failure(ERROR_UNAVAILABLE)
        paths = resolve_recordings(recordings, terminal_image_store.voice_directory)
        if paths is None:
            return self._failure(ERROR_AUDIO_INVALID)
        activation = self._backend.activate(window_id)
        if not activation.get("success"):
            return activation
        if clear_first or interrupt_first:
            prepared = self._backend.prepare_input(window_id, clear_first, interrupt_first)
            if not prepared.get("success"):
                return prepared
        dictation = TerminalVoiceDictation(self._backend, lambda: self.export_text(window_id, terminal_number))
        if agent == "codex":
            return self._dictate_voice_realtime(dictation, window_id, terminal_number, paths, text)
        before = dictation.ready_input()
        if before is None:
            return self._failure(ERROR_UNAVAILABLE)
        transcript = before
        for path in paths:
            held = dictation.dictate(window_id, path)
            if not held.get("success"):
                self._backend.clear_input(window_id)
                return held
            dictated = dictation.await_transcript(transcript)
            if dictated is None:
                self._backend.clear_input(window_id)
                return self._failure(ERROR_NO_TRANSCRIPT)
            transcript = dictated
        content = " ".join(part for part in (transcript, text) if part)
        pending_log = self._state_repository.begin_submission(terminal_number, content, "voice")
        log_id = str((pending_log or {}).get("id") or "")
        appended = f" {text}" if text else ""
        clipboard_backup = clipboard_manager.snapshot() if appended else None
        if appended and not clipboard_manager.set_text(appended, self._backend.paste_uses_primary_selection(), transient=True):
            return self._complete_input(terminal_number, log_id, self._failure("clipboard_write_failed"))
        try:
            action = self._backend.append_and_submit(window_id, len(appended))
            if appended:
                time.sleep(CLIPBOARD_RESTORE_DELAY_SECONDS)
        finally:
            if appended:
                clipboard_manager.restore_snapshot(clipboard_backup)
        terminal_activity_log.info(
            "voice.dictated",
            terminal_number=terminal_number,
            recordings=len(paths),
            transcript_chars=len(transcript),
            success=bool(action.get("success")),
        )
        return self._complete_input(terminal_number, log_id, {**action, "transcript": transcript})

    def _dictate_voice_realtime(
        self,
        dictation: TerminalVoiceDictation,
        window_id: str,
        terminal_number: int,
        paths: List[Path],
        text: str,
    ) -> Dict[str, Any]:
        """Codex realtime voice: each recording is one toggle-play-toggle round; optional text follows as a normal submission."""
        for path in paths:
            played = dictation.dictate_realtime(window_id, path)
            if not played.get("success"):
                return played
        action: Dict[str, Any] = {"success": True}
        if text:
            pending_log = self._state_repository.begin_submission(terminal_number, text, "voice")
            log_id = str((pending_log or {}).get("id") or "")
            clipboard_backup = clipboard_manager.snapshot()
            if not clipboard_manager.set_text(text, self._backend.paste_uses_primary_selection(), transient=True):
                return self._complete_input(terminal_number, log_id, self._failure("clipboard_write_failed"))
            try:
                action = self._backend.append_and_submit(window_id, len(text))
                time.sleep(CLIPBOARD_RESTORE_DELAY_SECONDS)
            finally:
                clipboard_manager.restore_snapshot(clipboard_backup)
            action = self._complete_input(terminal_number, log_id, action)
        terminal_activity_log.info(
            "voice.realtime",
            terminal_number=terminal_number,
            recordings=len(paths),
            success=bool(action.get("success")),
        )
        return action

    @serialized_method
    def run_exclusive(self, action: Callable[[], Any]) -> Any:
        """Run a multi-step window action (focus save, keys, focus restore) on the input owner, so no send interleaves."""
        return action()

    @serialized_method
    def export_text(
        self,
        window_id: str,
        terminal_number: int,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        if is_virtual_window(window_id):
            transcript = self._virtual.transcript(window_id)
            if transcript is None:
                return self._failure("terminal_window_not_found")
            return {"success": True, "error_code": None, "text": transcript}
        clipboard_backup = clipboard_manager.snapshot()
        sentinel = f"{CAPTURE_SENTINEL_PREFIX}{secrets.token_hex(8)}"
        use_primary = self._backend.paste_uses_primary_selection()
        if not clipboard_manager.set_text(sentinel, use_primary, transient=True):
            return self._failure("clipboard_write_failed")
        captured: Optional[str] = None
        action: Dict[str, Any] = self._failure("terminal_copy_failed")
        try:
            activation = self._backend.activate(window_id)
            action = (
                self._backend.copy_all(window_id)
                if activation.get("success")
                else activation
            )
            if action.get("success"):
                captured = self._await_capture(sentinel, use_primary)
        finally:
            clipboard_restored = clipboard_manager.restore_snapshot(clipboard_backup)
        if not action.get("success"):
            return {**action, "clipboard_restored": clipboard_restored}
        text = (
            TerminalService._normalize_capture(captured)
            if captured is not None
            else ""
        )
        if not text:
            return {
                **action,
                "success": False,
                "error_code": "terminal_capture_empty",
                "clipboard_restored": clipboard_restored,
            }
        return {**action, "clipboard_restored": clipboard_restored, "text": text}

    @serialized_method
    def capture_text(
        self,
        window_id: str,
        terminal_number: int,
        open_editor: bool,
    ) -> Dict[str, Any]:
        with focus_guard.preserved(CAPTURE_FOCUS_LABEL):
            exported = self.export_text(window_id, terminal_number)
        if not exported.get("success"):
            return exported
        text = exported.pop("text")
        saved = terminal_capture_store.save(terminal_number, text)
        if not saved.get("success"):
            return {**exported, **saved}
        opened = (
            open_file_with_notepad(saved["path"], text_editor_finder.find())
            if open_editor
            else False
        )
        terminal_activity_log.info(
            "capture.saved",
            terminal_number=terminal_number,
            path=saved["path"],
            bytes=saved["bytes"],
            opened=opened,
        )
        return {
            **exported,
            "path": saved["path"],
            "name": saved["name"],
            "bytes": saved["bytes"],
            "line_count": text.count("\n") + 1 if text else 0,
            "opened": opened,
            "editor_requested": open_editor,
        }

    @staticmethod
    def _await_capture(sentinel: str, use_primary: bool) -> Optional[str]:
        candidate: Optional[str] = None
        for _attempt in range(CAPTURE_POLL_ATTEMPTS):
            time.sleep(CAPTURE_POLL_INTERVAL_SECONDS)
            content = clipboard_manager.get_text()
            if not TerminalService._is_capture_text(content, sentinel):
                continue
            if content == candidate:
                return content
            candidate = content
        if candidate is not None:
            return candidate
        primary = clipboard_manager.get_text(True) if use_primary else None
        return primary if TerminalService._is_capture_text(primary, sentinel) else None

    @staticmethod
    def _is_capture_text(content: Optional[str], sentinel: str) -> bool:
        return bool(content and content.strip()) and content != sentinel

    @staticmethod
    def _normalize_capture(text: str) -> str:
        lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        while lines and not lines[-1]:
            lines.pop()
        return "\n".join(lines)

    def read_capture(self, terminal_number: int, name: str) -> Optional[str]:
        if terminal_number <= 0:
            return None
        return terminal_capture_store.read(terminal_number, name)

    def upload_image(self, upload: Any, window_id: str = "") -> Dict[str, Any]:
        """Store an uploaded image (UploadFile-like: .file stream) for a terminal message.

        display_path is the exact text to append (space separated) to the message.
        """
        stream = getattr(upload, "file", None)
        if stream is None:
            return self._failure(ERROR_IMAGE_MISSING)
        read = terminal_image_store.read_stream(stream)
        if not read["success"]:
            return read
        saved = terminal_image_store.save(read["data"])
        if not saved["success"]:
            return saved
        window = self._backend.find_window(window_id) if window_id else None
        return {
            "success": True,
            "path": saved["path"],
            "display_path": format_attachment_reference(saved["path"], self._backend.platform_name, window),
            "name": saved["name"],
            "bytes": saved["bytes"],
            "mime": saved["mime"],
        }

    @serialized_method
    def press_enter(
        self,
        window_id: str,
        terminal_number: int,
        activate_window: bool = True,
    ) -> Dict[str, Any]:
        if not window_id:
            return self._failure("terminal_window_id_required")
        if terminal_number <= 0:
            return self._failure("terminal_number_required")
        if is_virtual_window(window_id):
            return self._failure(ERROR_VIRTUAL_UNSUPPORTED)

        pending_log = self._state_repository.begin_submission(
            terminal_number,
            "",
            "enter",
        )
        if pending_log is None:
            return self._failure("terminal_state_not_found")
        log_id = str(pending_log.get("id") or "")
        activation = self._backend.activate(window_id) if activate_window else {"success": True}
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
        if not window_id:
            return self._log_rejected_input(
                terminal_number,
                content,
                "terminal_window_offline",
            )
        return self.input_text(window_id, terminal_number, content, "schedule")

    def _log_rejected_input(
        self,
        terminal_number: int,
        text: str,
        error_code: str,
    ) -> Dict[str, Any]:
        pending_log = self._state_repository.begin_submission(
            terminal_number,
            text,
            "schedule",
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

    def _attach_window_screenshot_resources(
        self,
        snapshot: Dict[str, Any],
    ) -> None:
        windows = snapshot.get("windows") or []
        regions = [
            TerminalService.window_capture_region(window)
            for window in windows
            if bool(window.get("online")) and not window.get("virtual")
        ]
        screenshots = self._screenshot_cache.refresh_demanded(regions)
        for window in windows:
            window.pop("screenshot", None)
            if bool(window.get("online")) and not window.get("virtual"):
                resource = screenshots.get(str(window.get("id") or ""))
                if resource is not None:
                    window["screenshot_resource"] = resource
                else:
                    window.pop("screenshot_resource", None)

    def _capture_window_screenshot(
        self,
        window: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        window_id = str(window.get("id") or "")
        if not window_id:
            return None
        return self._screenshot_cache.capture_now(
            TerminalService.window_capture_region(window)
        )

    @staticmethod
    def window_capture_region(window: Dict[str, Any]) -> Dict[str, Any]:
        rectangle = window.get("rect") or {}
        return {
            "id": str(window.get("id") or ""),
            "left": int(rectangle.get("x") or 0),
            "top": int(rectangle.get("y") or 0),
            "width": int(rectangle.get("width") or 0),
            "height": int(rectangle.get("height") or 0),
        }

    @staticmethod
    def _state_revision(snapshot: Dict[str, Any]) -> str:
        canonical = {
            "platform": str(snapshot.get("platform") or ""),
            "session": str(snapshot.get("session") or ""),
            "supported": bool(snapshot.get("supported")),
            "windows": snapshot.get("windows") or [],
        }
        body = json.dumps(
            canonical,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(body).hexdigest()

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


terminal_service = TerminalService(
    terminal_backend,
    terminal_state_repository,
    terminal_screenshot_cache,
    virtual_agent_terminals,
)
