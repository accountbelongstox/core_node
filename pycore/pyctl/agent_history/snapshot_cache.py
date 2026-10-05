# -*- coding: utf-8 -*-
from pathlib import Path
from typing import Any, Dict

from pycore.pyctl.agent_history.agent_history_index import agent_history_index
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.status_snapshot_cache import VersionedSnapshotCache


AGENT_HISTORY_SNAPSHOT_MAX_ENTRIES = 4096
INDEX_CATALOG_CACHE_KEY = "agent_history.catalog.index"
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
    if not path.exists():
        return "missing"
    try:
        stat = path.stat()
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Revision stat failed path={path}: {exc}")
        return "missing"
    return f"{stat.st_mtime_ns}:{stat.st_size}"


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
    header = agent_history_index.header()
    sessions = agent_history_index.sessions()
    data = {
        "generated_at": header.get("generated_at") or "",
        "tools": header.get("tools") or [],
        "users": header.get("users") or [],
        "langs": header.get("langs") or [],
        "counts": header.get("counts") or {},
        "sessions_count": len(sessions),
        "sessions": sessions,
    }
    by_id = {
        session.get("id"): session_summary(session)
        for session in sessions
        if isinstance(session, dict) and session.get("id")
    }
    return {"data": data, "by_id": by_id}


def read_index_catalog() -> Dict[str, Any]:
    """Session summaries loaded once per committed store revision."""
    revision = agent_history_index.revision()

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


__all__ = [
    "AGENT_HISTORY_SNAPSHOT_MAX_ENTRIES",
    "INDEX_CATALOG_CACHE_KEY",
    "SESSION_EVENTS_CACHE_PREFIX",
    "file_revision",
    "read_index_catalog",
    "session_summary",
    "agent_history_snapshot_cache",
]
