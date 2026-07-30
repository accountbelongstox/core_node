# -*- coding: utf-8 -*-
"""File-backed storage for small remote cursor snapshots."""

import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyutils.common.user_data_store import UserDataStore


STORE_FILE_NAME = "remote_cursors.json"
STORE_SECTION = "remote_cursors"
MAX_REMOTE_CURSORS = 20
_KEY_SEPARATOR = "\x1f"


def _cursor_key(source_type: str, source_id: str) -> str:
    return f"{source_type}{_KEY_SEPARATOR}{source_id}"


@dataclass
class RemoteCursor:
    """Small remote position and snapshot record."""

    source_type: str
    source_id: str
    cursor_json: Dict[str, Any] = field(default_factory=dict)
    snapshot_json: Dict[str, Any] = field(default_factory=dict)
    revision: int = 0
    timestamps: Dict[str, Any] = field(default_factory=dict)
    error_json: Optional[Dict[str, Any]] = None


class RemoteCursorStore:
    """Persist a bounded set of cursor snapshots in one atomic JSON file."""

    def __init__(self) -> None:
        base_dir = get_local_data_dir()
        self.path = base_dir / STORE_FILE_NAME
        self._store = UserDataStore(
            base_dir=base_dir,
            file_name=STORE_FILE_NAME,
            defaults_dir=base_dir / "defaults",
        )
        init_serialized_owner(
            self,
            "laravel.remote_cursor.state",
            "LaravelRemoteCursorState",
        )

    @serialized_method
    def get_remote_cursor(
        self,
        source_type: str,
        source_id: str,
    ) -> Optional[RemoteCursor]:
        """Return one stored cursor snapshot."""
        records = self._store.get_section(STORE_SECTION).get("records") or {}
        record = records.get(_cursor_key(source_type, source_id))
        if not isinstance(record, dict):
            return None
        return RemoteCursor(
            source_type=source_type,
            source_id=source_id,
            cursor_json=dict(record.get("cursor_json") or {}),
            snapshot_json=dict(record.get("snapshot_json") or {}),
            revision=int(record.get("revision") or 0),
            timestamps=dict(record.get("timestamps") or {}),
            error_json=(
                dict(record["error_json"])
                if isinstance(record.get("error_json"), dict)
                else None
            ),
        )

    @serialized_method
    def save_remote_cursor(self, cursor_obj: RemoteCursor) -> None:
        """Insert or replace one cursor snapshot and enforce the size bound."""
        section = self._store.get_section(STORE_SECTION)
        records: Dict[str, Dict[str, Any]] = dict(section.get("records") or {})
        key = _cursor_key(cursor_obj.source_type, cursor_obj.source_id)
        records[key] = {
            "source_type": cursor_obj.source_type,
            "source_id": cursor_obj.source_id,
            "cursor_json": dict(cursor_obj.cursor_json or {}),
            "snapshot_json": dict(cursor_obj.snapshot_json or {}),
            "revision": cursor_obj.revision,
            "timestamps": dict(cursor_obj.timestamps or {}),
            "error_json": (
                dict(cursor_obj.error_json)
                if isinstance(cursor_obj.error_json, dict)
                else None
            ),
            "saved_at": time.time(),
        }
        ordered_records = sorted(
            records.items(),
            key=lambda item: float(item[1].get("saved_at") or 0.0),
            reverse=True,
        )[:MAX_REMOTE_CURSORS]
        self._store.set_section(
            STORE_SECTION,
            {"records": dict(ordered_records)},
        )


remote_cursor_store = RemoteCursorStore()


__all__ = [
    "RemoteCursor",
    "RemoteCursorStore",
    "remote_cursor_store",
]
