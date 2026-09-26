# -*- coding: utf-8 -*-
"""Side-caches of AI-transformed new prompts (READ-ONLY mirrors).

Boundary contract — mirrors prompt_new_cache.py:
- WRITE path: fed ONLY by the prompt transform watchers
  (``prompt_transform_service``) after a successful transform of a genuinely
  new agent prompt.
- READ path: consumed ONLY by the UI routes ``ui/agent_history/prompt_derived``
  and ``ui/agent_history/prompt_rewritten``.
- Nothing in the extractor, the txt store, or the pipeline reads from these
  caches. Deleting a file changes no extraction behavior whatsoever.

Layout — one JSON document per feed, unified newest-first:
    <agent_history store>/<file_name>
    {
      "namespace": "<namespace>",
      "updated_at": "YYYY-MM-DD HH:MM:SS",
      "items": [ {id, tool, os_user, session_id, ts, time, source_text,
                  derived_text, model, provider, derived_at, audio_task_id}, ... ]
    }
``derived_text`` is the transform output (EN derivation or EN rewrite).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from pycore.pyctl.agent_history.agent_history_txt import store_dir
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore

TRANSFORM_CACHE_MAX_ITEMS = 1000
TRANSFORM_CACHE_TEXT_CAP = 4000
TRANSFORM_CACHE_PAGE_SIZE_CAP = 200

_ENTRY_FIELDS = (
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
    "audio_task_id",
)


class PromptTransformCache:
    """One newest-first, id-deduped feed of transformed prompts."""

    def __init__(self, namespace: str, file_name: str) -> None:
        self.namespace = namespace
        self._file_name = file_name

    def _store(self) -> AtomicJsonStore:
        return AtomicJsonStore(
            store_dir() / self._file_name,
            lambda: {"namespace": self.namespace, "updated_at": "", "items": []},
        )

    def append(self, entry: Dict[str, Any]) -> bool:
        """Append one transformed prompt, newest-first, id-deduped.

        Side-cache only: callers must treat any failure here as non-fatal.
        """
        pid = str(entry.get("id") or "")
        if not pid or not str(entry.get("derived_text") or "").strip():
            return False
        row = {field: entry.get(field) for field in _ENTRY_FIELDS}
        row["id"] = pid
        row["ts"] = int(entry.get("ts") or 0)
        row["source_text"] = str(entry.get("source_text") or "")[:TRANSFORM_CACHE_TEXT_CAP]
        row["derived_text"] = str(entry.get("derived_text") or "")[:TRANSFORM_CACHE_TEXT_CAP]
        row["audio_task_id"] = str(entry.get("audio_task_id") or "")
        row["derived_at"] = str(
            entry.get("derived_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        store = self._store()
        document = store.read()
        items = [
            item for item in (document.get("items") or [])
            if isinstance(item, dict) and item.get("id") and item.get("id") != pid
        ]
        document["items"] = [row, *items][:TRANSFORM_CACHE_MAX_ITEMS]
        document["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        store.write(document)
        return True

    def _read_items(self) -> List[Dict[str, Any]]:
        store = self._store()
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

    def read_page(self, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Paginated newest-first read over the feed."""
        page_size = max(1, min(int(page_size or 50), TRANSFORM_CACHE_PAGE_SIZE_CAP))
        items = self._read_items()
        items.sort(key=lambda item: int(item.get("ts") or 0), reverse=True)
        total = len(items)
        page_count = max(1, -(-total // page_size))
        page = max(1, min(int(page or 1), page_count))
        start = (page - 1) * page_size
        return {
            "namespace": self.namespace,
            "total": total,
            "page": page,
            "page_count": page_count,
            "page_size": page_size,
            "items": items[start:start + page_size],
        }


prompt_derived_cache = PromptTransformCache("agent_history.prompt_derived", "prompt_derived_cache.json")
prompt_rewrite_cache = PromptTransformCache("agent_history.prompt_rewritten", "prompt_rewrite_cache.json")


__all__ = ["prompt_derived_cache", "prompt_rewrite_cache"]
