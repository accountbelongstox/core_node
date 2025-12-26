#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inventory Table - Stores failed notification results

Stores request results that failed to notify clients,
allowing clients to query and retrieve results later.

This is the inventory event table mentioned in the architecture.
"""

import time
import threading
from typing import Dict, Optional, Any
from dataclasses import dataclass, field

from pycore import ColorPrint


@dataclass
class InventoryItem:
    """Inventory item data structure"""
    request_id: str
    route: str
    result: Any
    error: Optional[str] = None
    client_id: Optional[str] = None
    client_type: str = 'unknown'
    stored_at: float = field(default_factory=time.time)
    accessed_at: Optional[float] = None
    access_count: int = 0


class InventoryTable:
    """
    Inventory Table - Stores failed notification results
    
    When a WebSocket notification fails after retries,
    the result is stored here for later retrieval by the client.
    
    Usage:
        inventory = InventoryTable(max_size=10000000)
        inventory.store(request_id, route, result, client_id, 'websocket')
        item = inventory.get(request_id)
    """
    
    def __init__(self, max_size: int = 10000000, default_ttl: float = 3600.0, debug: bool = True):
        """
        Initialize Inventory Table

        Args:
            max_size: Maximum number of items to store
            default_ttl: Default time to live in seconds (1 hour)
            debug: Enable debug logging
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.debug = debug
        self.items: Dict[str, InventoryItem] = {}
        self._lock = threading.RLock()

        if self.debug:
            ColorPrint.green(f"[InventoryTable] Initialized with max_size={max_size}, ttl={default_ttl}s")
    
    def store(
        self,
        request_id: str,
        route: str,
        result: Any,
        client_id: Optional[str] = None,
        client_type: str = 'unknown',
        error: Optional[str] = None
    ) -> bool:
        """
        Store result in inventory
        
        Args:
            request_id: Request ID
            route: Route name
            result: Result data
            client_id: Client ID
            client_type: Client type
            error: Optional error message
            
        Returns:
            True if stored successfully
        """
        with self._lock:
            # Check size limit
            if len(self.items) >= self.max_size:
                self._cleanup_oldest()
            
            item = InventoryItem(
                request_id=request_id,
                route=route,
                result=result,
                error=error,
                client_id=client_id,
                client_type=client_type
            )
            
            self.items[request_id] = item
            
            if ColorPrint:
                ColorPrint.blue(f"[InventoryTable] Stored result for request {request_id}")
            
            return True
    
    def get(self, request_id: str, remove: bool = False) -> Optional[InventoryItem]:
        """
        Get item from inventory
        
        Args:
            request_id: Request ID
            remove: Whether to remove after getting
            
        Returns:
            InventoryItem or None
        """
        with self._lock:
            item = self.items.get(request_id)
            
            if item:
                item.accessed_at = time.time()
                item.access_count += 1
                
                if remove:
                    del self.items[request_id]
                    if ColorPrint:
                        ColorPrint.blue(f"[InventoryTable] Retrieved and removed request {request_id}")
            
            return item
    
    def has(self, request_id: str) -> bool:
        """Check if item exists"""
        with self._lock:
            return request_id in self.items
    
    def delete(self, request_id: str) -> bool:
        """Delete item from inventory"""
        with self._lock:
            if request_id in self.items:
                del self.items[request_id]
                return True
            return False
    
    def get_by_client(self, client_id: str) -> list[InventoryItem]:
        """Get all items for a client"""
        with self._lock:
            return [
                item for item in self.items.values()
                if item.client_id == client_id
            ]
    
    def _cleanup_oldest(self):
        """Remove oldest item when size limit reached"""
        if not self.items:
            return
        
        oldest_id = min(
            self.items.keys(),
            key=lambda k: self.items[k].stored_at
        )
        del self.items[oldest_id]
    
    def cleanup(self, max_age: Optional[float] = None) -> int:
        """
        Clean up expired items
        
        Args:
            max_age: Maximum age in seconds (None for default TTL)
            
        Returns:
            Number of items cleaned
        """
        with self._lock:
            now = time.time()
            max_age = max_age or self.default_ttl
            cleaned = 0
            expired_ids = []
            
            for request_id, item in self.items.items():
                if now - item.stored_at > max_age:
                    expired_ids.append(request_id)
            
            for request_id in expired_ids:
                del self.items[request_id]
                cleaned += 1
            
            # Also check size limit
            while len(self.items) > self.max_size:
                self._cleanup_oldest()
                cleaned += 1
            
            return cleaned
    
    def get_stats(self) -> Dict[str, Any]:
        """Get inventory statistics"""
        with self._lock:
            stats = {
                'total': len(self.items),
                'max_size': self.max_size,
                'by_client_type': {}
            }
            
            for item in self.items.values():
                client_type = item.client_type
                stats['by_client_type'][client_type] = stats['by_client_type'].get(client_type, 0) + 1
            
            return stats


# Default global inventory table
default_inventory_table = InventoryTable(max_size=10000000)

__all__ = ['InventoryTable', 'InventoryItem', 'default_inventory_table']

