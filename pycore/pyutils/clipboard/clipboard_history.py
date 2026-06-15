#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard History Manager

Stores clipboard history using database.
Supports multi-device synchronization.

Note: This is a lightweight wrapper that uses the database for persistence.
The actual data is stored in the clipboard database via ClipboardHistoryModel.
"""

import time
from typing import List, Dict, Any, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class ClipboardHistory:
    """
    Clipboard history manager (Database-backed)

    Features:
    - Database persistence (via ClipboardHistoryModel)
    - Client-based tracking
    - Timestamp-based ordering
    - Multi-device synchronization
    - Deduplication

    Note: This class is a lightweight interface.
    Actual storage is handled by the database model in RPC manager.
    """

    def __init__(self, max_items: int = 1000):
        """
        Initialize clipboard history

        Args:
            max_items: Maximum history items to keep (for in-memory cache)
        """
        self.max_items = max_items
        self.items: List[Dict[str, Any]] = []

        ColorPrint.blue("[ClipboardHistory] Initialized (database-backed)")

    def add_item(
        self,
        content: str,
        client_id: str = "unknown",
        content_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Add item to clipboard history (in-memory only)

        Note: For database persistence, use RPC API clipboard_add

        Args:
            content: Clipboard content
            client_id: Client identifier
            content_type: Content type (text, image, file, etc.)

        Returns:
            Created item dict
        """
        # Check for duplicates (same content within last 10 items)
        recent_items = self.items[-10:] if len(self.items) >= 10 else self.items
        for item in recent_items:
            if item['content'] == content:
                return item

        # Create new item
        item = {
            'id': f"{int(time.time() * 1000)}_{client_id}",
            'content': content,
            'content_type': content_type,
            'client_id': client_id,
            'timestamp': time.time(),
            'created_at': time.strftime("%Y-%m-%d %H:%M:%S")
        }

        # Add to history
        self.items.append(item)

        # Trim if exceeds max
        if len(self.items) > self.max_items:
            self.items = self.items[-self.max_items:]

        return item

    def get_recent(self, limit: int = 50, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get recent clipboard items

        Args:
            limit: Maximum items to return
            client_id: Filter by client ID (None = all clients)

        Returns:
            List of clipboard items (newest first)
        """
        items = self.items

        # Filter by client if specified
        if client_id:
            items = [item for item in items if item['client_id'] == client_id]

        # Return most recent first
        return list(reversed(items[-limit:]))

    def get_since(self, timestamp: float, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get clipboard items since timestamp

        Args:
            timestamp: Unix timestamp
            client_id: Filter by client ID

        Returns:
            List of items since timestamp
        """
        items = [item for item in self.items if item['timestamp'] > timestamp]

        # Filter by client if specified
        if client_id:
            items = [item for item in items if item['client_id'] == client_id]

        return items

    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search clipboard history

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of matching items
        """
        query_lower = query.lower()
        matches = [
            item for item in self.items
            if query_lower in item['content'].lower()
        ]

        # Return most recent matches first
        return list(reversed(matches[-limit:]))

    def clear_history(self, client_id: Optional[str] = None):
        """
        Clear clipboard history

        Args:
            client_id: Clear only for specific client (None = all)
        """
        if client_id:
            self.items = [item for item in self.items if item['client_id'] != client_id]
            ColorPrint.yellow(f"[ClipboardHistory] Cleared history for client: {client_id}")
        else:
            self.items = []
            ColorPrint.yellow("[ClipboardHistory] Cleared all history")

        self._save_history()

    def get_statistics(self) -> Dict[str, Any]:
        """Get clipboard history statistics"""
        if not self.items:
            return {
                'total_items': 0,
                'clients': [],
                'oldest_timestamp': None,
                'newest_timestamp': None
            }

        clients = list(set(item['client_id'] for item in self.items))

        return {
            'total_items': len(self.items),
            'clients': clients,
            'client_counts': {
                client: len([item for item in self.items if item['client_id'] == client])
                for client in clients
            },
            'oldest_timestamp': self.items[0]['timestamp'],
            'newest_timestamp': self.items[-1]['timestamp']
        }


# Global singleton instance
_global_clipboard_history: Optional[ClipboardHistory] = None


def get_clipboard_history() -> ClipboardHistory:
    """Get global clipboard history singleton"""
    global _global_clipboard_history
    if _global_clipboard_history is None:
        _global_clipboard_history = ClipboardHistory()
    return _global_clipboard_history
