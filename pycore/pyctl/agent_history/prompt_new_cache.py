# -*- coding: utf-8 -*-
"""
Namespaced side-cache of newly detected agent prompts (READ-ONLY mirror).

Boundary contract — this module must never influence extraction:
- WRITE path: fed ONLY by ``AgentHistoryService._emit_prompt_new`` with the
  already deduped incremental diff (prompt ids the txt store has never seen).
  One ``append_new_prompts`` call per extract tick; ids already cached are
  skipped, so the same prompt is never stored twice.
- READ path: consumed ONLY by the UI route ``ui/agent_history/prompt_cache``.
- Nothing in the extractor, the txt store, the live-scan logic, or the
  statistics pipeline reads from this cache. Deleting the whole cache
  directory changes no extraction behavior whatsoever.

Layout — one JSON document per namespace (namespace == agent tool name):
    <cache>/pycore/.ai_state/agent_history/prompt_new_cache/<tool>.json
    {
      "namespace": "agent_history.prompt_new.<tool>",
      "updated_at": "YYYY-MM-DD HH:MM:SS",
      "items": [ {id, tool, os_user, session_id, ts, time, text, lang}, ... ]
    }
Items are kept newest-first and trimmed to PROMPT_CACHE_MAX_PER_NAMESPACE.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.agent_history_txt import store_dir
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore

PROMPT_CACHE_NAMESPACE_PREFIX = "agent_history.prompt_new."
PROMPT_CACHE_MAX_PER_NAMESPACE = 2000
PROMPT_CACHE_TEXT_CAP = 4000
PROMPT_CACHE_PAGE_SIZE_CAP = 200

# Entry fields mirrored from the extract diff; nothing else is persisted.
_PROMPT_CACHE_ENTRY_FIELDS = (
    "id",
    "tool",
    "os_user",
    "session_id",
    "ts",
    "time",
    "text",
    "lang",
)


def _cache_dir() -> Any:
    return store_dir() / "prompt_new_cache"


def _namespace_store(tool: str) -> AtomicJsonStore:
    safe_tool = "".join(ch for ch in str(tool or "unknown").lower() if ch.isalnum() or ch in "-_") or "unknown"
    return AtomicJsonStore(
        _cache_dir() / f"{safe_tool}.json",
        lambda: {
            "namespace": PROMPT_CACHE_NAMESPACE_PREFIX + safe_tool,
            "updated_at": "",
            "items": [],
        },
    )


def _normalize_entry(prompt: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    pid = str(prompt.get("id") or "")
    if not pid:
        return None
    entry = {field: prompt.get(field) for field in _PROMPT_CACHE_ENTRY_FIELDS}
    entry["id"] = pid
    entry["ts"] = int(prompt.get("ts") or 0)
    entry["text"] = str(prompt.get("text") or "")[:PROMPT_CACHE_TEXT_CAP]
    return entry


def append_new_prompts(prompts: List[Dict[str, Any]]) -> int:
    """Append genuinely new prompts into their per-tool namespace.

    Defensive id-dedup is applied on top of the caller-side diff so repeated
    calls with the same prompt stay idempotent. Returns appended count.
    Side-cache only: callers must treat any failure here as non-fatal.
    """
    appended = 0
    by_tool: Dict[str, List[Dict[str, Any]]] = {}
    for prompt in prompts or []:
        entry = _normalize_entry(prompt)
        if entry is None:
            continue
        by_tool.setdefault(str(entry.get("tool") or "unknown"), []).append(entry)

    for tool, entries in by_tool.items():
        store = _namespace_store(tool)
        document = store.read()
        items = [
            item for item in (document.get("items") or [])
            if isinstance(item, dict) and item.get("id")
        ]
        known_ids = {str(item["id"]) for item in items}
        fresh = [entry for entry in entries if entry["id"] not in known_ids]
        if not fresh:
            continue
        merged = sorted(items + fresh, key=lambda item: int(item.get("ts") or 0), reverse=True)
        document["items"] = merged[:PROMPT_CACHE_MAX_PER_NAMESPACE]
        document["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        store.write(document)
        appended += len(fresh)
    return appended


def _read_namespace_items(tool: str) -> List[Dict[str, Any]]:
    store = _namespace_store(tool)
    if not store.exists():
        return []
    try:
        document = store.read()
    except (OSError, ValueError):
        return []
    return [
        item for item in (document.get("items") or [])
        if isinstance(item, dict) and item.get("id")
    ]


def namespace_counts() -> Dict[str, int]:
    """Item count per namespace, for the UI namespace filter."""
    cache_dir = _cache_dir()
    counts: Dict[str, int] = {}
    if not cache_dir.is_dir():
        return counts
    for path in sorted(cache_dir.glob("*.json")):
        counts[path.stem] = len(_read_namespace_items(path.stem))
    return counts


def read_page(
    tool: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Dict[str, Any]:
    """Paginated newest-first read over one namespace or all namespaces."""
    page_size = max(1, min(int(page_size or 50), PROMPT_CACHE_PAGE_SIZE_CAP))
    counts = namespace_counts()
    if tool:
        items = _read_namespace_items(str(tool).strip().lower())
    else:
        items = []
        for namespace in counts:
            items.extend(_read_namespace_items(namespace))
    items.sort(key=lambda item: int(item.get("ts") or 0), reverse=True)
    total = len(items)
    page_count = max(1, -(-total // page_size))
    page = max(1, min(int(page or 1), page_count))
    start = (page - 1) * page_size
    return {
        "namespaces": counts,
        "total": total,
        "page": page,
        "page_count": page_count,
        "page_size": page_size,
        "items": items[start:start + page_size],
    }


__all__ = [
    "PROMPT_CACHE_MAX_PER_NAMESPACE",
    "PROMPT_CACHE_NAMESPACE_PREFIX",
    "PROMPT_CACHE_PAGE_SIZE_CAP",
    "PROMPT_CACHE_TEXT_CAP",
    "append_new_prompts",
    "namespace_counts",
    "read_page",
]
