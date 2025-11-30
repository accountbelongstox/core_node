#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Inventory Cleanup Heartbeat Task

Cleans up expired items from inventory table.
"""

import time
from typing import Any, Dict

from pycore import ColorPrint
from pycore.pyfoundations.heartbeat.heartbeat_thread import TaskModel, TaskHandler


class RpcInventoryCleanupModel(TaskModel):
    """
    Model for inventory cleanup task

    Checks for expired inventory items that should be removed.
    """

    def __init__(self):
        self._server = None
        self._last_check = 0.0
        self._pending_data = None
        self.max_age = 3600.0  # 1 hour TTL

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def get_name(self) -> str:
        return "inventory_cleanup"

    def has_pending_data(self) -> bool:
        """Check if cleanup is needed"""
        if not self._server:
            return False

        # Check every 60 seconds
        if time.time() - self._last_check < 60.0:
            return False

        # Check inventory size
        if len(self._server.inventory_table.items) == 0:
            return False

        self._pending_data = {
            'action': 'cleanup',
            'max_age': self.max_age,
            'timestamp': time.time()
        }
        return True

    def get_pending_data(self) -> Any:
        data = self._pending_data
        self._pending_data = None
        self._last_check = time.time()
        return data

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc.heartbeat.inventory_cleanup.RpcInventoryCleanupHandler"

    def get_interval(self) -> int:
        return 60  # Check every minute

    def get_priority(self) -> int:
        return 80  # Lower priority (cleanup is less urgent)


class RpcInventoryCleanupHandler(TaskHandler):
    """
    Handler for inventory cleanup

    Removes expired items from inventory table.
    """

    def __init__(self):
        super().__init__()
        self._server = None
        self._total_cleaned = 0

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, dict):
            return False

        max_age = data.get('max_age', 3600.0)

        # Perform cleanup
        cleaned_count = self._server.inventory_table.cleanup(max_age=max_age)
        self._total_cleaned += cleaned_count

        if self._server.debug and cleaned_count > 0:
            ColorPrint.blue(f"[RpcInventory] Cleaned {cleaned_count} expired items")

        return True

    def get_stats(self) -> Dict[str, Any]:
        stats = super().get_stats()
        stats['total_cleaned'] = self._total_cleaned
        return stats


__all__ = ['RpcInventoryCleanupModel', 'RpcInventoryCleanupHandler']
