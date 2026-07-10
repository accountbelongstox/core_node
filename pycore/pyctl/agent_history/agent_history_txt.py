# -*- coding: utf-8 -*-
"""
Agent history TXT parse/format library.

Human-readable, block-delimited text files under ``<core_node>/.data/.ai_state/agent_history/``.
No database — all persistence is flat txt that both humans and the parser can read.

Files:
  state.txt           extraction signature + per-source mtimes (key=value lines)
  index.txt           session summaries (@session blocks)
  prompts.txt         flat newest-first prompt list (@prompt blocks)
  sessions/<id>.txt   full transcript (@prompt + @turn blocks)
  prompt_edits.txt    user edit overlay (key=value per line: id=...|text=...)
"""

from __future__ import annotations

import os
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.system_paths import APP_DATA_DIR, get_core_node_root

TEXT_END = "TEXT>>>"
TEXT_START = "<<<TEXT"
BLOCK_MARKERS = ("@session", "@prompt", "@turn", "@meta")

_SHARED_STATE_DIR = get_core_node_root() / ".data" / ".ai_state" / "agent_history"
_LEGACY_DIR = APP_DATA_DIR / "ai_state" / "agent_history"

_lock = threading.Lock()


def store_dir() -> Path:
    try:
        _SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
        return _SHARED_STATE_DIR
    except OSError:
        _LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return _LEGACY_DIR


def sessions_dir() -> Path:
    d = store_dir() / "sessions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def safe_id(raw: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]", "-", raw or "")
    clean = clean.strip("-")
    return clean or "unknown"


def _atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}")
    try:
        tmp.write_text(content, encoding="utf-8")
        os.replace(str(tmp), str(path))
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def _escape_value(val: str) -> str:
    return (val or "").replace("\r\n", "\n").replace("\n", "\\n")


def _unescape_value(val: str) -> str:
    return (val or "").replace("\\n", "\n")


def format_kv_lines(data: Dict[str, Any]) -> str:
    lines = ["# agent-history kv"]
    for k, v in data.items():
        if isinstance(v, bool):
            lines.append(f"{k}={'true' if v else 'false'}")
        elif isinstance(v, (list, dict)):
            import json
            lines.append(f"{k}={json.dumps(v, ensure_ascii=False)}")
        else:
            lines.append(f"{k}={_escape_value(str(v))}")
    return "\n".join(lines) + "\n"


def parse_kv_lines(text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for line in (text or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        val = _unescape_value(val)
        if val in ("true", "false"):
            out[key] = val == "true"
        else:
            out[key] = val
    return out


def format_block(marker: str, fields: Dict[str, Any], body_key: Optional[str] = None) -> str:
    lines = [marker]
    body = ""
    for k, v in fields.items():
        if body_key and k == body_key:
            body = str(v or "")
            continue
        if isinstance(v, bool):
            lines.append(f"{k}={'true' if v else 'false'}")
        elif isinstance(v, list):
            lines.append(f"{k}={','.join(str(x) for x in v)}")
        else:
            lines.append(f"{k}={_escape_value(str(v))}")
    if body_key:
        lines.append(TEXT_START)
        lines.append(body)
        lines.append(TEXT_END)
    return "\n".join(lines) + "\n\n"


def parse_blocks(text: str) -> List[Tuple[str, Dict[str, Any]]]:
    """Return list of (marker, fields) including multiline TEXT bodies."""
    blocks: List[Tuple[str, Dict[str, Any]]] = []
    if not text:
        return blocks

    current_marker = ""
    fields: Dict[str, Any] = {}
    body_key: Optional[str] = None
    body_lines: List[str] = []
    in_body = False

    def flush() -> None:
        nonlocal fields, body_key, body_lines, in_body
        if current_marker:
            if body_key and body_lines:
                fields[body_key] = "\n".join(body_lines)
            blocks.append((current_marker, dict(fields)))
        fields = {}
        body_key = None
        body_lines = []
        in_body = False

    for line in text.splitlines():
        if line in BLOCK_MARKERS:
            flush()
            current_marker = line
            continue
        if line == TEXT_START:
            in_body = True
            body_key = "text"
            body_lines = []
            continue
        if line == TEXT_END:
            in_body = False
            continue
        if in_body:
            body_lines.append(line)
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            fields[k] = _unescape_value(v)

    flush()
    return blocks


def read_state() -> Dict[str, Any]:
    path = store_dir() / "state.txt"
    if not path.is_file():
        return {}
    try:
        data = parse_kv_lines(path.read_text(encoding="utf-8"))
        sources_raw = data.get("sources_json", "[]")
        import json
        try:
            data["sources"] = json.loads(str(sources_raw))
        except json.JSONDecodeError:
            data["sources"] = {}
        return data
    except OSError:
        return {}


def write_state(data: Dict[str, Any]) -> None:
    import json
    payload = dict(data)
    sources = payload.pop("sources", {})
    payload["sources_json"] = json.dumps(sources, ensure_ascii=False)
    _atomic_write(store_dir() / "state.txt", format_kv_lines(payload))


def read_index() -> Dict[str, Any]:
    path = store_dir() / "index.txt"
    if not path.is_file():
        return {}
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    meta = parse_kv_lines(raw.split("@session", 1)[0] if "@session" in raw else raw)
    sessions: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker != "@session":
            continue
        sess = dict(fields)
        for key in ("started_ts", "prompt_count", "message_count", "bytes", "source_mtime"):
            if key in sess:
                try:
                    sess[key] = int(sess[key])
                except (TypeError, ValueError):
                    sess[key] = 0
        sess["has_subagent"] = str(sess.get("has_subagent", "")).lower() == "true"
        models = sess.get("models", "")
        sess["models"] = [m for m in str(models).split(",") if m] if models else []
        sessions.append(sess)
    meta["sessions"] = sessions
    tools = meta.get("tools", "")
    users = meta.get("users", "")
    meta["tools"] = [t for t in str(tools).split(",") if t] if tools else []
    meta["users"] = [u for u in str(users).split(",") if u] if users else []
    langs = meta.get("langs", "")
    meta["langs"] = [l for l in str(langs).split(",") if l] if langs else []
    return meta


def write_index(data: Dict[str, Any]) -> None:
    tools = ",".join(data.get("tools") or [])
    users = ",".join(data.get("users") or [])
    langs = ",".join(data.get("langs") or [])
    header = format_kv_lines({
        "generated_at": data.get("generated_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "is_dev_machine": bool(data.get("is_dev_machine")),
        "tools": tools,
        "users": users,
        "langs": langs,
        "sessions_count": len(data.get("sessions") or []),
    }).rstrip() + "\n\n"
    parts = [header]
    for s in data.get("sessions") or []:
        parts.append(format_block("@session", {
            "id": s.get("id", ""),
            "raw_id": s.get("raw_id", ""),
            "tool": s.get("tool", ""),
            "os_user": s.get("os_user", ""),
            "project": s.get("project", ""),
            "title": s.get("title", ""),
            "started_ts": s.get("started_ts", 0),
            "started_at": s.get("started_at", ""),
            "ended_at": s.get("ended_at", ""),
            "prompt_count": s.get("prompt_count", 0),
            "message_count": s.get("message_count", 0),
            "has_subagent": bool(s.get("has_subagent")),
            "models": ",".join(s.get("models") or []),
            "session_file": s.get("file") or f"{safe_id(s.get('id', ''))}.txt",
            "bytes": s.get("bytes", 0),
        }))
    _atomic_write(store_dir() / "index.txt", "".join(parts))


def read_prompts() -> List[Dict[str, Any]]:
    path = store_dir() / "prompts.txt"
    if not path.is_file():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return []
    out: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker != "@prompt":
            continue
        try:
            fields["ts"] = int(fields.get("ts") or 0)
        except (TypeError, ValueError):
            fields["ts"] = 0
        fields["edited"] = str(fields.get("edited", "")).lower() == "true"
        out.append(fields)
    return out


def write_prompts(prompts: List[Dict[str, Any]]) -> None:
    parts = ["# agent-history prompts\n\n"]
    for p in prompts:
        parts.append(format_block("@prompt", {
            "id": p.get("id", ""),
            "tool": p.get("tool", ""),
            "os_user": p.get("os_user", ""),
            "project": p.get("project", ""),
            "session_id": p.get("session_id", ""),
            "ts": p.get("ts", 0),
            "time": p.get("time", ""),
            "lang": p.get("lang", ""),
            "edited": bool(p.get("edited")),
        }, body_key="text"))
    _atomic_write(store_dir() / "prompts.txt", "".join(parts))


def read_session(session_id: str) -> Optional[Dict[str, Any]]:
    sid = safe_id(session_id)
    path = sessions_dir() / f"{sid}.txt"
    if not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    meta = parse_kv_lines(raw.split("@prompt", 1)[0] if "@prompt" in raw else raw.split("@turn", 1)[0])
    prompts: List[Dict[str, Any]] = []
    turns: List[Dict[str, Any]] = []
    for marker, fields in parse_blocks(raw):
        if marker == "@prompt":
            try:
                fields["ts"] = int(fields.get("ts") or 0)
            except (TypeError, ValueError):
                fields["ts"] = 0
            fields["edited"] = str(fields.get("edited", "")).lower() == "true"
            prompts.append(fields)
        elif marker == "@turn":
            try:
                fields["ts"] = int(fields.get("ts") or 0)
            except (TypeError, ValueError):
                fields["ts"] = 0
            fields["is_subagent"] = str(fields.get("is_subagent", "")).lower() == "true"
            turns.append(fields)
    detail = dict(meta)
    for key in ("started_ts", "prompt_count", "message_count", "bytes"):
        if key in detail:
            try:
                detail[key] = int(detail[key])
            except (TypeError, ValueError):
                detail[key] = 0
    detail["has_subagent"] = str(detail.get("has_subagent", "")).lower() == "true"
    models = detail.get("models", "")
    detail["models"] = [m for m in str(models).split(",") if m] if models else []
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
        }, body_key="text"))
    for t in detail.get("turns") or []:
        parts.append(format_block("@turn", {
            "ts": t.get("ts", 0),
            "time": t.get("time", ""),
            "role": t.get("role", ""),
            "is_subagent": bool(t.get("is_subagent")),
            "model": t.get("model") or "",
            "name": t.get("name") or "",
        }, body_key="text"))
    _atomic_write(sessions_dir() / f"{sid}.txt", "".join(parts))


def read_edits() -> Dict[str, Dict[str, str]]:
    path = store_dir() / "prompt_edits.txt"
    if not path.is_file():
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "|" not in line:
            continue
        pid, text = line.split("|", 1)
        out[pid] = {"text": _unescape_value(text)}
    return out


def write_edits(edits: Dict[str, Dict[str, str]]) -> None:
    lines = ["# prompt edits\n"]
    for pid, rec in edits.items():
        lines.append(f"{pid}|{_escape_value(rec.get('text', ''))}\n")
    _atomic_write(store_dir() / "prompt_edits.txt", "".join(lines))


def with_lock(fn):
    def wrapper(*args, **kwargs):
        with _lock:
            return fn(*args, **kwargs)
    return wrapper
