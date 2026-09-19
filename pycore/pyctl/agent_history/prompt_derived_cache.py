# -*- coding: utf-8 -*-
"""Side-cache of AI-derived English prompts (READ-ONLY mirror).

Boundary contract — mirrors prompt_new_cache.py:
- WRITE path: fed ONLY by ``prompt_derive_service`` after a successful
  free-tier derivation of a genuinely new agent prompt.
- READ path: consumed ONLY by the UI route ``ui/agent_history/prompt_derived``.
- Nothing in the extractor, the txt store, or the pipeline reads from this
  cache. Deleting the file changes no extraction behavior whatsoever.

Layout — one JSON document for the unified newest-first feed:
    <cache>/pycore/.ai_state/agent_history/prompt_derived_cache.json
    {
      "namespace": "agent_history.prompt_derived",
      "updated_at": "YYYY-MM-DD HH:MM:SS",
      "items": [ {id, tool, os_user, session_id, ts, time, source_text,
                  derived_text, model, provider, derived_at}, ... ]
    }
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from pycore.pyctl.agent_history.agent_history_txt import store_dir
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore

DERIVED_CACHE_NAMESPACE = "agent_history.prompt_derived"
DERIVED_CACHE_MAX_ITEMS = 1000
DERIVED_CACHE_TEXT_CAP = 4000
DERIVED_CACHE_PAGE_SIZE_CAP = 200

_DERIVED_ENTRY_FIELDS = (
    "id",
    "tool",
    "os_user",
    "session_id",
    "ts",
    "time",
    "source_text",
    "derived_text",
    "model",
    "provider",
    "derived_at",
)


def _store() -> AtomicJsonStore:
    return AtomicJsonStore(
        store_dir() / "prompt_derived_cache.json",
        lambda: {
            "namespace": DERIVED_CACHE_NAMESPACE,
            "updated_at": "",
            "items": [],
        },
    )


def append_derived(entry: Dict[str, Any]) -> bool:
    """Append one derived prompt, newest-first, id-deduped. Returns appended.

    Side-cache only: callers must treat any failure here as non-fatal.
    """
    pid = str(entry.get("id") or "")
    if not pid or not str(entry.get("derived_text") or "").strip():
        return False
    row = {field: entry.get(field) for field in _DERIVED_ENTRY_FIELDS}
    row["id"] = pid
    row["ts"] = int(entry.get("ts") or 0)
    row["source_text"] = str(entry.get("source_text") or "")[:DERIVED_CACHE_TEXT_CAP]
    row["derived_text"] = str(entry.get("derived_text") or "")[:DERIVED_CACHE_TEXT_CAP]
    row["derived_at"] = str(
        entry.get("derived_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )
    store = _store()
    document = store.read()
    items = [
        item for item in (document.get("items") or [])
        if isinstance(item, dict) and item.get("id") and item.get("id") != pid
    ]
    document["items"] = [row, *items][:DERIVED_CACHE_MAX_ITEMS]
    document["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    store.write(document)
    return True


def _read_items() -> List[Dict[str, Any]]:
    store = _store()
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


def read_page(page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    """Paginated newest-first read over the derived-prompt feed."""
    page_size = max(1, min(int(page_size or 50), DERIVED_CACHE_PAGE_SIZE_CAP))
    items = _read_items()
    items.sort(key=lambda item: int(item.get("ts") or 0), reverse=True)
    total = len(items)
    page_count = max(1, -(-total // page_size))
    page = max(1, min(int(page or 1), page_count))
    start = (page - 1) * page_size
    return {
        "namespace": DERIVED_CACHE_NAMESPACE,
        "total": total,
        "page": page,
        "page_count": page_count,
        "page_size": page_size,
        "items": items[start:start + page_size],
    }


__all__ = [
    "DERIVED_CACHE_MAX_ITEMS",
    "DERIVED_CACHE_NAMESPACE",
    "DERIVED_CACHE_PAGE_SIZE_CAP",
    "DERIVED_CACHE_TEXT_CAP",
    "append_derived",
    "read_page",
]
