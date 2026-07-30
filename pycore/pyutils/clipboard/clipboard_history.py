#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""File-backed clipboard history for local synchronization."""

import hashlib
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyutils.common.user_data_store import UserDataStore


CLIPBOARD_HISTORY_FILE_NAME = "clipboard_history.json"
CLIPBOARD_HISTORY_SECTION = "clipboard_history"
DEFAULT_MAX_ITEMS = 1000


class ClipboardHistory:
    """Own a bounded clipboard history persisted as JSON."""

    def __init__(self, max_items: int = DEFAULT_MAX_ITEMS):
        self.max_items = max(1, int(max_items))
        self._store = UserDataStore(
            base_dir=APP_CONFIG_DIR,
            file_name=CLIPBOARD_HISTORY_FILE_NAME,
            defaults_dir=APP_CONFIG_DIR / "clipboard_defaults",
        )
        section = self._store.get_section(CLIPBOARD_HISTORY_SECTION)
        entries = section.get("entries")
        self.items = [
            dict(item)
            for item in entries or []
            if isinstance(item, dict)
        ][-self.max_items:]
        numeric_ids = [
            item["id"]
            for item in self.items
            if isinstance(item.get("id"), int)
        ]
        stored_next_id = section.get("next_id")
        derived_next_id = max(numeric_ids, default=0) + 1
        self._next_id = (
            max(stored_next_id, derived_next_id)
            if isinstance(stored_next_id, int)
            else derived_next_id
        )
        init_serialized_owner(
            self,
            "clipboard.history.state",
            "ClipboardHistoryState",
        )
        ColorPrint.blue("[ClipboardHistory] Initialized (file-backed)")

    def _persist(self) -> None:
        self._store.set_section(
            CLIPBOARD_HISTORY_SECTION,
            {
                "entries": self.items[-self.max_items:],
                "next_id": self._next_id,
            },
        )

    @serialized_method
    def add_item(
        self,
        content: str,
        client_id: str = "unknown",
        content_type: str = "text",
        file_path: Optional[str] = None,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """Append one item unless the same client recently recorded it."""
        content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
        recent_items = [
            item
            for item in self.items
            if item.get("client_id") == client_id
        ][-10:]
        for item in recent_items:
            if item.get("content_hash") == content_hash:
                return None

        timestamp = time.time()
        item = {
            "id": self._next_id,
            "content": content,
            "content_type": content_type,
            "content_hash": content_hash,
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "client_id": client_id,
            "timestamp": timestamp,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp)),
        }
        self._next_id += 1
        self.items.append(item)
        self.items = self.items[-self.max_items:]
        self._persist()
        return dict(item)

    @serialized_method
    def get_recent(
        self,
        limit: int = 50,
        client_id: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return recent items in newest-first order."""
        limit_value = max(0, int(limit))
        if limit_value == 0:
            return []
        items = self.items
        if client_id:
            items = [item for item in items if item.get("client_id") == client_id]
        if content_type:
            items = [
                item
                for item in items
                if item.get("content_type") == content_type
            ]
        return [dict(item) for item in reversed(items[-limit_value:])]

    @serialized_method
    def get_since(
        self,
        timestamp: float,
        client_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return items newer than a timestamp in newest-first order."""
        timestamp_value = float(timestamp)
        items = [
            item
            for item in self.items
            if float(item.get("timestamp") or 0.0) > timestamp_value
        ]
        if client_id:
            items = [item for item in items if item.get("client_id") == client_id]
        return [dict(item) for item in reversed(items)]

    @serialized_method
    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search clipboard text and return newest matches first."""
        limit_value = max(0, int(limit))
        if limit_value == 0:
            return []
        query_lower = query.lower()
        matches = [
            item
            for item in self.items
            if query_lower in str(item.get("content") or "").lower()
        ]
        return [dict(item) for item in reversed(matches[-limit_value:])]

    @serialized_method
    def clear_history(self, client_id: Optional[str] = None) -> None:
        """Clear all items or only items owned by one client."""
        if client_id:
            self.items = [
                item
                for item in self.items
                if item.get("client_id") != client_id
            ]
            ColorPrint.yellow(
                f"[ClipboardHistory] Cleared history for client: {client_id}"
            )
        else:
            self.items = []
            ColorPrint.yellow("[ClipboardHistory] Cleared all history")
        self._persist()

    @serialized_method
    def get_statistics(self) -> Dict[str, Any]:
        """Return basic clipboard history statistics."""
        if not self.items:
            return {
                "total_items": 0,
                "clients": [],
                "oldest_timestamp": None,
                "newest_timestamp": None,
            }

        clients = sorted({str(item.get("client_id") or "") for item in self.items})
        return {
            "total_items": len(self.items),
            "clients": clients,
            "client_counts": {
                client: len(
                    [item for item in self.items if item.get("client_id") == client]
                )
                for client in clients
            },
            "oldest_timestamp": self.items[0].get("timestamp"),
            "newest_timestamp": self.items[-1].get("timestamp"),
        }


_CLIPBOARD_HISTORY_PROVIDER = SerializedSingletonProvider(
    ClipboardHistory,
    "clipboard.history.provider",
    "ClipboardHistoryProvider",
)


def get_clipboard_history() -> ClipboardHistory:
    """Get the global clipboard history singleton."""
    return _CLIPBOARD_HISTORY_PROVIDER.get()


__all__ = [
    "ClipboardHistory",
    "get_clipboard_history",
]
