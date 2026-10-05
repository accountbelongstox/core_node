# -*- coding: utf-8 -*-
"""
Agent history TXT store: paths and read/write of the per-session transcript
and prompt-edit files (format primitives live in ``txt_format``).

Human-readable, block-delimited text files under ``<cache>/pycore/.ai_state/agent_history/``.
The session index, flat prompt list and extract state live in the SQLite
store (``agent_history_index``); the ``read_legacy_*`` readers exist only for
its one-shot import of the pre-SQLite files.

Files:
  sessions/<id>.txt   full transcript (@prompt + @turn blocks)
  prompt_edits.txt    user edit overlay (key=value per line: id=...|text=...)
  state.txt, index.txt, prompts.txt   pre-SQLite files (imported once)
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.root_spool import SPOOL_DIR_MODE, SPOOL_FILE_MODE
from pycore.pyctl.agent_history.txt_format import (
    csv_list,
    escape_value,
    format_block,
    parse_blocks,
    parse_kv_lines,
    to_bool,
    to_int,
    unescape_value,
)
from pycore.pyfoundations.atomic_json_store import atomic_write_text
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import AI_LEGACY_DIR, AI_SHARED_STATE_DIR


ARTICLE_FRAGMENT_BOOLEAN_FIELDS = ("article_boundary", "direct_text")

_SHARED_STATE_DIR = AI_SHARED_STATE_DIR / "agent_history"
_LEGACY_DIR = AI_LEGACY_DIR / "agent_history"


def restrict_mode(path: Path, mode: int, label: str) -> None:
    """Best-effort chmod (skipped on Windows, a condition not an except).

    Shared by every store under this package (the txt store here and the
    prompt archive) so there is exactly one chmod-with-logging helper."""
    if os.name == "nt":
        return
    try:
        os.chmod(path, mode)
    except OSError as exc:
        ColorPrint.yellow(
            f"[AgentHistory] {label} chmod failed path={path} mode={oct(mode)} errno={exc.errno}"
        )


def _restricted_dir(path: Path) -> Path:
    """mkdir + restrict to the root-spool dir mode; the store may mix
    root-only sessions into shared files, so the whole store is kept as
    tight as the root-spool output it can carry."""
    path.mkdir(parents=True, exist_ok=True)
    restrict_mode(path, SPOOL_DIR_MODE, "Store dir")
    return path


def store_dir() -> Path:
    try:
        return _restricted_dir(_SHARED_STATE_DIR)
    except OSError as exc:
        ColorPrint.yellow(
            f"[AgentHistory] Shared store dir unavailable path={_SHARED_STATE_DIR}, "
            f"using legacy dir {_LEGACY_DIR}: {exc}"
        )
        return _restricted_dir(_LEGACY_DIR)


def sessions_dir() -> Path:
    return _restricted_dir(store_dir() / "sessions")


def safe_id(raw: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]", "-", raw or "")
    clean = clean.strip("-")
    return clean or "unknown"


def _atomic_write(path: Path, content: str) -> bool:
    try:
        atomic_write_text(path, content, SPOOL_FILE_MODE)
    except OSError as exc:
        ColorPrint.red(f"[AgentHistory] Store write failed path={path}: {exc}")
        return False
    return True


def _read_text(path: Path) -> Optional[str]:
    """File text, or None when absent or unreadable (reported)."""
    if not path.is_file():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Store read failed path={path}: {exc}")
        return None


def _json_field(data: Dict[str, Any], key: str, default: Any) -> Any:
    raw = data.get(key)
    if not isinstance(raw, str):
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        ColorPrint.yellow(f"[AgentHistory] Store state field {key} is not JSON: {exc}")
        return default


def read_legacy_state() -> Dict[str, Any]:
    raw = _read_text(store_dir() / "state.txt")
    if raw is None:
        return {}
    data = parse_kv_lines(raw)
    data["sources"] = _json_field(data, "sources_json", {})
    data["counts"] = _json_field(data, "counts", data.get("counts"))
    return data


def read_legacy_index() -> Dict[str, Any]:
    raw = _read_text(store_dir() / "index.txt")
    if raw is None:
        return {}
    meta = parse_kv_lines(raw.split("@session", 1)[0] if "@session" in raw else raw)
    sessions: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker != "@session":
            continue
        sess = dict(fields)
        for key in ("started_ts", "ended_ts", "prompt_count", "message_count", "bytes", "source_mtime"):
            if key in sess:
                sess[key] = to_int(sess[key])
        sess["has_subagent"] = to_bool(sess.get("has_subagent"))
        sess["models"] = csv_list(sess.get("models"))
        sessions.append(sess)
    meta["sessions"] = sessions
    meta["tools"] = csv_list(meta.get("tools"))
    meta["users"] = csv_list(meta.get("users"))
    meta["langs"] = csv_list(meta.get("langs"))
    meta["sessions_count"] = to_int(meta.get("sessions_count")) or len(sessions)
    return meta


def read_legacy_prompts() -> List[Dict[str, Any]]:
    raw = _read_text(store_dir() / "prompts.txt")
    if raw is None:
        return []
    out: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker != "@prompt":
            continue
        fields["ts"] = to_int(fields.get("ts"))
        fields["edited"] = to_bool(fields.get("edited"))
        out.append(fields)
    return [p for p in out if (p.get("text") or "").strip()]


def read_session(session_id: str) -> Optional[Dict[str, Any]]:
    raw = _read_text(sessions_dir() / f"{safe_id(session_id)}.txt")
    if raw is None:
        return None
    meta = parse_kv_lines(raw.split("@prompt", 1)[0] if "@prompt" in raw else raw.split("@turn", 1)[0])
    prompts: List[Dict[str, Any]] = []
    turns: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker not in ("@prompt", "@turn"):
            continue
        fields["ts"] = to_int(fields.get("ts"))
        for field in ARTICLE_FRAGMENT_BOOLEAN_FIELDS:
            fields[field] = to_bool(fields.get(field))
        if marker == "@prompt":
            fields["edited"] = to_bool(fields.get("edited"))
            prompts.append(fields)
        else:
            fields["is_subagent"] = to_bool(fields.get("is_subagent"))
            turns.append(fields)
    detail = dict(meta)
    for key in ("started_ts", "ended_ts", "prompt_count", "message_count", "bytes"):
        if key in detail:
            detail[key] = to_int(detail[key])
    detail["has_subagent"] = to_bool(detail.get("has_subagent"))
    detail["models"] = csv_list(detail.get("models"))
    detail["prompts"] = prompts
    detail["turns"] = turns
    return detail


def write_session(session_id: str, detail: Dict[str, Any]) -> None:
    sid = safe_id(session_id)
    header = format_block("@meta", {
        "id": detail.get("id", session_id),
        "raw_id": detail.get("raw_id", ""),
        "tool": detail.get("tool", ""),
        "os_user": detail.get("os_user", ""),
        "project": detail.get("project", ""),
        "title": detail.get("title", ""),
        "started_ts": detail.get("started_ts", 0),
        "started_at": detail.get("started_at", ""),
        "ended_at": detail.get("ended_at", ""),
        "ended_ts": detail.get("ended_ts", 0),
        "prompt_count": detail.get("prompt_count", 0),
        "message_count": detail.get("message_count", 0),
        "has_subagent": bool(detail.get("has_subagent")),
        "models": ",".join(detail.get("models") or []),
        "source_path": detail.get("source_path", ""),
        "bytes": detail.get("bytes", 0),
    })
    parts = [header]
    for p in detail.get("prompts") or []:
        parts.append(format_block("@prompt", {
            "id": p.get("id", ""),
            "ts": p.get("ts", 0),
            "edited": bool(p.get("edited")),
            "article_boundary": bool(p.get("article_boundary")),
            "direct_text": bool(p.get("direct_text")),
            "text": p.get("text") or "",
        }, body_key="text"))
    for t in detail.get("turns") or []:
        parts.append(format_block("@turn", {
            "ts": t.get("ts", 0),
            "time": t.get("time", ""),
            "role": t.get("role", ""),
            "is_subagent": bool(t.get("is_subagent")),
            "model": t.get("model") or "",
            "name": t.get("name") or "",
            "article_boundary": bool(t.get("article_boundary")),
            "direct_text": bool(t.get("direct_text")),
            "text": t.get("text") or "",
        }, body_key="text"))
    _atomic_write(sessions_dir() / f"{sid}.txt", "".join(parts))


def read_edits() -> Dict[str, Dict[str, str]]:
    raw = _read_text(store_dir() / "prompt_edits.txt")
    if raw is None:
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "|" not in line:
            continue
        pid, text = line.split("|", 1)
        out[pid] = {"text": unescape_value(text)}
    return out


def write_edits(edits: Dict[str, Dict[str, str]]) -> None:
    lines = ["# prompt edits\n"]
    for pid, rec in edits.items():
        lines.append(f"{pid}|{escape_value(rec.get('text', ''))}\n")
    _atomic_write(store_dir() / "prompt_edits.txt", "".join(lines))


