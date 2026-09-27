# -*- coding: utf-8 -*-
"""
Append-only backup of every scanned agent prompt (WRITE-ONLY mirror).

Boundary contract — this module must never influence any other logic:
- WRITE path: fed ONLY by ``AgentHistoryService._extract_inner`` with every
  prompt parsed in that pass (baseline, schema rebuilds and new prompts
  alike), captured before the user edit overlay is applied.
- READ path: none. Extraction, the txt store, live scan, prompt-new events,
  the UI and statistics never read this archive; it is not a source.
- Entries are never trimmed or removed, so prompts survive source rotation
  (e.g. Claude Code ``cleanupPeriodDays``) and store rebuilds.

Layout — one JSONL file per tool:
    <cache>/pycore/.ai_state/agent_history/prompt_archive/<tool>.jsonl
    {"key", "tool", "os_user", "project", "session_id", "source", "ts",
     "time", "text", "archived_at"}
``key`` = sha1(tool|os_user|ts|text): the same prompt is stored once even
when session ids change across extractor schema revisions.

``ARCHIVE_ROOT_ONLY_FIELD`` is an input-only flag on the caller's prompt
dict (never persisted into an entry, never part of the dedupe key): when
any prompt carries it truthy, its tool's JSONL came from a root-owned
source (root spool) and the file is restricted to ``root_spool.SPOOL_FILE_MODE``
so it is never more readable than the source it was mirrored from. A file
that never receives such a prompt keeps the owner's default mode.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from pycore.pyctl.agent_history.agent_history_txt import store_dir
import pycore.pyctl.agent_history.root_spool as root_spool
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

PROMPT_ARCHIVE_DIR_NAME = "prompt_archive"
ARCHIVE_ROOT_ONLY_FIELD = "root_only"

_ARCHIVE_ENTRY_FIELDS = ("tool", "os_user", "project", "session_id", "source", "ts", "text")
_known_keys: Dict[str, Set[str]] = {}
_lock = threading.Lock()


def _archive_path(tool: str) -> Path:
    safe_tool = "".join(ch for ch in str(tool or "unknown").lower() if ch.isalnum() or ch in "-_") or "unknown"
    return store_dir() / PROMPT_ARCHIVE_DIR_NAME / f"{safe_tool}.jsonl"


def _prompt_key(entry: Dict[str, Any]) -> str:
    raw = f"{entry.get('tool') or ''}|{entry.get('os_user') or ''}|{int(entry.get('ts') or 0)}|{entry.get('text') or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _load_keys(path: Path) -> Set[str]:
    keys: Set[str] = set()
    if not path.is_file():
        return keys
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            try:
                key = json.loads(line).get("key")
            except (ValueError, AttributeError):
                continue
            if key:
                keys.add(str(key))
    return keys


def archive_prompts(prompts: List[Dict[str, Any]]) -> int:
    """Append prompts not archived yet. Returns appended count.
    Side-backup only: callers must treat any failure here as non-fatal."""
    by_tool: Dict[str, List[Tuple[Dict[str, Any], bool]]] = {}
    for prompt in prompts or []:
        text = str(prompt.get("text") or "")
        if not text.strip():
            continue
        entry = {field: prompt.get(field) for field in _ARCHIVE_ENTRY_FIELDS}
        entry["ts"] = int(prompt.get("ts") or 0)
        entry["text"] = text
        root_only = bool(prompt.get(ARCHIVE_ROOT_ONLY_FIELD))
        by_tool.setdefault(str(entry.get("tool") or "unknown"), []).append((entry, root_only))

    appended = 0
    archived_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with _lock:
        for tool, items in by_tool.items():
            path = _archive_path(tool)
            known = _known_keys.get(str(path))
            if known is None:
                known = _load_keys(path)
                _known_keys[str(path)] = known
            lines: List[str] = []
            fresh: Set[str] = set()
            has_root_only = False
            for entry, root_only in sorted(items, key=lambda pair: pair[0]["ts"]):
                key = _prompt_key(entry)
                if key in known or key in fresh:
                    continue
                fresh.add(key)
                has_root_only = has_root_only or root_only
                entry["key"] = key
                entry["time"] = datetime.fromtimestamp(entry["ts"]).strftime("%Y-%m-%d %H:%M:%S") if entry["ts"] else ""
                entry["archived_at"] = archived_at
                lines.append(json.dumps(entry, ensure_ascii=False) + "\n")
            if not lines:
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "a", encoding="utf-8", newline="\n") as handle:
                handle.writelines(lines)
            known.update(fresh)
            # A file that ever receives a root-only entry is restricted to the
            # root-spool file mode and never widened back; a file that never
            # does keeps the owner's default mode (no chmod at all).
            if has_root_only and os.name != "nt":
                try:
                    os.chmod(path, root_spool.SPOOL_FILE_MODE)
                except OSError as exc:
                    ColorPrint.yellow(
                        f"[AgentHistory] Prompt archive chmod failed "
                        f"path={path} mode={oct(root_spool.SPOOL_FILE_MODE)} errno={exc.errno}"
                    )
            appended += len(lines)
    return appended


__all__ = [
    "PROMPT_ARCHIVE_DIR_NAME",
    "ARCHIVE_ROOT_ONLY_FIELD",
    "archive_prompts",
]
