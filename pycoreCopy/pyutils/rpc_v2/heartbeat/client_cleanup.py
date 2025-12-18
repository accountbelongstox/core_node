#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Client cleanup heartbeat for rpc_v2.
"""

import time
from typing import Any, Dict, List, Optional

from pycore import ColorPrint
from pycore.pyfoundations.heartbeat.heartbeat_thread import TaskModel, TaskHandler

from pycore.pyutils.rpc_v2.server.client_registry import ClientStatus


class RpcClientCleanupModel(TaskModel):
    def __init__(self):
        self._server = None
        self._last_check = 0.0
        self._pending: Optional[Dict[str, List[str]]] = None

    def set_server(self, server):
        self._server = server

    def get_name(self) -> str:
        return "rpc_v2_client_cleanup"

    def has_pending_data(self) -> bool:
        if not self._server:
            return False
        if time.time() - self._last_check < 5.0:
            return False
        clients = self._server.client_registry.get_clients_snapshot()
        if not clients:
            return False

        now = time.time()
        disconnected: List[str] = []
        expired: List[str] = []

        for client_id, session in clients.items():
            idle_duration = now - session.last_active
            if session.status in {ClientStatus.DISCONNECTED, ClientStatus.RECONNECTING}:
                if session.disconnect_at and now - session.disconnect_at > 300:
                    expired.append(client_id)
                else:
                    disconnected.append(client_id)
            elif session.status == ClientStatus.CONNECTED and idle_duration > 600:
                disconnected.append(client_id)

        if disconnected or expired:
            self._pending = {"disconnected": disconnected, "expired": expired}
            return True

        self._pending = None
        return False

    def get_pending_data(self) -> Any:
        data = self._pending or {"disconnected": [], "expired": []}
        self._pending = None
        self._last_check = time.time()
        return data

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc_v2.heartbeat.client_cleanup.RpcClientCleanupHandler"

    def get_interval(self) -> int:
        return 5

    def get_priority(self) -> int:
        return 50


class RpcClientCleanupHandler(TaskHandler):
    def __init__(self):
        super().__init__()
        self._server = None

    def set_server(self, server):
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, dict):
            return False

        for client_id in data.get("expired", []):
            self._server.inventory_table.store(
                request_id=f"expired-{client_id}",
                route="client_cleanup",
                result={"message": "client expired"},
                client_id=client_id,
                client_type="websocket",
            )
            self._server.client_registry.force_remove(client_id)

        # Disconnected clients just logged
        if self._server.debug and (data.get("disconnected") or data.get("expired")):
            ColorPrint.blue(
                f"[RpcClientCleanup] {len(data.get('disconnected', []))} disconnected, "
                f"{len(data.get('expired', []))} expired"
            )
        return True


__all__ = ["RpcClientCleanupModel", "RpcClientCleanupHandler"]
