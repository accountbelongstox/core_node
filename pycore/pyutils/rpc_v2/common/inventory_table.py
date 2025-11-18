#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inventory table for retrying failed notifications.
"""

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from pycore import ColorPrint


@dataclass
class InventoryItem:
    request_id: str
    route: str
    result: Any
    error: Optional[str] = None
    client_id: Optional[str] = None
    client_type: str = "unknown"
    stored_at: float = field(default_factory=time.time)
    accessed_at: Optional[float] = None
    access_count: int = 0


class InventoryTable:
    """Stores results when delivery attempts fail."""

    def __init__(self, max_size: int = 10_000_000, default_ttl: float = 3600.0, debug: bool = True):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.debug = debug
        self.items: Dict[str, InventoryItem] = {}
        self._lock = threading.RLock()
        if self.debug:
            ColorPrint.green(f"[InventoryTable] Initialized (max_size={max_size}, ttl={default_ttl}s)")

    def store(
        self,
        request_id: str,
        route: str,
        result: Any,
        client_id: Optional[str] = None,
        client_type: str = "unknown",
        error: Optional[str] = None,
    ) -> bool:
        with self._lock:
            if len(self.items) >= self.max_size:
                self._cleanup_oldest()
            self.items[request_id] = InventoryItem(
                request_id=request_id,
                route=route,
                result=result,
                error=error,
                client_id=client_id,
                client_type=client_type,
            )
            if self.debug:
                ColorPrint.blue(f"[InventoryTable] Stored result for request {request_id[:8]} route={route}")
            return True

    def get(self, request_id: str, remove: bool = False) -> Optional[InventoryItem]:
        with self._lock:
            item = self.items.get(request_id)
            if not item:
                return None
            item.accessed_at = time.time()
            item.access_count += 1
            if remove:
                self.items.pop(request_id, None)
            return item

    def delete(self, request_id: str) -> bool:
        with self._lock:
            return self.items.pop(request_id, None) is not None

    def get_by_client(self, client_id: str):
        with self._lock:
            return [item for item in self.items.values() if item.client_id == client_id]

    def cleanup(self, max_age: Optional[float] = None) -> int:
        with self._lock:
            now = time.time()
            ttl = max_age or self.default_ttl
            expired = [rid for rid, item in self.items.items() if now - item.stored_at > ttl]
            for rid in expired:
                self.items.pop(rid, None)
            return len(expired)

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            stats: Dict[str, Any] = {"total": len(self.items), "max_size": self.max_size, "by_client_type": {}}
            for item in self.items.values():
                stats["by_client_type"][item.client_type] = stats["by_client_type"].get(item.client_type, 0) + 1
            return stats

    def _cleanup_oldest(self):
        if not self.items:
            return
        oldest_id = min(self.items, key=lambda rid: self.items[rid].stored_at)
        self.items.pop(oldest_id, None)


default_inventory_table = InventoryTable()

__all__ = ["InventoryTable", "InventoryItem", "default_inventory_table"]
