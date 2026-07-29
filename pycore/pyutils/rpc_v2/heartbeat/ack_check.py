#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Heartbeat task for monitoring ACK timeouts in rpc_v2.
"""

import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.heartbeat.thread import TaskModel, TaskHandler

from pycore.pyutils.rpc_v2.common.request_event_table import RequestStatus


class RpcAckCheckModel(TaskModel):
    def __init__(self):
        self._server = None
        self._pending: Optional[List[Dict[str, Any]]] = None
        self._last_check = 0.0
        self.ack_timeout = 5.0

    def set_server(self, server):
        self._server = server

    def get_name(self) -> str:
        return "rpc_v2_ack_check"

    def has_pending_data(self) -> bool:
        if not self._server:
            return False
        if time.time() - self._last_check < 1.0:
            return False

        events = []
        now = time.time()
        for event in self._server.request_event_table.events.values():
            if event.status == RequestStatus.ACK_PENDING and event.last_notify_attempt:
                if now - event.last_notify_attempt > self.ack_timeout:
                    events.append(
                        {
                            "request_id": event.request_id,
                            "client_id": event.client_id,
                            "route": event.route,
                            "result": event.result,
                            "error": event.error,
                            "client_type": event.client_type,
                        }
                    )
        self._pending = events if events else None
        return bool(self._pending)

    def get_pending_data(self) -> Any:
        data = self._pending
        self._pending = None
        self._last_check = time.time()
        return data or []

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc_v2.heartbeat.ack_check.RpcAckCheckHandler"

    def get_interval(self) -> int:
        return 1

    def get_priority(self) -> int:
        return 30


class RpcAckCheckHandler(TaskHandler):
    def __init__(self):
        super().__init__()
        self._server = None

    def set_server(self, server):
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, list):
            return False

        for item in data:
            request_id = item["request_id"]
            if item.get("client_type") == "websocket" and item.get("client_id"):
                # Store result in inventory for client to pull later
                self._server.inventory_table.store(
                    request_id=request_id,
                    route=item.get("route", "unknown"),
                    result=item.get("result"),
                    client_id=item.get("client_id"),
                    client_type="websocket",
                    error=item.get("error"),
                )
            self._server.request_event_table.mark_stored(request_id)

        if data and self._server.debug:
            ColorPrint.yellow(f"[RpcAckCheck] Stored {len(data)} ACK timeouts in inventory")
        return True


__all__ = ["RpcAckCheckModel", "RpcAckCheckHandler"]
