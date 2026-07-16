# -*- coding: utf-8 -*-
"""
Persistent task history in user_data (survives restart, keyword/date query).
"""

import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.system_paths import get_user_data_store

_SECTION = "task_history"
_MAX_ENTRIES = 2000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_record(record: Dict[str, Any]) -> None:
    """Append one finished task unit (best-effort, capped ring)."""
    store = get_user_data_store()
    section = store.get_section(_SECTION) or {}
    entries = list(section.get("entries") or [])
    row = dict(record)
    row.setdefault("ts", _now_iso())
    row.setdefault("at", int(time.time()))
    entries.insert(0, row)
    if len(entries) > _MAX_ENTRIES:
        entries = entries[:_MAX_ENTRIES]
    store.set_section(_SECTION, {"entries": entries, "updated_at": _now_iso()})


def query_records(
    limit: int = 200,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    task_type: Optional[str] = None,
    worker: Optional[str] = None,
) -> Dict[str, Any]:
    section = get_user_data_store().get_section(_SECTION) or {}
    entries: List[Dict[str, Any]] = list(section.get("entries") or [])
    needle = (q or "").strip().lower()
    if needle:
        pat = re.compile(re.escape(needle), re.IGNORECASE)
        entries = [
            e for e in entries
            if pat.search(str(e.get("title") or ""))
            or pat.search(str(e.get("content") or ""))
            or pat.search(str(e.get("task_type") or ""))
            or pat.search(str(e.get("error") or ""))
        ]
    if task_type:
        entries = [e for e in entries if str(e.get("task_type") or "") == task_type]
    if worker:
        entries = [e for e in entries if str(e.get("worker") or "") == worker]
    if date_from:
        entries = [e for e in entries if str(e.get("ts") or "") >= date_from]
    if date_to:
        entries = [e for e in entries if str(e.get("ts") or "") <= date_to]
    lim = max(1, min(int(limit or 200), 1000))
    return {
        "entries": entries[:lim],
        "total": len(entries),
        "stored": len(section.get("entries") or []),
        "max": _MAX_ENTRIES,
    }


def clear_records() -> int:
    store = get_user_data_store()
    section = store.get_section(_SECTION) or {}
    count = len(section.get("entries") or [])
    store.set_section(_SECTION, {"entries": [], "updated_at": _now_iso()})
    return count
