# -*- coding: utf-8 -*-
"""Headless (print mode) command lines of the AI coding CLIs and the parsers of their JSON output.

One turn = one process: the first turn starts a conversation, every later turn resumes it by the
conversation id the previous turn reported. Flags follow each CLI's official headless documentation:
  claude  -p --output-format json [--resume <session_id>]               (code.claude.com/docs/en/headless)
  codex   exec [resume <thread_id>] --json --dangerously-bypass-...     (codex exec --help, non-interactive mode)
  dsh     --profile headless --json [--session-id <id>] -               (deepseek-harness headless README)
  agy     --output-format json [--conversation <id>] --print=<prompt>   (antigravity.google/docs/cli/headless)
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.secret_manager import get_secret_key

AGENT_CLAUDETEAM = "claudeteam"
AGENT_CODEXYOLO = "codexyolo"
AGENT_DEEPSEEK = "deepseek"
AGENT_AGYYOLO = "agyyolo"
# Prompt read from stdin by the CLIs that accept it ("-" or a piped -p).
STDIN_PROMPT = "-"
# Executables installed by the per-user installers may be missing from a service PATH.
EXTRA_BINARY_DIRS = (
    Path.home() / ".local" / "bin",
    Path("/usr/local/bin"),
    Path("/root/.local/bin"),
)
# Same session environment as the claudeteam launcher (standalone lead, project hooks on, no auto-update).
CLAUDETEAM_ENV = {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "CLAUDE_AGENTS_SESSION": "1",
    "DISABLE_AUTOUPDATER": "1",
}
CLAUDETEAM_PERMISSION_MODE = "auto"
CODEX_YOLO_FLAGS = ("--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check")
DEEPSEEK_SECRET_KEY_NAME = "DEEPSEEK_API_KEY_1"
DEEPSEEK_HEADLESS_PROFILE = "headless"
# dsh's yolo: machine-wide writes with approval "never".
DEEPSEEK_YOLO_PERMISSION_MODE = "danger-full-access"
AGY_YOLO_FLAGS = ("--dangerously-skip-permissions", "--mode", "accept-edits")
AGY_SUCCESS_STATUS = "SUCCESS"
DSH_SESSION_EVENT = "session"
DSH_FINAL_EVENT = "final"
DSH_ERROR_EVENT = "error"
DSH_ID_KEYS = ("session_id", "sessionId", "id", "session")
DSH_TEXT_KEYS = ("text", "answer", "content", "message")
ERROR_CLI_MISSING = "agent_cli_missing"
ERROR_KEY_MISSING = "agent_cli_key_missing"
ERROR_CLI_FAILED = "agent_cli_failed"
ERROR_NO_REPLY = "agent_cli_no_reply"


@dataclass(frozen=True)
class AgentCliSpec:
    kind: str
    binary: str
    stdin_prompt: bool


@dataclass
class AgentTurnResult:
    """Outcome of one turn parsed from the CLI output."""

    conversation_id: str = ""
    reply: str = ""
    error: str = ""
    events: List[Dict[str, Any]] = field(default_factory=list)


AGENT_CLI_SPECS: Dict[str, AgentCliSpec] = {
    AGENT_CLAUDETEAM: AgentCliSpec(AGENT_CLAUDETEAM, "claude", True),
    AGENT_CODEXYOLO: AgentCliSpec(AGENT_CODEXYOLO, "codex", True),
    AGENT_DEEPSEEK: AgentCliSpec(AGENT_DEEPSEEK, "dsh", True),
    AGENT_AGYYOLO: AgentCliSpec(AGENT_AGYYOLO, "agy", False),
}
AGENT_KINDS: Tuple[str, ...] = tuple(AGENT_CLI_SPECS)


def resolve_binary(binary: str) -> Optional[str]:
    search_path = os.pathsep.join([os.environ.get("PATH", ""), *(str(directory) for directory in EXTRA_BINARY_DIRS)])
    return shutil.which(binary, path=search_path)


def agent_kinds() -> List[Dict[str, Any]]:
    """Every agent kind with whether its CLI is installed on this machine."""
    return [
        {"kind": spec.kind, "binary": spec.binary, "available": resolve_binary(spec.binary) is not None}
        for spec in AGENT_CLI_SPECS.values()
    ]


def build_turn_command(kind: str, conversation_id: str, prompt: str) -> Tuple[Optional[List[str]], Dict[str, str], str]:
    """(argv, extra environment, error_code) of one headless turn; argv is None when the turn cannot start."""
    spec = AGENT_CLI_SPECS[kind]
    executable = resolve_binary(spec.binary)
    if executable is None:
        return None, {}, ERROR_CLI_MISSING
    if kind == AGENT_CLAUDETEAM:
        argv = [executable, "-p", "--output-format", "json", "--permission-mode", CLAUDETEAM_PERMISSION_MODE]
        if conversation_id:
            argv += ["--resume", conversation_id]
        return argv, dict(CLAUDETEAM_ENV), ""
    if kind == AGENT_CODEXYOLO:
        argv = [executable, "exec"]
        if conversation_id:
            argv += ["resume", *CODEX_YOLO_FLAGS, conversation_id, STDIN_PROMPT]
        else:
            argv += [*CODEX_YOLO_FLAGS, STDIN_PROMPT]
        return argv, {}, ""
    if kind == AGENT_DEEPSEEK:
        api_key = get_secret_key(DEEPSEEK_SECRET_KEY_NAME)
        if not api_key:
            return None, {}, ERROR_KEY_MISSING
        argv = [executable, "--profile", DEEPSEEK_HEADLESS_PROFILE, "--json"]
        if conversation_id:
            argv += ["--session-id", conversation_id]
        argv.append(STDIN_PROMPT)
        return argv, {"DEEPSEEK_API_KEY": api_key, "DSH_PERMISSION_MODE": DEEPSEEK_YOLO_PERMISSION_MODE}, ""
    argv = [executable, "--output-format", "json", *AGY_YOLO_FLAGS]
    if conversation_id:
        argv += ["--conversation", conversation_id]
    argv.append(f"--print={prompt}")
    return argv, {}, ""


def _json_lines(output: str) -> List[Dict[str, Any]]:
    """JSON objects printed one per line; any other line (banners, warnings) is skipped."""
    events: List[Dict[str, Any]] = []
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped.startswith("{"):
            continue
        try:
            value = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            events.append(value)
    return events


def _first_text(event: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    return next((str(event[key]) for key in keys if isinstance(event.get(key), str) and event[key]), "")


def parse_turn_output(kind: str, output: str) -> AgentTurnResult:
    events = _json_lines(output)
    result = AgentTurnResult(events=events)
    if kind == AGENT_CLAUDETEAM:
        final = next((event for event in reversed(events) if event.get("type") == "result"), None)
        if final is not None:
            result.conversation_id = str(final.get("session_id") or "")
            result.reply = str(final.get("result") or "")
            if final.get("is_error"):
                result.error = str(final.get("subtype") or ERROR_CLI_FAILED)
    elif kind == AGENT_CODEXYOLO:
        replies: List[str] = []
        for event in events:
            event_type = str(event.get("type") or "")
            item = event.get("item") if isinstance(event.get("item"), dict) else {}
            if event_type == "thread.started":
                result.conversation_id = str(event.get("thread_id") or "")
            elif event_type == "item.completed" and item.get("type") == "agent_message":
                replies.append(str(item.get("text") or ""))
            elif event_type in ("turn.failed", "error"):
                error = event.get("error")
                result.error = str(error.get("message") if isinstance(error, dict) else event.get("message") or ERROR_CLI_FAILED)
        result.reply = "\n\n".join(reply for reply in replies if reply)
    elif kind == AGENT_DEEPSEEK:
        for event in events:
            event_type = str(event.get("type") or event.get("event") or "")
            if event_type == DSH_SESSION_EVENT:
                result.conversation_id = _first_text(event, DSH_ID_KEYS)
            elif event_type == DSH_FINAL_EVENT:
                result.reply = _first_text(event, DSH_TEXT_KEYS)
            elif event_type == DSH_ERROR_EVENT:
                result.error = _first_text(event, DSH_TEXT_KEYS) or ERROR_CLI_FAILED
    else:
        final = events[-1] if events else None
        if final is not None:
            result.conversation_id = str(final.get("conversation_id") or "")
            result.reply = str(final.get("response") or "")
            status = str(final.get("status") or "")
            if status and status != AGY_SUCCESS_STATUS:
                result.error = str(final.get("error") or status)
    return result


__all__ = [
    "AGENT_KINDS",
    "AgentTurnResult",
    "ERROR_CLI_FAILED",
    "ERROR_NO_REPLY",
    "agent_kinds",
    "build_turn_command",
    "parse_turn_output",
]
