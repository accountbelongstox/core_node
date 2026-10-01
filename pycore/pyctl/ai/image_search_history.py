# -*- coding: utf-8 -*-
"""Image-search history (SerpApi Google-Images queries + result metadata).

Metadata only (no image bytes); the UI renders thumbnails from the result URLs."""

import hashlib
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_gateway_state import AI_HISTORY_MAX_ENTRIES
from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyutils.common.json_index_store import JsonIndexStore
from pycore.pyutils.common.keyset_cursor import KeysetKey

DEFAULT_ENGINE = "google_images"
DEFAULT_ORIGIN = "pycore"

image_search_history_store = JsonIndexStore(
    "image_search_history.json", ai_state_dir, AI_HISTORY_MAX_ENTRIES, "image_search_history",
)


def record_search(
    *,
    query: str,
    engine: str,
    results: List[Dict[str, Any]],
    country: Optional[str] = None,
    ai: Optional[Dict[str, Any]] = None,
    origin: str = DEFAULT_ORIGIN,
) -> Optional[str]:
    """Append one search record. Returns the new entry id or None."""
    clean = (query or "").strip()
    if not clean:
        return None
    ts = time.time()
    entry_id = hashlib.sha1(f"{ts}:{clean}:{uuid.uuid4().hex}".encode("utf-8")).hexdigest()[:16]
    image_search_history_store.append({
        "id": entry_id,
        "ts": ts,
        "iso": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds"),
        "query": clean,
        "engine": engine or DEFAULT_ENGINE,
        "country": country or None,
        "result_count": len(results or []),
        "results": results or [],
        "ai": ai,
        "origin": origin or DEFAULT_ORIGIN,
    })
    return entry_id


def list_history(after: Optional[KeysetKey], limit: int) -> Dict[str, Any]:
    """One newest-first keyset page of image searches."""
    return image_search_history_store.page(after, limit)


def delete_entry(entry_id: str) -> bool:
    return image_search_history_store.delete(entry_id) is not None


def clear_history() -> int:
    return image_search_history_store.clear()


def history_count() -> int:
    return image_search_history_store.count()


__all__ = [
    "clear_history",
    "delete_entry",
    "history_count",
    "image_search_history_store",
    "list_history",
    "record_search",
]
