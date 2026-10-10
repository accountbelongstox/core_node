# -*- coding: utf-8 -*-
"""Virtual agent terminals: AI CLI conversations without a desktop window (VM servers, headless hosts).

Each virtual window is one conversation of claudeteam, codexyolo, deepseek (dsh) or agyyolo. A message
runs one headless turn of that CLI in the background; the conversation id the CLI reports is stored, so
the next message resumes the same conversation. The transcript is the window's text.
"""

from __future__ import annotations

import os
import subprocess
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyctl.terminal.terminal_state_keys import TERMINAL_DATA_DIR
from pycore.pyctl.terminal.terminal_text_buffer import terminal_text_buffer
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.process_manager import process_manager
from pycore.pyfoundations.pygvar import IS_WINDOWS, PROJECT_ROOT
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.time_utils import utc_now_iso
from pycore.pyutils.agent_cli.headless_agent_cli import (
    AGENT_KINDS,
    ERROR_CLI_FAILED,
    ERROR_NO_REPLY,
    PRINT_PROMPT_PREFIX,
    build_turn_command,
    parse_turn_output,
)
from pycore.pyutils.window.terminal_backend import build_terminal_window

VIRTUAL_WINDOW_PREFIX = "virtual:"
VIRTUAL_CLASS_NAME = "pycore_virtual_agent"
VIRTUAL_CONTROL = "virtual"
STORE_PATH = TERMINAL_DATA_DIR / "virtual_agents.json"
MAX_TURNS = 200
STDERR_TAIL_LINES = 20
TITLE_TOPIC_MAX_CHARS = 48
# Title glyphs follow Claude Code (working / idle), so agent detection and done notifications apply.
GLYPH_RUNNING = "◐"
GLYPH_IDLE = "✳"
TITLE_SEPARATOR = " · "
USER_MARK = "›"
REPLY_MARK = "●"
ERROR_MARK = "✗"
CONTINUATION_INDENT = "  "
STATUS_IDLE = "idle"
STATUS_RUNNING = "running"
TURN_RUNNING = "running"
TURN_DONE = "done"
TURN_FAILED = "failed"
TURN_CANCELLED = "cancelled"
TURN_INTERRUPTED = "interrupted"
CREATE_NO_WINDOW = 0x08000000
ERROR_KIND_INVALID = "terminal_virtual_kind_invalid"
ERROR_NOT_FOUND = "terminal_virtual_not_found"
ERROR_BUSY = "terminal_virtual_busy"


def is_virtual_window(window_id: str) -> bool:
    return str(window_id or "").startswith(VIRTUAL_WINDOW_PREFIX)


class VirtualAgentRunThread(threading.Thread):
    """One headless CLI turn: start the process, feed the prompt, hand the output back to the owner."""

    def __init__(
        self,
        owner: "VirtualAgentTerminals",
        window_id: str,
        turn_id: str,
        argv: List[str],
        env: Dict[str, str],
        stdin_text: Optional[str],
    ) -> None:
        super().__init__(name=f"VirtualAgentRunThread-{turn_id[:8]}", daemon=True)
        self._owner = owner
        self._window_id = window_id
        self._turn_id = turn_id
        self._argv = argv
        self._env = env
        self._stdin_text = stdin_text

    def run(self) -> None:
        try:
            process = subprocess.Popen(
                self._argv,
                stdin=subprocess.PIPE if self._stdin_text is not None else subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=PROJECT_ROOT,
                env=self._env,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=CREATE_NO_WINDOW if IS_WINDOWS else 0,
            )
            self._owner.attach_process(self._window_id, self._turn_id, process.pid)
            stdout, stderr = process.communicate(input=self._stdin_text)
        except OSError as error:
            terminal_activity_log.error("virtual.run.failed", window_id=self._window_id, error=error)
            self._owner.finish_turn(self._window_id, self._turn_id, -1, "", f"{type(error).__name__}: {error}")
            return
        self._owner.finish_turn(self._window_id, self._turn_id, process.returncode, stdout or "", stderr or "")


class VirtualAgentTerminals:
    def __init__(self) -> None:
        self._store = AtomicJsonStore(STORE_PATH, dict)
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._numbers: Dict[str, int] = {}
        self._pids: Dict[str, int] = {}
        self._listener: Optional[Callable[[], Any]] = None
        self._loaded = False
        init_serialized_owner(self, "pyctl.terminal.virtual_agents", "VirtualAgentTerminals")

    def set_change_listener(self, listener: Callable[[], Any]) -> None:
        """Called (on its own thread) after a window appeared, closed or changed its state."""
        self._listener = listener

    @serialized_method
    def create(self, kind: str) -> Dict[str, Any]:
        if kind not in AGENT_KINDS:
            return self._failure(ERROR_KIND_INVALID)
        self._load()
        window_id = f"{VIRTUAL_WINDOW_PREFIX}{uuid.uuid4().hex[:12]}"
        self._sessions[window_id] = {
            "id": window_id,
            "kind": kind,
            "conversation_id": "",
            "status": STATUS_IDLE,
            "created_at": utc_now_iso(),
            "turns": [],
        }
        self._persist()
        terminal_activity_log.info("virtual.created", window_id=window_id, kind=kind)
        self._notify()
        return {"success": True, "error_code": None, "window_id": window_id, "kind": kind}

    @serialized_method
    def close(self, window_id: str) -> Dict[str, Any]:
        """Stop a running turn and forget the window; returns its terminal number for the stored-state cleanup."""
        self._load()
        if self._sessions.pop(window_id, None) is None:
            return self._failure(ERROR_NOT_FOUND)
        self._kill(window_id)
        terminal_number = self._numbers.pop(window_id, 0)
        self._persist()
        terminal_activity_log.info("virtual.closed", window_id=window_id, terminal_number=terminal_number)
        return {"success": True, "error_code": None, "window_id": window_id, "terminal_number": terminal_number}

    @serialized_method
    def windows(self, platform_name: str) -> List[Dict[str, Any]]:
        self._load()
        return [self._window(session, platform_name) for session in self._sessions.values()]

    @serialized_method
    def bind(self, windows: List[Dict[str, Any]]) -> None:
        """Record the terminal numbers the snapshot assigned and keep each window's text current."""
        for window in windows:
            window_id = str(window.get("id") or "")
            number = int(window.get("terminal_number") or 0)
            if window_id in self._sessions and number > 0:
                self._numbers[window_id] = number
                self._offer(window_id)

    @serialized_method
    def send(self, window_id: str, text: str, interrupt: bool = False) -> Dict[str, Any]:
        self._load()
        session = self._sessions.get(window_id)
        if session is None:
            return self._failure(ERROR_NOT_FOUND)
        if session["status"] == STATUS_RUNNING:
            if not interrupt:
                return self._failure(ERROR_BUSY)
            self._cancel_running(session)
        argv, extra_env, error_code = build_turn_command(session["kind"], session["conversation_id"], text)
        turn = {
            "id": uuid.uuid4().hex,
            "prompt": text,
            "reply": "",
            "status": TURN_RUNNING,
            "error": "",
            "started_at": utc_now_iso(),
            "finished_at": "",
        }
        session["turns"] = [*session["turns"], turn][-MAX_TURNS:]
        if argv is None:
            self._finish(session, turn, TURN_FAILED, error=error_code)
            return self._failure(error_code)
        session["status"] = STATUS_RUNNING
        self._persist()
        self._offer(window_id)
        environment = {**os.environ, **extra_env}
        stdin_text = None if any(argument.startswith(PRINT_PROMPT_PREFIX) for argument in argv) else text
        VirtualAgentRunThread(self, window_id, turn["id"], argv, environment, stdin_text).start()
        terminal_activity_log.info(
            "virtual.turn.started",
            window_id=window_id,
            kind=session["kind"],
            resumed=bool(session["conversation_id"]),
        )
        self._notify()
        return {"success": True, "error_code": None, "window_id": window_id, "turn_id": turn["id"]}

    @serialized_method
    def cancel(self, window_id: str) -> Dict[str, Any]:
        self._load()
        session = self._sessions.get(window_id)
        if session is None:
            return self._failure(ERROR_NOT_FOUND)
        if session["status"] == STATUS_RUNNING:
            self._cancel_running(session)
            self._persist()
            self._offer(window_id)
            self._notify()
        return {"success": True, "error_code": None, "window_id": window_id}

    @serialized_method
    def transcript(self, window_id: str) -> Optional[str]:
        self._load()
        session = self._sessions.get(window_id)
        return None if session is None else self._transcript(session)

    @serialized_method
    def attach_process(self, window_id: str, turn_id: str, pid: int) -> None:
        turn = self._turn(window_id, turn_id)
        if turn is None or turn["status"] != TURN_RUNNING:
            process_manager.kill_process_tree(pid)
            return
        self._pids[window_id] = pid

    @serialized_method
    def finish_turn(self, window_id: str, turn_id: str, return_code: int, stdout: str, stderr: str) -> None:
        session = self._sessions.get(window_id)
        turn = self._turn(window_id, turn_id)
        if session is None or turn is None or turn["status"] != TURN_RUNNING:
            return
        self._pids.pop(window_id, None)
        parsed = parse_turn_output(session["kind"], stdout)
        if parsed.conversation_id:
            session["conversation_id"] = parsed.conversation_id
        turn["reply"] = parsed.reply.strip()
        error = parsed.error
        if not error and return_code != 0:
            error = f"{ERROR_CLI_FAILED} ({return_code})"
        if not error and not parsed.reply:
            error = ERROR_NO_REPLY
        if error:
            stderr_lines = [line for line in stderr.splitlines() if line.strip()]
            detail = "\n".join(stderr_lines[-STDERR_TAIL_LINES:])
            self._finish(session, turn, TURN_FAILED, error=f"{error}\n{detail}".strip())
        else:
            self._finish(session, turn, TURN_DONE)
        terminal_activity_log.info(
            "virtual.turn.finished",
            window_id=window_id,
            kind=session["kind"],
            return_code=return_code,
            success=not error,
            conversation_id=session["conversation_id"],
        )

    def _finish(self, session: Dict[str, Any], turn: Dict[str, Any], status: str, error: str = "") -> None:
        turn["status"] = status
        turn["error"] = error
        turn["finished_at"] = utc_now_iso()
        session["status"] = STATUS_IDLE
        self._persist()
        self._offer(session["id"])
        self._notify()

    def _cancel_running(self, session: Dict[str, Any]) -> None:
        self._kill(session["id"])
        for turn in session["turns"]:
            if turn["status"] == TURN_RUNNING:
                turn["status"] = TURN_CANCELLED
                turn["finished_at"] = utc_now_iso()
        session["status"] = STATUS_IDLE

    def _kill(self, window_id: str) -> None:
        pid = self._pids.pop(window_id, 0)
        if pid > 0:
            process_manager.kill_process_tree(pid)

    def _turn(self, window_id: str, turn_id: str) -> Optional[Dict[str, Any]]:
        session = self._sessions.get(window_id)
        if session is None:
            return None
        return next((turn for turn in session["turns"] if turn["id"] == turn_id), None)

    def _load(self) -> None:
        """Read the stored windows once; a turn that was running when pycore stopped is marked interrupted."""
        if self._loaded:
            return
        self._loaded = True
        sessions = self._store.read().get("sessions") or {}
        for window_id, session in sessions.items():
            if not is_virtual_window(window_id) or session.get("kind") not in AGENT_KINDS:
                continue
            for turn in session.get("turns") or []:
                if turn.get("status") == TURN_RUNNING:
                    turn["status"] = TURN_INTERRUPTED
            session["status"] = STATUS_IDLE
            self._sessions[window_id] = session

    def _persist(self) -> None:
        self._store.write({"sessions": self._sessions})

    def _offer(self, window_id: str) -> None:
        number = self._numbers.get(window_id, 0)
        session = self._sessions.get(window_id)
        if number > 0 and session is not None:
            terminal_text_buffer.offer(number, window_id, self._transcript(session))

    def _notify(self) -> None:
        if self._listener is not None:
            start_bus_task(self._listener, thread_name="VirtualAgentNotifyThread")

    @staticmethod
    def _transcript(session: Dict[str, Any]) -> str:
        lines: List[str] = [f"{GLYPH_IDLE} {session['kind']}{TITLE_SEPARATOR}{session.get('conversation_id') or '-'}", ""]
        for turn in session["turns"]:
            lines.extend(VirtualAgentTerminals._marked(USER_MARK, turn["prompt"]))
            if turn["reply"]:
                lines.extend(VirtualAgentTerminals._marked(REPLY_MARK, turn["reply"]))
            if turn["status"] == TURN_RUNNING:
                lines.append(GLYPH_RUNNING)
            elif turn["status"] in (TURN_CANCELLED, TURN_INTERRUPTED):
                lines.append(f"{ERROR_MARK} {turn['status']}")
            elif turn["error"]:
                lines.extend(VirtualAgentTerminals._marked(ERROR_MARK, turn["error"]))
            lines.append("")
        return "\n".join(lines)

    @staticmethod
    def _marked(mark: str, text: str) -> List[str]:
        rows = str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n")
        return [f"{mark} {rows[0]}", *(f"{CONTINUATION_INDENT}{row}" for row in rows[1:])]

    @staticmethod
    def _window(session: Dict[str, Any], platform_name: str) -> Dict[str, Any]:
        running = session["status"] == STATUS_RUNNING
        first_prompt = next((turn["prompt"] for turn in session["turns"] if turn["prompt"].strip()), "")
        topic = " ".join(first_prompt.split())[:TITLE_TOPIC_MAX_CHARS]
        glyph = GLYPH_RUNNING if running else GLYPH_IDLE
        title = f"{glyph} {session['kind']}{TITLE_SEPARATOR}{topic}" if topic else f"{glyph} {session['kind']}"
        window = build_terminal_window(
            session["id"],
            session["id"],
            title,
            session["kind"],
            VIRTUAL_CLASS_NAME,
            0,
            False,
            0,
            0,
            1,
            1,
            VIRTUAL_CONTROL,
        )
        window["shell_os"] = platform_name
        window["virtual"] = {
            "kind": session["kind"],
            "conversation_id": session["conversation_id"],
            "status": session["status"],
            "turn_count": len(session["turns"]),
            "created_at": session["created_at"],
        }
        return window

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


virtual_agent_terminals = VirtualAgentTerminals()

__all__ = ["VirtualAgentTerminals", "is_virtual_window", "virtual_agent_terminals"]
