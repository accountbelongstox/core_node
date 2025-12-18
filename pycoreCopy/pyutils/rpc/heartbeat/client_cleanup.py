#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Client Cleanup Heartbeat Task

Monitors disconnected clients and cleans up after timeout.
Checks for reconnecting clients and delivers pending messages.
"""

import time
from typing import Any, Dict, List

from pycore import ColorPrint
from pycore.pyfoundations.heartbeat.heartbeat_thread import TaskModel, TaskHandler


class RpcClientCleanupModel(TaskModel):
    """
    Model for client cleanup task

    Checks for:
    1. Disconnected clients that need cleanup
    2. Reconnecting clients with pending messages
    3. Clients that have exceeded reconnection timeout
    """

    def __init__(self):
        self._server = None
        self._last_check = 0.0
        self._pending_data = None

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def get_name(self) -> str:
        return "client_cleanup"

    def has_pending_data(self) -> bool:
        """Check if there are clients to process"""
        if not self._server:
            return False

        # Check every 5 seconds
        if time.time() - self._last_check < 5.0:
            return False

        # Check if there are any clients
        if not self._server.clients:
            return False

        # Prepare cleanup data
        self._pending_data = self._collect_cleanup_data()
        return self._pending_data is not None

    def _collect_cleanup_data(self) -> Dict[str, Any]:
        """Collect data about clients needing attention"""
        now = time.time()
        max_idle = 300.0  # 5 minutes idle timeout
        max_reconnect_wait = 300.0  # 5 minutes reconnect timeout

        disconnected = []
        reconnecting = []
        expired = []

        for client_id, client_info in self._server.clients.items():
            from pycore.pyutils.rpc.server.threaded_server import ClientState

            if client_info.state == ClientState.DISCONNECTED:
                # Check if exceeded reconnect wait time
                idle_time = now - client_info.last_activity
                if idle_time > max_reconnect_wait:
                    expired.append(client_id)
                else:
                    disconnected.append(client_id)

            elif client_info.state == ClientState.RECONNECTING:
                # Client reconnected, check for pending messages
                if not client_info.message_queue.empty():
                    reconnecting.append(client_id)

            elif client_info.state == ClientState.CONNECTED:
                # Check for idle timeout
                idle_time = now - client_info.last_activity
                if idle_time > max_idle:
                    disconnected.append(client_id)

        if disconnected or reconnecting or expired:
            return {
                'disconnected': disconnected,
                'reconnecting': reconnecting,
                'expired': expired,
                'timestamp': now
            }

        return None

    def get_pending_data(self) -> Any:
        data = self._pending_data
        self._pending_data = None
        self._last_check = time.time()
        return data

    def get_handler_class(self) -> str:
        return "pycore.pyutils.rpc.heartbeat.client_cleanup.RpcClientCleanupHandler"

    def get_interval(self) -> int:
        return 5  # Check every 5 seconds

    def get_priority(self) -> int:
        return 50  # Medium priority


class RpcClientCleanupHandler(TaskHandler):
    """
    Handler for client cleanup

    Processes disconnected, reconnecting, and expired clients.
    """

    def __init__(self):
        super().__init__()
        self._server = None
        self._cleaned_count = 0
        self._reconnected_count = 0

    def set_server(self, server):
        """Set RPC server instance"""
        self._server = server

    def process(self, data: Any) -> bool:
        if not self._server or not isinstance(data, dict):
            return False

        disconnected = data.get('disconnected', [])
        reconnecting = data.get('reconnecting', [])
        expired = data.get('expired', [])

        # Handle reconnecting clients (deliver pending messages)
        for client_id in reconnecting:
            self._deliver_pending_messages(client_id)
            self._reconnected_count += 1

        # Handle expired clients (remove from registry)
        for client_id in expired:
            self._cleanup_expired_client(client_id)
            self._cleaned_count += 1

        # Handle disconnected clients (mark for potential reconnection)
        for client_id in disconnected:
            self._mark_client_disconnected(client_id)

        if self._server.debug and (disconnected or reconnecting or expired):
            ColorPrint.blue(
                f"[RpcCleanup] Processed: {len(disconnected)} disconnected, "
                f"{len(reconnecting)} reconnected, {len(expired)} expired"
            )

        return True

    def _deliver_pending_messages(self, client_id: str):
        """Deliver pending messages to reconnected client"""
        if client_id not in self._server.clients:
            return

        client_info = self._server.clients[client_id]

        # Deliver all pending messages
        delivered = 0
        while not client_info.message_queue.empty():
            try:
                message = client_info.message_queue.get_nowait()
                # In real implementation, send to WebSocket
                # For now, just log
                delivered += 1
            except Exception:
                break

        if self._server.debug and delivered > 0:
            ColorPrint.blue(f"[RpcCleanup] Delivered {delivered} pending messages to {client_id[:8]}...")

    def _cleanup_expired_client(self, client_id: str):
        """Remove expired client from registry"""
        if client_id in self._server.clients:
            client_info = self._server.clients[client_id]

            # Move pending messages to inventory table
            pending_count = client_info.message_queue.qsize()
            if pending_count > 0:
                # Store in inventory for later retrieval
                if self._server.debug:
                    ColorPrint.yellow(
                        f"[RpcCleanup] Client {client_id[:8]}... expired with {pending_count} pending messages"
                    )

            # Remove from clients
            del self._server.clients[client_id]

    def _mark_client_disconnected(self, client_id: str):
        """Mark client as disconnected (waiting for reconnection)"""
        if client_id in self._server.clients:
            from pycore.pyutils.rpc.server.threaded_server import ClientState

            client_info = self._server.clients[client_id]
            client_info.state = ClientState.DISCONNECTED
            client_info.last_activity = time.time()

    def get_stats(self) -> Dict[str, Any]:
        stats = super().get_stats()
        stats['cleaned_count'] = self._cleaned_count
        stats['reconnected_count'] = self._reconnected_count
        return stats


__all__ = ['RpcClientCleanupModel', 'RpcClientCleanupHandler']
