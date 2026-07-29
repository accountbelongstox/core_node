#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inventory cleanup heartbeat task for rpc_v2.
"""

import time
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.heartbeat.thread import TaskModel, TaskHandler


class RpcInventoryCleanupModel(TaskModel):
    def __init__(self):
        self._server = None
        self._pending = None
        self._last_check = 0.0
        self.max_age = 3600.0

    def set_server(self, server):
        self._server = server

    def get_name(self) -> str:
        return "rpc_v2_inventory_cleanup"

    def has_pending_data(self) -> bool:
        if not self._server:
            return False
        if time.time() - self._last_check < 60.0:
            return False
        if len(self._server.inventory_table.items) == 0:
            return False
        self._pending = {"max_age": self.max_age}
        return True

    def get_pending_data(self) -> Any:
        data = self._pending
        self._pending = None
        self._last_check = time.time()
        return data

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc_v2.heartbeat.inventory_cleanup.RpcInventoryCleanupHandler"

    def get_interval(self) -> int:
        return 60

    def get_priority(self) -> int:
        return 80


class RpcInventoryCleanupHandler(TaskHandler):
    def __init__(self):
        super().__init__()
        self._server = None
        self._total_cleaned = 0

    def set_server(self, server):
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, dict):
            return False
        cleaned = self._server.inventory_table.cleanup(max_age=data.get("max_age", 3600.0))
        self._total_cleaned += cleaned
        if cleaned and self._server.debug:
            ColorPrint.blue(f"[RpcInventoryCleanup] Removed {cleaned} expired items")
        return True

    def get_stats(self) -> Dict[str, Any]:
        stats = super().get_stats()
        stats["total_cleaned"] = self._total_cleaned
        return stats


__all__ = ["RpcInventoryCleanupModel", "RpcInventoryCleanupHandler"]
