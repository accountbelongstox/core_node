#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inventory table for retrying failed notifications.
"""

import time
from dataclasses import dataclass, field, replace
from typing import Any, Dict, Optional

from pycore import ColorPrint
from pycore.pyutils.rpc_v2.constants import INVENTORY_TTL, INVENTORY_MAX_SIZE
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)


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

    def __init__(self, max_size: int = INVENTORY_MAX_SIZE, default_ttl: float = INVENTORY_TTL, debug: bool = True):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.debug = debug
        self.items: Dict[str, InventoryItem] = {}
        init_serialized_owner(
            self,
            'pyutils.rpc_v2.inventory_table',
            'RPCInventoryTableThread',
        )
        if self.debug:
            ColorPrint.green(f"[InventoryTable] Initialized (max_size={max_size}, ttl={default_ttl}s)")

    @serialized_method
    def store(
        self,
        request_id: str,
        route: str,
        result: Any,
        client_id: Optional[str] = None,
        client_type: str = "unknown",
        error: Optional[str] = None,
    ) -> bool:
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

    @serialized_method
    def get(self, request_id: str, remove: bool = False) -> Optional[InventoryItem]:
        item = self.items.get(request_id)
        if not item:
            return None
        item.accessed_at = time.time()
        item.access_count += 1
        if remove:
            self.items.pop(request_id, None)
        return replace(item)

    @serialized_method
    def delete(self, request_id: str) -> bool:
        return self.items.pop(request_id, None) is not None

    @serialized_method
    def get_by_client(self, client_id: str):
        return [replace(item) for item in self.items.values() if item.client_id == client_id]

    @serialized_method
    def cleanup(self, max_age: Optional[float] = None) -> int:
        now = time.time()
        ttl = max_age or self.default_ttl
        expired = [rid for rid, item in self.items.items() if now - item.stored_at > ttl]
        for request_id in expired:
            self.items.pop(request_id, None)
        return len(expired)

    @serialized_method
    def get_stats(self) -> Dict[str, Any]:
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
