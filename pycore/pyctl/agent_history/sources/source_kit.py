# -*- coding: utf-8 -*-
"""Shared reading, normalisation and record building for every prompt source.

Readers never raise: unreadable input is reported and yields empty data.
``SessionDraft`` is the one accumulator of a parsed session (prompts, turns,
models, first/last timestamps, turn cap) used by every source format.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyctl.agent_history.agent_history_records import local_time_text
from pycore.pyfoundations.agent_paths import AGENT_HISTORY_INJECTED_PROMPT_PREFIXES
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

MAX_TURNS = 5000
MAX_TEXT = 20000
MAX_LINES = 300000
TITLE_CHARS = 120
EPOCH_MS_THRESHOLD = 1e12


def stat_source(path: str) -> Tuple[int, int]:
    """(mtime, bytes) of a source path; (0, 0) when absent or unreadable (reported)."""
    if not path or not os.path.exists(path):
        return 0, 0
    try:
        st = os.stat(path)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Source stat failed path={path}: {exc}")
        return 0, 0
    return int(st.st_mtime), int(st.st_size)


def file_descriptor(path: str) -> Dict[str, Any]:
    real = os.path.realpath(path)
    mtime, nbytes = stat_source(real)
    return {"path": real, "mtime": mtime, "bytes": nbytes}


def load_jsonl(path: str) -> List[Dict[str, Any]]:
    """Dict rows of a JSONL file; malformed lines (e.g. a line still being
    appended) are skipped and counted."""
    out: List[Dict[str, Any]] = []
    malformed = 0
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    malformed += 1
                    continue
                if isinstance(obj, dict):
                    out.append(obj)
                if len(out) >= MAX_LINES:
                    break
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] JSONL read failed path={path}: {exc}")
        return []
    if malformed:
        ColorPrint.gray(f"[AgentHistory] JSONL skipped malformed lines path={path} count={malformed}")
    return out


def load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        ColorPrint.yellow(f"[AgentHistory] JSON read failed path={path}: {exc}")
        return None


def load_records(path: str) -> Any:
    """JSONL rows for ``.jsonl`` files, the decoded document otherwise."""
    return load_jsonl(path) if path.lower().endswith(".jsonl") else load_json(path)


def read_text(path: str) -> Optional[str]:
    """Whole text file, or None when unreadable (reported)."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Text read failed path={path}: {exc}")
        return None


def ts_to_epoch(ts: Any) -> int:
    """Epoch seconds from epoch s/ms numbers, digit strings or ISO-8601; 0 when unknown."""
    if ts is None or ts == "" or isinstance(ts, bool):
        return 0
    if isinstance(ts, (int, float)) or (isinstance(ts, str) and ts.isdigit()):
        num = float(ts)
        return int(num / 1000.0 if num > EPOCH_MS_THRESHOLD else num)
    try:
        return int(datetime.fromisoformat(str(ts).replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


def first_field(row: Dict[str, Any], fields: Tuple[str, ...]) -> Any:
    """First truthy value of ``fields`` in ``row`` (None when none)."""
    for field in fields:
        value = row.get(field)
        if value:
            return value
    return None


def stringify_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        if content.get("type") == "image":
            return "[image]"
        for key in ("text", "content", "parts"):
            if key in content:
                return stringify_content(content.get(key))
        return ""
    if isinstance(content, list):
        parts: List[str] = []
        for block in content:
            if isinstance(block, dict):
                btype = block.get("type", "")
                if btype == "text":
                    parts.append(str(block.get("text", "")))
                elif btype == "image":
                    parts.append("[image]")
                else:
                    parts.append(stringify_content(block))
            else:
                parts.append(str(block))
        return "\n".join(p for p in parts if p)
    return ""


def is_injected_prompt(text: str) -> bool:
    """True for harness/system text recorded under the user role."""
    return str(text or "").lstrip().startswith(AGENT_HISTORY_INJECTED_PROMPT_PREFIXES)


def truncate(text: str) -> str:
    if len(text) <= MAX_TEXT:
        return text
    return text[:MAX_TEXT] + "\n... [truncated]"


def path_segment_after(path: str, anchor: str) -> str:
    """Path segment right after the first ``anchor`` segment ('' when absent)."""
    parts = path.replace("\\", "/").split("/")
    if anchor not in parts:
        return ""
    idx = parts.index(anchor)
    return parts[idx + 1] if idx + 1 < len(parts) else ""


def file_stem(path: str) -> str:
    return os.path.splitext(os.path.basename(path))[0]


class SessionDraft:
    """Accumulates one parsed session; ``build`` returns the session record.

    ``ts_estimated`` marks a timestamp derived from the file (mtime/order)
    instead of the record itself: such a ts moves whenever the file is
    rewritten, so the service keys the prompt id on content only (see
    agent_history_records.assign_prompt_ids)."""

    def __init__(self, tool: str, user: str, source: str) -> None:
        self.tool = tool
        self.user = user
        self.source = source
        self.prompts: List[Dict[str, Any]] = []
        self.turns: List[Dict[str, Any]] = []
        self.models: Dict[str, bool] = {}
        self.first_ts = 0
        self.last_ts = 0
        self.has_subagent = False
        self._mtime: Optional[int] = None

    @property
    def mtime(self) -> int:
        if self._mtime is None:
            self._mtime = stat_source(self.source)[0]
        return self._mtime

    def file_ts(self, offset: int = 0) -> int:
        """Fallback ts for undated records: file mtime plus a stable order offset."""
        return self.mtime + offset if self.mtime else 0

    def seen(self, ts: int) -> None:
        if ts > 0:
            self.first_ts = ts if self.first_ts <= 0 else min(self.first_ts, ts)
            self.last_ts = max(self.last_ts, ts)

    def add_model(self, model: Any) -> None:
        if isinstance(model, str) and model:
            self.models[model] = True

    def full(self) -> bool:
        return len(self.turns) >= MAX_TURNS

    def add_prompt(self, ts: int, text: str, ts_estimated: bool = False, **extra: Any) -> Dict[str, Any]:
        entry: Dict[str, Any] = {"ts": ts, "text": truncate(text)}
        if ts_estimated:
            entry["ts_estimated"] = True
        entry.update(extra)
        self.prompts.append(entry)
        return entry

    def add_turn(
        self,
        ts: int,
        role: str,
        text: str,
        is_subagent: bool = False,
        model: Optional[str] = None,
        name: Optional[str] = None,
        **flags: Any,
    ) -> Dict[str, Any]:
        entry = make_turn(ts, role, text, is_subagent, model, name)
        entry.update(flags)
        self.turns.append(entry)
        return entry

    def title_from_prompts(self, fallback: str) -> str:
        return self.prompts[0]["text"][:TITLE_CHARS] if self.prompts else fallback

    def build(
        self,
        raw_id: str,
        project: str = "",
        title: str = "",
        first_ts: int = 0,
        last_ts: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Session record, or None when no turn was parsed."""
        if not self.turns and not self.prompts:
            return None
        first = int(first_ts or self.first_ts or 0)
        last = int(last_ts or self.last_ts or 0)
        src_mtime, nbytes = stat_source(self.source)
        return {
            "tool": self.tool,
            "os_user": self.user,
            "raw_id": raw_id,
            "project": project or "",
            "title": title or "",
            "started_ts": first,
            "started_at": local_time_text(first) if first > 0 else "",
            "ended_at": local_time_text(last) if last > 0 else "",
            "ended_ts": last,
            "prompt_count": len(self.prompts),
            "message_count": len(self.turns),
            "has_subagent": self.has_subagent,
            "models": list(self.models.keys()),
            "source_path": self.source,
            "source_mtime": src_mtime,
            "bytes": nbytes,
            "prompts": self.prompts,
            "turns": self.turns,
        }


def make_turn(
    ts: int,
    role: str,
    text: str,
    is_subagent: bool = False,
    model: Optional[str] = None,
    name: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "ts": ts,
        "time": local_time_text(ts) if ts > 0 else "",
        "role": role,
        "is_subagent": is_subagent,
        "model": model,
        "name": name,
        "text": truncate(text),
    }


def one(session: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [session] if session else []


__all__ = [
    "MAX_TURNS",
    "SessionDraft",
    "file_descriptor",
    "file_stem",
    "first_field",
    "is_injected_prompt",
    "load_json",
    "load_jsonl",
    "load_records",
    "make_turn",
    "one",
    "path_segment_after",
    "read_text",
    "stat_source",
    "stringify_content",
    "truncate",
    "ts_to_epoch",
]
