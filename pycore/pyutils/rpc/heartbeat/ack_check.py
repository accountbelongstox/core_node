#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC ACK Check Heartbeat Task

Monitors pending ACK confirmations and handles timeouts.
Stores undelivered results in inventory table.
"""

import time
from typing import Any, Dict, List

from pycore import ColorPrint
from pycore.pyfoundations.heartbeat.heartbeat_thread import TaskModel, TaskHandler
from pycore.pyutils.rpc.common.task_table import RequestStatus


class RpcAckCheckModel(TaskModel):
    """
    Model for ACK timeout checking

    Monitors event table for:
    1. ACK_PENDING requests that have timed out
    2. Failed notifications that need retry or inventory storage
    """

    def __init__(self):
        self._server = None
        self._last_check = 0.0
        self._pending_data = None
        self.ack_timeout = 5.0  # 5 seconds ACK timeout
        self.max_retries = 3

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def get_name(self) -> str:
        return "ack_check"

    def has_pending_data(self) -> bool:
        """Check if there are ACK timeouts to process"""
        if not self._server:
            return False

        # Check every 1 second
        if time.time() - self._last_check < 1.0:
            return False

        # Scan for pending ACKs
        self._pending_data = self._collect_ack_timeouts()
        return self._pending_data is not None

    def _collect_ack_timeouts(self) -> Dict[str, Any]:
        """Collect ACK timeout data"""
        now = time.time()
        timed_out = []

        # Check event table for ACK_PENDING status
        for request_id, event in self._server.request_event_table.events.items():
            if event.status == RequestStatus.ACK_PENDING:
                # Check if timeout exceeded
                if event.notified_at and now - event.notified_at > self.ack_timeout:
                    timed_out.append({
                        'request_id': request_id,
                        'client_id': event.client_id,
                        'route': event.route,
                        'result': event.result,
                        'error': event.error,
                        'notify_attempts': event.notify_attempts,
                        'notified_at': event.notified_at
                    })

        if timed_out:
            return {
                'timed_out': timed_out,
                'timestamp': now
            }

        return None

    def get_pending_data(self) -> Any:
        data = self._pending_data
        self._pending_data = None
        self._last_check = time.time()
        return data

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc.heartbeat.ack_check.RpcAckCheckHandler"

    def get_interval(self) -> int:
        return 1  # Check every second

    def get_priority(self) -> int:
        return 30  # High priority (ACK is important)


class RpcAckCheckHandler(TaskHandler):
    """
    Handler for ACK timeout processing

    Retries notifications or stores in inventory table.
    """

    def __init__(self):
        super().__init__()
        self._server = None
        self._retry_count = 0
        self._inventory_count = 0
        self.max_retries = 3

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, dict):
            return False

        timed_out = data.get('timed_out', [])

        for item in timed_out:
            request_id = item['request_id']
            client_id = item['client_id']
            notify_attempts = item['notify_attempts']

            if notify_attempts < self.max_retries:
                # Retry notification
                self._retry_notification(item)
                self._retry_count += 1
            else:
                # Max retries exceeded, store in inventory
                self._store_in_inventory(item)
                self._inventory_count += 1

        if self._server.debug and timed_out:
            ColorPrint.blue(
                f"[RpcAckCheck] Processed {len(timed_out)} ACK timeouts "
                f"({self._retry_count} retried, {self._inventory_count} stored)"
            )

        return True

    def _retry_notification(self, item: Dict):
        """Retry sending notification to client"""
        request_id = item['request_id']
        client_id = item['client_id']

        # Check if client is still connected
        if client_id not in self._server.clients:
            # Client disconnected, store in inventory
            self._store_in_inventory(item)
            return

        client_info = self._server.clients[client_id]

        from pycore.pyutils.rpc.server.threaded_server import ClientState

        if client_info.state != ClientState.CONNECTED:
            # Client not connected, queue message
            message = {
                'type': 'response',
                'id': request_id,
                'result': item['result'],
                'error': item['error'],
                'success': item['error'] is None,
                'requires_ack': True
            }
            client_info.message_queue.put(message)

            if self._server.debug:
                ColorPrint.blue(f"[RpcAckCheck] Queued message for disconnected client {client_id[:8]}...")
        else:
            # Client connected, retry send
            # In real implementation, send via WebSocket
            # For now, increment attempt counter
            event = self._server.request_event_table.get_event(request_id)
            if event:
                self._server.request_event_table.increment_notify_attempt(request_id)
                # Update notified_at to reset timeout
                event.notified_at = time.time()

    def _store_in_inventory(self, item: Dict):
        """Store failed notification in inventory table"""
        request_id = item['request_id']

        # Store in inventory
        self._server.inventory_table.store(
            request_id=request_id,
            route=item['route'],
            result=item['result'],
            client_id=item['client_id'],
            client_type='websocket',
            error=item['error']
        )

        # Update event status
        self._server.request_event_table.mark_stored(request_id)

        if self._server.debug:
            ColorPrint.yellow(
                f"[RpcAckCheck] Stored {request_id} in inventory after {self.max_retries} failed attempts"
            )

    def get_stats(self) -> Dict[str, Any]:
        stats = super().get_stats()
        stats['retry_count'] = self._retry_count
        stats['inventory_count'] = self._inventory_count
        return stats


__all__ = ['RpcAckCheckModel', 'RpcAckCheckHandler']
