# -*- coding: utf-8 -*-
from pathlib import Path
from typing import Any, Dict, List

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyutils.common.status_snapshot_cache import VersionedSnapshotCache


AGENT_HISTORY_SNAPSHOT_MAX_ENTRIES = 4096
INDEX_CATALOG_CACHE_KEY = "agent_history.catalog.index"
PROMPT_CATALOG_CACHE_KEY = "agent_history.catalog.prompts"
SESSION_EVENTS_CACHE_PREFIX = "agent_history.session_events."
SESSION_SUMMARY_FIELDS = (
    "id",
    "raw_id",
    "tool",
    "os_user",
    "project",
    "title",
    "started_at",
    "ended_at",
    "started_ts",
    "ended_ts",
    "prompt_count",
    "message_count",
    "has_subagent",
    "models",
    "bytes",
    "file",
)

agent_history_snapshot_cache = VersionedSnapshotCache(
    ttl_seconds=float("inf"),
    max_entries=AGENT_HISTORY_SNAPSHOT_MAX_ENTRIES,
    copy_values=False,
)


def file_revision(path: Path) -> str:
    try:
        stat = path.stat()
        return f"{stat.st_mtime_ns}:{stat.st_size}"
    except OSError:
        return "missing"


def session_summary(detail: Dict[str, Any]) -> Dict[str, Any]:
    summary = {
        field: detail.get(field)
        for field in SESSION_SUMMARY_FIELDS
        if field in detail
    }
    models = summary.get("models")
    if isinstance(models, list):
        summary["models"] = [str(model) for model in models[:20]]
    return summary


def _build_index_catalog() -> Dict[str, Any]:
    data = txt.read_index()
    by_id = {
        session.get("id"): session_summary(session)
        for session in (data.get("sessions") or [])
        if isinstance(session, dict) and session.get("id")
    }
    return {"data": data, "by_id": by_id}


def read_index_catalog() -> Dict[str, Any]:
    path = txt.store_dir() / "index.txt"
    revision = file_revision(path)

    def load_catalog() -> Dict[str, Any]:
        snapshot = _build_index_catalog()
        snapshot["revision"] = revision
        return snapshot

    return agent_history_snapshot_cache.get(
        INDEX_CATALOG_CACHE_KEY,
        load_catalog,
        ttl_seconds=float("inf"),
        version=revision,
        stale_while_refresh=False,
    )


def _build_prompt_catalog() -> Dict[str, Any]:
    return {"items": txt.read_prompts()}


def read_prompt_catalog_snapshot() -> Dict[str, Any]:
    path = txt.store_dir() / "prompts.txt"
    revision = file_revision(path)

    def load_catalog() -> Dict[str, Any]:
        snapshot = _build_prompt_catalog()
        snapshot["revision"] = revision
        return snapshot

    return agent_history_snapshot_cache.get(
        PROMPT_CATALOG_CACHE_KEY,
        load_catalog,
        ttl_seconds=float("inf"),
        version=revision,
        stale_while_refresh=False,
    )


def read_prompt_catalog() -> List[Dict[str, Any]]:
    snapshot = read_prompt_catalog_snapshot()
    items = snapshot.get("items") or []
    return items if isinstance(items, list) else []


__all__ = [
    "AGENT_HISTORY_SNAPSHOT_MAX_ENTRIES",
    "INDEX_CATALOG_CACHE_KEY",
    "PROMPT_CATALOG_CACHE_KEY",
    "SESSION_EVENTS_CACHE_PREFIX",
    "file_revision",
    "read_index_catalog",
    "read_prompt_catalog",
    "read_prompt_catalog_snapshot",
    "session_summary",
    "agent_history_snapshot_cache",
]
