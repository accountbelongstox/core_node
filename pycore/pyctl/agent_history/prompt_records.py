# -*- coding: utf-8 -*-
"""Agent-history prompt records: one SQLite store for every prompt side record.

Boundary contract - nothing here ever influences extraction: the extractor,
the txt store, live scan and statistics never read these records, and
deleting the database changes no extraction behavior.

Record kinds (``<agent_history store>/prompt_records.sqlite3``):
- feed ``new``: genuinely new prompts (ids the txt store had never seen),
  written once per extract tick by ``prompt_events``; read only by the UI
  route ``ui/agent_history/prompt_cache``; newest-first by ts, bounded per tool;
- feeds ``derived`` / ``rewritten``: AI-transformed new prompts written by the
  transform watchers; read only by ``ui/agent_history/prompt_derived`` and
  ``prompt_rewritten``; bounded by write recency, a re-transform replaces;
- archive: append-only backup of every scanned prompt (baseline, schema
  rebuilds and new prompts alike, captured before the user edit overlay),
  never trimmed and never read, so prompts survive source rotation (e.g.
  Claude Code ``cleanupPeriodDays``) and store rebuilds. ``key`` =
  sha1(tool|os_user|ts|text): one prompt is stored once even when session ids
  change across source schema revisions.

The database file carries the store file mode (``root_spool.SPOOL_FILE_MODE``)
because archived prompts may come from root-only sources. The pre-SQLite JSON
feed files and JSONL archive are imported once (``legacy_imported`` meta key)
and never read again. Every call runs on the store's own serialized owner
thread; SQLite and file errors are reported and yield empty results.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.database.repositories.prompt_record_repository import (
    TRIM_BY_INSERTION,
    TRIM_BY_TS,
    PromptRecordRepository,
)
from pycore.pyctl.agent_history.agent_history_records import local_time_text, page_window
from pycore.pyctl.agent_history.root_spool import SPOOL_FILE_MODE
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

PROMPT_RECORDS_FILE = "prompt_records.sqlite3"
SQLITE_SIDE_FILE_SUFFIXES = ("", "-wal", "-shm")
FEED_NEW = "new"
FEED_DERIVED = "derived"
FEED_REWRITTEN = "rewritten"
FEED_NAMESPACES = {
    FEED_NEW: "agent_history.prompt_new.",
    FEED_DERIVED: "agent_history.prompt_derived",
    FEED_REWRITTEN: "agent_history.prompt_rewritten",
}
NEW_FEED_MAX_PER_TOOL = 2000
TRANSFORM_FEED_MAX_ITEMS = 1000
RECORD_TEXT_CAP = 4000
PAGE_SIZE_CAP = 200
META_LEGACY_IMPORTED = "legacy_imported"
UNKNOWN_TOOL = "unknown"

NEW_FEED_FIELDS = ("id", "tool", "os_user", "session_id", "ts", "time", "text", "lang")
TRANSFORM_FEED_FIELDS = (
    "id", "tool", "os_user", "session_id", "ts", "time", "source_text",
    "derived_text", "model", "provider", "derived_at", "audio_task_id",
)
ARCHIVE_FIELDS = ("tool", "os_user", "project", "session_id", "source", "ts", "text")

# Pre-SQLite record files under the store dir (imported once).
LEGACY_NEW_FEED_DIR = "prompt_new_cache"
LEGACY_TRANSFORM_FEED_FILES = {
    FEED_DERIVED: "prompt_derived_cache.json",
    FEED_REWRITTEN: "prompt_rewrite_cache.json",
}
LEGACY_ARCHIVE_DIR = "prompt_archive"


def safe_tool(tool: Any) -> str:
    return "".join(ch for ch in str(tool or UNKNOWN_TOOL).lower() if ch.isalnum() or ch in "-_") or UNKNOWN_TOOL


def archive_key(entry: Dict[str, Any]) -> str:
    raw = f"{entry.get('tool') or ''}|{entry.get('os_user') or ''}|{int(entry.get('ts') or 0)}|{entry.get('text') or ''}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _legacy_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        ColorPrint.yellow(f"[AgentHistory] Legacy prompt record file unreadable path={path}: {exc}")
        return None


def _legacy_items(path: Path) -> List[Dict[str, Any]]:
    document = _legacy_json(path)
    items = document.get("items") if isinstance(document, dict) else None
    return [i for i in items if isinstance(i, dict) and i.get("id")] if isinstance(items, list) else []


def _legacy_archive_rows(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if isinstance(row, dict) and row.get("key"):
                    rows.append(row)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Legacy prompt archive unreadable path={path}: {exc}")
    return rows


def _feed_row(entry: Dict[str, Any]) -> Tuple[str, str, int, Dict[str, Any]]:
    return str(entry["id"]), safe_tool(entry.get("tool")), int(entry.get("ts") or 0), entry


class PromptRecords:
    """Feeds and archive of agent-history prompts in one SQLite database."""

    def __init__(self) -> None:
        self._repository: Optional[PromptRecordRepository] = None
        init_serialized_owner(self, "pyctl.agent_history.prompt_records", "PromptRecords")

    def _repo(self) -> Optional[PromptRecordRepository]:
        if self._repository is not None:
            return self._repository
        path = txt.store_dir() / PROMPT_RECORDS_FILE
        try:
            repository = PromptRecordRepository(path)
            if not repository.meta(META_LEGACY_IMPORTED):
                self._import_legacy(repository)
        except (OSError, sqlite3.Error) as exc:
            ColorPrint.red(f"[AgentHistory] Prompt record store unavailable path={path}: {exc}")
            return None
        for suffix in SQLITE_SIDE_FILE_SUFFIXES:
            side = Path(f"{path}{suffix}")
            if side.exists():
                txt.restrict_mode(side, SPOOL_FILE_MODE, "Prompt record store")
        self._repository = repository
        return repository

    @staticmethod
    def _import_legacy(repository: PromptRecordRepository) -> None:
        """One-shot import of the pre-SQLite feed files and JSONL archive."""
        store = txt.store_dir()
        new_dir = store / LEGACY_NEW_FEED_DIR
        imported = 0
        for path in sorted(new_dir.glob("*.json")) if new_dir.is_dir() else []:
            imported += repository.feed_write(FEED_NEW, map(_feed_row, _legacy_items(path)), replace=False)
        for feed, name in LEGACY_TRANSFORM_FEED_FILES.items():
            path = store / name
            if path.is_file():
                # Files are newest-first; insert oldest first so write order matches.
                rows = map(_feed_row, reversed(_legacy_items(path)))
                imported += repository.feed_write(feed, rows, replace=True)
        archive_dir = store / LEGACY_ARCHIVE_DIR
        for path in sorted(archive_dir.glob("*.jsonl")) if archive_dir.is_dir() else []:
            rows = [
                (str(row.pop("key")), safe_tool(row.get("tool")), int(row.get("ts") or 0), row)
                for row in _legacy_archive_rows(path)
            ]
            imported += repository.archive_write(rows)
        repository.set_meta(META_LEGACY_IMPORTED, local_time_text())
        ColorPrint.blue(f"[AgentHistory] Prompt record store imported legacy records count={imported}")

    def _run(self, label: str, default: Any, action: Any) -> Any:
        repository = self._repo()
        if repository is None:
            return default
        try:
            return action(repository)
        except sqlite3.Error as exc:
            ColorPrint.yellow(f"[AgentHistory] Prompt record {label} failed path={repository.path}: {exc}")
            return default

    @serialized_method
    def append_new(self, prompts: Iterable[Dict[str, Any]]) -> int:
        """Store new prompts in the ``new`` feed (existing ids kept); returns the stored count."""
        rows: List[Tuple[str, str, int, Dict[str, Any]]] = []
        for prompt in prompts or []:
            pid = str(prompt.get("id") or "")
            if not pid:
                continue
            entry = {field: prompt.get(field) for field in NEW_FEED_FIELDS}
            entry.update(id=pid, tool=safe_tool(prompt.get("tool")), ts=int(prompt.get("ts") or 0),
                         text=str(prompt.get("text") or "")[:RECORD_TEXT_CAP])
            rows.append(_feed_row(entry))

        def write(repository: PromptRecordRepository) -> int:
            written = repository.feed_write(FEED_NEW, rows, replace=False)
            for tool in {row[1] for row in rows}:
                repository.feed_trim(FEED_NEW, NEW_FEED_MAX_PER_TOOL, TRIM_BY_TS, tool)
            return written

        return self._run("new-feed write", 0, write) if rows else 0

    @serialized_method
    def new_page(self, tool: Optional[str] = None, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Newest-first page over one tool or all tools, plus per-tool counts."""
        key = safe_tool(tool) if tool else None

        def read(repository: PromptRecordRepository) -> Dict[str, Any]:
            counts = repository.feed_counts(FEED_NEW)
            window = page_window(counts.get(key, 0) if key else sum(counts.values()), page, page_size, PAGE_SIZE_CAP)
            offset = window.pop("offset")
            window["items"] = repository.feed_page(FEED_NEW, offset, window["page_size"], key)
            return {"namespaces": counts, **window}

        return self._run("new-feed read", self._empty_page({"namespaces": {}}, page_size), read)

    @serialized_method
    def append_transformed(self, feed: str, entry: Dict[str, Any]) -> bool:
        """Store one transformed prompt (a re-transform of an id replaces it)."""
        pid = str(entry.get("id") or "")
        if not pid or not str(entry.get("derived_text") or "").strip():
            return False
        row = {field: entry.get(field) for field in TRANSFORM_FEED_FIELDS}
        row.update(
            id=pid,
            ts=int(entry.get("ts") or 0),
            source_text=str(entry.get("source_text") or "")[:RECORD_TEXT_CAP],
            derived_text=str(entry.get("derived_text") or "")[:RECORD_TEXT_CAP],
            audio_task_id=str(entry.get("audio_task_id") or ""),
            derived_at=str(entry.get("derived_at") or local_time_text()),
        )

        def write(repository: PromptRecordRepository) -> bool:
            repository.feed_write(feed, [_feed_row(row)], replace=True)
            repository.feed_trim(feed, TRANSFORM_FEED_MAX_ITEMS, TRIM_BY_INSERTION)
            return True

        return self._run(f"{feed}-feed write", False, write)

    @serialized_method
    def transformed_page(self, feed: str, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        namespace = {"namespace": FEED_NAMESPACES[feed]}

        def read(repository: PromptRecordRepository) -> Dict[str, Any]:
            window = page_window(repository.feed_count(feed), page, page_size, PAGE_SIZE_CAP)
            offset = window.pop("offset")
            window["items"] = repository.feed_page(feed, offset, window["page_size"])
            return {**namespace, **window}

        return self._run(f"{feed}-feed read", self._empty_page(namespace, page_size), read)

    @serialized_method
    def archive(self, prompts: Iterable[Dict[str, Any]]) -> int:
        """Append prompts not archived yet; returns the appended count."""
        archived_at = local_time_text()
        rows: List[Tuple[str, str, int, Dict[str, Any]]] = []
        for prompt in sorted(prompts or [], key=lambda p: int(p.get("ts") or 0)):
            text = str(prompt.get("text") or "")
            if not text.strip():
                continue
            entry = {field: prompt.get(field) for field in ARCHIVE_FIELDS}
            entry.update(ts=int(prompt.get("ts") or 0), text=text)
            entry["time"] = local_time_text(entry["ts"]) if entry["ts"] else ""
            entry["archived_at"] = archived_at
            rows.append((archive_key(entry), safe_tool(entry.get("tool")), entry["ts"], entry))
        return self._run("archive write", 0, lambda repository: repository.archive_write(rows)) if rows else 0

    @staticmethod
    def _empty_page(extra: Dict[str, Any], page_size: int) -> Dict[str, Any]:
        window = page_window(0, 1, page_size, PAGE_SIZE_CAP)
        window.pop("offset")
        return {**extra, **window, "items": []}


prompt_records = PromptRecords()


__all__ = [
    "FEED_DERIVED",
    "FEED_NEW",
    "FEED_REWRITTEN",
    "PromptRecords",
    "archive_key",
    "prompt_records",
]
