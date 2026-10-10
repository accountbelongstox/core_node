# -*- coding: utf-8 -*-
"""Runs a quick command of the library on one terminal: an idle shell prompt (terminal_shell_state) gets one
Ctrl+C that clears its input line, any other screen several spaced Ctrl+C so the running program exits; then
a wait for a stable shell prompt and the command line typed and submitted (history kind "quick").
One run per terminal at a time; the run is a background step list and its phase is readable by status()."""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Optional

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyctl.terminal.terminal_quick_commands import INTERRUPT_POLICY, resolve_quick_command
from pycore.pyctl.terminal.terminal_service import ERROR_VIRTUAL_UNSUPPORTED, terminal_service
from pycore.pyctl.terminal.terminal_shell_state import ShellState, terminal_shell_state
from pycore.pyctl.terminal.terminal_virtual_agents import is_virtual_window
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.time_utils import utc_now_ms

SOURCE_QUICK = "quick"
KEY_CTRL_C = "ctrl_c"
STATE_IDLE = "idle"
STATE_RUNNING = "running"
STATE_DONE = "done"
STATE_FAILED = "failed"
PHASE_INTERRUPTING = "interrupting"
PHASE_WAITING = "waiting"
PHASE_TYPING = "typing"
PHASE_DONE = "done"
ERROR_BUSY = "quick_command_busy"
ERROR_IDLE_TIMEOUT = "quick_command_idle_timeout"
ERROR_RUN_FAILED = "quick_command_run_failed"
ERROR_WINDOW_REQUIRED = "terminal_window_id_required"
ERROR_NUMBER_REQUIRED = "terminal_number_required"
MS_PER_SECOND = 1000.0
THREAD_NAME = "TerminalQuickCommandThread"


class TerminalQuickCommandRunner:
    def __init__(self) -> None:
        self._runs: Dict[int, Dict[str, Any]] = {}
        init_serialized_owner(self, "pyctl.terminal.quick_command", "TerminalQuickCommandStateThread")

    def start(self, window_id: str, terminal_number: int, command_key: str, shell_os: str) -> Dict[str, Any]:
        """Validate and claim the terminal, then run in the background; a run already active is refused."""
        if not window_id:
            return {"success": False, "error_code": ERROR_WINDOW_REQUIRED}
        if terminal_number <= 0:
            return {"success": False, "error_code": ERROR_NUMBER_REQUIRED}
        if is_virtual_window(window_id):
            return {"success": False, "error_code": ERROR_VIRTUAL_UNSUPPORTED}
        resolved = resolve_quick_command(command_key, shell_os)
        if not resolved["success"]:
            terminal_activity_log.warning(
                "quick_command.rejected",
                terminal_number=terminal_number,
                command=command_key,
                platform=shell_os,
                error_code=resolved["error_code"],
            )
            return resolved
        run = {
            "run_id": secrets.token_hex(6),
            "state": STATE_RUNNING,
            "phase": PHASE_INTERRUPTING,
            "key": resolved["key"],
            "line": resolved["line"],
            "platform": shell_os,
            "error_code": None,
            "ctrl_c_sent": 0,
            "polls": 0,
            "started_at": utc_now_ms(),
            "finished_at": None,
        }
        if not self._claim(terminal_number, run):
            terminal_activity_log.warning(
                "quick_command.busy",
                terminal_number=terminal_number,
                command=command_key,
            )
            return {**self.status(terminal_number), "success": False, "error_code": ERROR_BUSY}
        terminal_activity_log.info(
            "quick_command.accepted",
            terminal_number=terminal_number,
            run_id=run["run_id"],
            command=run["key"],
            platform=shell_os,
            line=run["line"],
        )
        start_bus_task(self._run, window_id, terminal_number, run, thread_name=THREAD_NAME)
        return {**self.status(terminal_number), "success": True, "error_code": None}

    @serialized_method
    def _claim(self, terminal_number: int, run: Dict[str, Any]) -> bool:
        current = self._runs.get(terminal_number)
        if current is not None and current["state"] == STATE_RUNNING:
            return False
        self._runs[terminal_number] = run
        return True

    @serialized_method
    def _update(self, terminal_number: int, **fields: Any) -> None:
        self._runs[terminal_number].update(fields)

    @serialized_method
    def status(self, terminal_number: int) -> Dict[str, Any]:
        run = self._runs.get(terminal_number)
        if run is None:
            return {"success": True, "error_code": None, "state": STATE_IDLE, "terminal_number": terminal_number}
        return {**run, "success": True, "terminal_number": terminal_number}

    def _run(self, window_id: str, terminal_number: int, run: Dict[str, Any]) -> None:
        run_id = run["run_id"]
        try:
            outcome = self._execute(window_id, terminal_number, run)
        except Exception as error:  # noqa: BLE001 - thread boundary: the run must always end in a final state
            terminal_activity_log.error(
                "quick_command.crashed",
                terminal_number=terminal_number,
                run_id=run_id,
                error_type=type(error).__name__,
                error=error,
            )
            outcome = {"success": False, "error_code": ERROR_RUN_FAILED}
        success = bool(outcome.get("success"))
        error_code = None if success else str(outcome.get("error_code") or ERROR_RUN_FAILED)
        self._update(
            terminal_number,
            state=STATE_DONE if success else STATE_FAILED,
            phase=PHASE_DONE if success else self.status(terminal_number)["phase"],
            error_code=error_code,
            finished_at=utc_now_ms(),
        )
        (terminal_activity_log.success if success else terminal_activity_log.warning)(
            "quick_command.finished",
            terminal_number=terminal_number,
            run_id=run_id,
            success=success,
            error_code=error_code,
        )

    def _execute(self, window_id: str, terminal_number: int, run: Dict[str, Any]) -> Dict[str, Any]:
        policy = INTERRUPT_POLICY
        probe = self._classify(window_id, terminal_number, run)
        idle = probe is not None and probe.idle
        terminal_activity_log.info(
            "quick_command.probe",
            terminal_number=terminal_number,
            run_id=run["run_id"],
            state=probe.state if probe else None,
            rule=probe.rule if probe else None,
            line=probe.line if probe else None,
        )
        count = int(policy["idle_ctrl_c_count"] if idle else policy["ctrl_c_count"])
        self._update(terminal_number, shell_idle=idle, ctrl_c_count=count)
        for index in range(count):
            if index:
                time.sleep(policy["interval_ms"] / MS_PER_SECOND)
            pressed = self._press_ctrl_c(window_id, terminal_number, run, index + 1, count)
            if not pressed.get("success"):
                return pressed
            self._update(terminal_number, ctrl_c_sent=index + 1)

        self._update(terminal_number, phase=PHASE_WAITING)
        settle_ms = policy["idle_settle_ms"] if idle else policy["settle_ms"]
        ready = self._await_shell_prompt(window_id, terminal_number, run, policy, settle_ms)
        if not ready.get("success"):
            return ready

        self._update(terminal_number, phase=PHASE_TYPING)
        typed = terminal_service.input_text(
            window_id,
            terminal_number,
            run["line"],
            source=SOURCE_QUICK,
            shell_os=run["platform"],
        )
        terminal_activity_log.info(
            "quick_command.typed",
            terminal_number=terminal_number,
            run_id=run["run_id"],
            line=run["line"],
            success=typed.get("success"),
            error_code=typed.get("error_code"),
        )
        return typed

    def _press_ctrl_c(self, window_id: str, terminal_number: int, run: Dict[str, Any], press: int, count: int) -> Dict[str, Any]:
        pressed = terminal_service.press_key(window_id, KEY_CTRL_C)
        terminal_activity_log.info(
            "quick_command.ctrl_c",
            terminal_number=terminal_number,
            run_id=run["run_id"],
            press=press,
            of=count,
            success=pressed.get("success"),
            error_code=pressed.get("error_code"),
        )
        return pressed

    def _classify(self, window_id: str, terminal_number: int, run: Dict[str, Any]) -> Optional[ShellState]:
        exported = terminal_service.export_text(window_id, terminal_number)
        if not exported.get("success"):
            return None
        return terminal_shell_state.classify(exported["text"], run["platform"])

    def _await_shell_prompt(
        self,
        window_id: str,
        terminal_number: int,
        run: Dict[str, Any],
        policy: Dict[str, Any],
        settle_ms: float,
    ) -> Dict[str, Any]:
        """Poll until an idle prompt shows and the tail stays unchanged; a screen still busy gets another
        spaced Ctrl+C every reinterrupt_polls polls (at most max_reinterrupts); bounded by max_wait_ms."""
        time.sleep(settle_ms / MS_PER_SECOND)
        deadline = time.monotonic() + policy["max_wait_ms"] / MS_PER_SECOND
        previous: Optional[ShellState] = None
        stable = 0
        polls = 0
        busy_polls = 0
        reinterrupts = 0
        while True:
            state = self._classify(window_id, terminal_number, run)
            polls += 1
            self._update(terminal_number, polls=polls)
            idle = state is not None and state.idle
            stable = stable + 1 if idle and previous is not None and state.tail == previous.tail else 0
            previous = state
            if idle and stable + 1 >= int(policy["stable_polls"]):
                terminal_activity_log.info(
                    "quick_command.prompt_ready",
                    terminal_number=terminal_number,
                    run_id=run["run_id"],
                    polls=polls,
                    rule=state.rule,
                    prompt=state.line,
                )
                return {"success": True, "error_code": None}
            if time.monotonic() >= deadline:
                terminal_activity_log.warning(
                    "quick_command.idle_timeout",
                    terminal_number=terminal_number,
                    run_id=run["run_id"],
                    polls=polls,
                    state=state.state if state else None,
                    rule=state.rule if state else None,
                    last_line=state.line if state else "",
                )
                return {"success": False, "error_code": ERROR_IDLE_TIMEOUT}
            busy_polls = 0 if idle else busy_polls + 1
            if busy_polls >= int(policy["reinterrupt_polls"]) and reinterrupts < int(policy["max_reinterrupts"]):
                busy_polls = 0
                reinterrupts += 1
                pressed = self._press_ctrl_c(window_id, terminal_number, run, reinterrupts, int(policy["max_reinterrupts"]))
                if not pressed.get("success"):
                    return pressed
            time.sleep(policy["poll_interval_ms"] / MS_PER_SECOND)


terminal_quick_command_runner = TerminalQuickCommandRunner()

__all__ = ["TerminalQuickCommandRunner", "terminal_quick_command_runner"]
