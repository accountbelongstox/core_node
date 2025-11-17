#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Client registry for the FastAPI RPC server.

This module replaces the aiohttp-specific ClientManager with a Starlette/FastAPI
friendly implementation that keeps the same lifecycle guarantees (state machine,
pending message queue, reconnection support).
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from pycore import ColorPrint


class ClientStatus(Enum):
    """Connection lifecycle states."""

    CONNECTING = "connecting"
    CONNECTED = "connected"
    IDLE = "idle"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"


@dataclass
class ClientSession:
    """Runtime metadata tracked for each WebSocket client."""

    client_id: str
    websocket: Any
    status: ClientStatus
    client_type: str = "websocket"

    created_at: float = field(default_factory=time.time)
    connected_at: Optional[float] = None
    last_active: float = field(default_factory=time.time)
    last_ping: Optional[float] = None
    disconnect_at: Optional[float] = None

    request_count: int = 0
    sent_messages: int = 0
    received_messages: int = 0

    remote_addr: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    pending_messages: List[Dict[str, Any]] = field(default_factory=list)


class ClientRegistry:
    """
    Track active WebSocket clients in a FastAPI friendly way.

    The registry is async-safe and provides helpers for reconnection, pending
    message replay, and graceful shutdown.
    """

    def __init__(self, debug: bool = False):
        self.debug = debug
        self._clients: Dict[str, ClientSession] = {}
        self._http_sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    @property
    def ws_clients(self) -> Dict[str, Any]:
        """Return a snapshot of client_id -> websocket mappings."""
        return {cid: info.websocket for cid, info in self._clients.items() if info.websocket}

    async def register_websocket_client(
        self,
        client_id: str,
        websocket: Any,
        remote_addr: Optional[str] = None,
        user_agent: Optional[str] = None,
        reuse_if_reconnecting: bool = True,
    ) -> ClientSession:
        """
        Register (or re-register) a WebSocket client.

        If `reuse_if_reconnecting` is True and an existing session is marked as
        RECONNECTING the websocket reference is replaced while pending messages
        are preserved.
        """

        async with self._lock:
            existing = self._clients.get(client_id)
            if (
                existing
                and reuse_if_reconnecting
                and existing.status in {ClientStatus.RECONNECTING, ClientStatus.DISCONNECTED}
            ):
                existing.websocket = websocket
                existing.status = ClientStatus.CONNECTING
                existing.remote_addr = remote_addr or existing.remote_addr
                existing.user_agent = user_agent or existing.user_agent
                existing.disconnect_at = None
                if self.debug:
                    ColorPrint.green(
                        f"[ClientRegistry] Client reconnected: {client_id[:8]}..."
                        f" pending={len(existing.pending_messages)}"
                    )
                return existing

            session = ClientSession(
                client_id=client_id,
                websocket=websocket,
                status=ClientStatus.CONNECTING,
                remote_addr=remote_addr,
                user_agent=user_agent,
            )
            self._clients[client_id] = session

            if self.debug:
                ColorPrint.green(f"[ClientRegistry] Registered new WS client: {client_id[:8]}...")

            return session

    async def unregister_websocket_client(self, client_id: str):
        """Mark a client as disconnected and drop the websocket reference."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session:
                return

            session.status = ClientStatus.DISCONNECTED
            session.disconnect_at = time.time()
            session.websocket = None

            if self.debug:
                ColorPrint.blue(f"[ClientRegistry] Client disconnected: {client_id[:8]}...")

    async def set_client_status(self, client_id: str, status: ClientStatus):
        """Set status with timestamp bookkeeping."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session:
                return

            session.status = status
            timestamp = time.time()
            if status == ClientStatus.CONNECTED:
                session.connected_at = session.connected_at or timestamp
            if status == ClientStatus.RECONNECTING:
                session.disconnect_at = timestamp

    async def update_client_activity(self, client_id: str):
        """Refresh last_active timestamp (called on every message)."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session:
                return
            session.last_active = time.time()
            session.request_count += 1
            session.received_messages += 1

    async def update_client_ping(self, client_id: str):
        """Record heartbeat latency information."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session:
                return
            session.last_ping = time.time()

    async def queue_pending_message(self, client_id: str, payload: Dict[str, Any]):
        """Persist payload for replay after reconnection."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session:
                return
            session.pending_messages.append(payload)
            if self.debug:
                ColorPrint.yellow(
                    f"[ClientRegistry] Queued pending message for {client_id[:8]}... (total={len(session.pending_messages)})"
                )

    async def send_pending_messages(self, client_id: str) -> int:
        """Flush pending messages for a reconnected client."""
        async with self._lock:
            session = self._clients.get(client_id)
            if not session or not session.pending_messages:
                return 0
            messages = list(session.pending_messages)
            session.pending_messages.clear()

        delivered = 0
        for payload in messages:
            success = await self.safe_send(client_id, payload, track_stats=False)
            if success:
                delivered += 1
        if delivered and self.debug:
            ColorPrint.green(f"[ClientRegistry] Delivered {delivered} pending messages to {client_id[:8]}...")
        return delivered

    async def safe_send(self, client_id: str, payload: Dict[str, Any], track_stats: bool = True) -> bool:
        """Send JSON payload if websocket is active."""
        session = self._clients.get(client_id)
        websocket = session.websocket if session else None
        if not session or not websocket:
            return False

        if not self._is_websocket_connected(websocket):
            return False

        try:
            await websocket.send_json(payload)
            if track_stats:
                session.sent_messages += 1
            return True
        except Exception as exc:  # pragma: no cover - network failures
            if self.debug:
                ColorPrint.yellow(f"[ClientRegistry] Failed to send payload to {client_id[:8]}... ({exc})")
            return False

    @staticmethod
    def _is_websocket_connected(websocket: Any) -> bool:
        """
        Determine if FastAPI's WebSocket connection is still alive.

        Uses the `client_state` attribute exposed by Starlette. Falls back to
        True if the attribute is missing (custom test doubles).
        """
        state = getattr(websocket, "client_state", None)
        if state is None:
            return True
        name = getattr(state, "name", str(state)).lower()
        return name == "connected"

    def get_clients_snapshot(self) -> Dict[str, ClientSession]:
        """Return shallow copy of client sessions (for monitoring/cleanup)."""
        return dict(self._clients)

    async def remove_client(self, client_id: str):
        """Force remove a client session."""
        async with self._lock:
            self._clients.pop(client_id, None)

    def force_remove(self, client_id: str):
        """Synchronous removal helper (used by housekeeping threads)."""
        self._clients.pop(client_id, None)
