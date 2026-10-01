# -*- coding: utf-8 -*-
"""Translate history ring (Google / AI translate UI records)."""

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_gateway_state import AI_HISTORY_MAX_ENTRIES
from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyutils.common.json_index_store import JsonIndexStore

LIST_DEFAULT = 50
LIST_MAX = 200

translate_history_store = JsonIndexStore(
    "translate_history.json", ai_state_dir, AI_HISTORY_MAX_ENTRIES, "translate_history",
)


def record(
    *,
    source: str,
    target: str,
    text: str,
    engine: str,
    result: str,
    origin: str = "ui",
) -> Optional[Dict[str, Any]]:
    now = time.time()
    return translate_history_store.append({
        "id": uuid.uuid4().hex[:12],
        "ts": now,
        "iso": datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
        "source": source,
        "target": target,
        "text": text,
        "engine": engine,
        "result": result,
        "origin": origin,
    })


def list_history(limit: int = LIST_DEFAULT) -> List[Dict[str, Any]]:
    return translate_history_store.entries(max(1, min(int(limit or LIST_DEFAULT), LIST_MAX)))


def delete_entry(entry_id: str) -> bool:
    return translate_history_store.delete(entry_id) is not None


def clear_history() -> int:
    return translate_history_store.clear()


def history_count() -> int:
    return translate_history_store.count()


__all__ = [
    "clear_history",
    "delete_entry",
    "history_count",
    "list_history",
    "record",
    "translate_history_store",
]
