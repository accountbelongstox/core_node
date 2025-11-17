#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Client Manager - Enhanced client connection and state management

Manages WebSocket client lifecycle with state machine.
Provides safe message sending without exception suppression.

Features:
- Client status management (CONNECTING, CONNECTED, DISCONNECTING, etc.)
- Safe message sending with status checks
- Broadcast capabilities
- Graceful shutdown handling
- Activity tracking
"""

import time
import asyncio
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Optional, Any, List

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

WebSocketResponse = aiohttp.web_ws.WebSocketResponse


class ClientStatus(Enum):
    """
    Client connection status

    State transitions:
        CONNECTING → CONNECTED → DISCONNECTING → DISCONNECTED
        CONNECTED → RECONNECTING → CONNECTED
    """
    CONNECTING = 'connecting'       # WebSocket handshake in progress
    CONNECTED = 'connected'         # Fully connected and active
    IDLE = 'idle'                  # Connected but inactive (no recent activity)
    DISCONNECTING = 'disconnecting' # Gracefully closing (cleanup in progress)
    DISCONNECTED = 'disconnected'  # Closed and cleaned up
    RECONNECTING = 'reconnecting'  # Attempting to reconnect


@dataclass
class ClientInfo:
    """
    Client information with state tracking

    Attributes:
        client_id: Unique client identifier
        ws: WebSocket connection
        status: Current connection status
        client_type: Type of client ('websocket' or 'http')
        created_at: Connection creation timestamp
        connected_at: Fully connected timestamp
        last_active: Last activity timestamp
        last_ping: Last ping timestamp
        disconnect_at: Disconnection timestamp
        request_count: Number of requests processed
        sent_messages: Number of messages sent
        received_messages: Number of messages received
        remote_addr: Client remote address
        user_agent: Client user agent
        metadata: Additional client metadata
        pending_messages: Messages queued for disconnected client
    """
    client_id: str
    ws: WebSocketResponse
    status: ClientStatus
    client_type: str = 'websocket'

    # Timestamps
    created_at: float = field(default_factory=time.time)
    connected_at: Optional[float] = None
    last_active: float = field(default_factory=time.time)
    last_ping: Optional[float] = None
    disconnect_at: Optional[float] = None

    # Statistics
    request_count: int = 0
    sent_messages: int = 0
    received_messages: int = 0

    # Metadata
    remote_addr: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Message queue for disconnected clients
    pending_messages: List[Dict] = field(default_factory=list)


class ClientManager:
    """
    Enhanced Client Manager with state management

    Manages WebSocket client lifecycle without exception suppression.
    Uses state checks instead of try-except for connection errors.

    Features:
    - State-based client management
    - Safe message sending with status checks
    - Broadcast to all/filtered clients
    - Graceful shutdown handling
    - Activity tracking
    - Message queueing for reconnection

    Usage:
        manager = ClientManager(debug=True)

        # Register client
        client = await manager.register_websocket_client(client_id, ws, remote_addr)

        # Set connected
        await manager.set_client_status(client_id, ClientStatus.CONNECTED)

        # Send message
        success = await manager.safe_send(client_id, message)

        # Broadcast
        await manager.broadcast(message, status_filter=[ClientStatus.CONNECTED])

        # Unregister
        await manager.unregister_websocket_client(client_id)
    """

    def __init__(self, debug: bool = False):
        """
        Initialize Client Manager

        Args:
            debug: Enable debug logging
        """
        self.debug = debug

        # Client registry (client_id -> ClientInfo)
        self.clients: Dict[str, ClientInfo] = {}

        # HTTP sessions (session_id -> session_data)
        self.http_sessions: Dict[str, Dict[str, Any]] = {}

        # Async lock for thread-safe operations
        self._lock = asyncio.Lock()

    @property
    def ws_clients(self) -> Dict[str, WebSocketResponse]:
        """
        Backward compatibility property for legacy code

        Returns:
            Dict mapping client_id to WebSocket connection
        """
        return {cid: client.ws for cid, client in self.clients.items()}

    async def register_websocket_client(
        self,
        client_id: str,
        ws: WebSocketResponse,
        remote_addr: Optional[str] = None,
        user_agent: Optional[str] = None,
        reuse_if_reconnecting: bool = True
    ) -> ClientInfo:
        """
        Register WebSocket client (supports reconnection with same ID)

        Args:
            client_id: Client ID (persistent across reconnections)
            ws: WebSocket connection
            remote_addr: Remote address
            user_agent: User agent string
            reuse_if_reconnecting: If True and client_id exists with RECONNECTING status,
                                  reuse the existing ClientInfo (preserves pending_messages)

        Returns:
            ClientInfo: Registered client information
        """
        async with self._lock:
            # Check if reconnecting with existing client_id
            existing_client = self.clients.get(client_id)

            if existing_client and reuse_if_reconnecting and existing_client.status == ClientStatus.RECONNECTING:
                # Reuse existing client (preserves pending_messages)
                existing_client.ws = ws
                existing_client.status = ClientStatus.CONNECTING
                existing_client.remote_addr = remote_addr or existing_client.remote_addr
                existing_client.user_agent = user_agent or existing_client.user_agent
                existing_client.disconnect_at = None  # Clear disconnect timestamp

                if self.debug:
                    ColorPrint.green(
                        f"[ClientManager] Client reconnected: {client_id[:8]}... "
                        f"(pending messages: {len(existing_client.pending_messages)})"
                    )

                return existing_client
            else:
                # Create new client
                client = ClientInfo(
                    client_id=client_id,
                    ws=ws,
                    status=ClientStatus.CONNECTING,  # Initial state
                    remote_addr=remote_addr,
                    user_agent=user_agent
                )

                self.clients[client_id] = client

                if self.debug:
                    ColorPrint.green(
                        f"[ClientManager] Client registered: {client_id[:8]}... "
                        f"(status: {ClientStatus.CONNECTING.value}, addr: {remote_addr})"
                    )

                return client

    async def set_client_status(self, client_id: str, status: ClientStatus, validate_transition: bool = True):
        """
        Set client status with optional transition validation

        Valid transitions:
            CONNECTING → CONNECTED
            CONNECTED → IDLE, DISCONNECTING, RECONNECTING
            IDLE → CONNECTED, DISCONNECTING
            DISCONNECTING → DISCONNECTED
            RECONNECTING → CONNECTING

        Args:
            client_id: Client ID
            status: New status
            validate_transition: If True, validate state transition (default: True)
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if not client:
                if self.debug:
                    ColorPrint.yellow(f"[ClientManager] Cannot set status: client {client_id[:8]}... not found")
                return

            old_status = client.status

            # Validate transition if enabled
            if validate_transition:
                valid_transitions = {
                    ClientStatus.CONNECTING: [ClientStatus.CONNECTED, ClientStatus.DISCONNECTED],
                    ClientStatus.CONNECTED: [ClientStatus.IDLE, ClientStatus.DISCONNECTING, ClientStatus.RECONNECTING, ClientStatus.DISCONNECTED],
                    ClientStatus.IDLE: [ClientStatus.CONNECTED, ClientStatus.DISCONNECTING, ClientStatus.DISCONNECTED],
                    ClientStatus.DISCONNECTING: [ClientStatus.DISCONNECTED],
                    ClientStatus.RECONNECTING: [ClientStatus.CONNECTING, ClientStatus.DISCONNECTED],
                    ClientStatus.DISCONNECTED: []  # Terminal state
                }

                allowed = valid_transitions.get(old_status, [])
                if status not in allowed and old_status != status:
                    if self.debug:
                        ColorPrint.yellow(
                            f"[ClientManager] Invalid transition for {client_id[:8]}...: "
                            f"{old_status.value} → {status.value} (allowed: {[s.value for s in allowed]})"
                        )
                    return

            client.status = status

            # Update timestamps based on status transition
            if status == ClientStatus.CONNECTED:
                client.connected_at = time.time()
            elif status == ClientStatus.DISCONNECTED:
                client.disconnect_at = time.time()

            if self.debug:
                ColorPrint.blue(
                    f"[ClientManager] Client {client_id[:8]}... status: "
                    f"{old_status.value} → {status.value}"
                )

    async def update_client_activity(self, client_id: str):
        """
        Update client last activity timestamp

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if client:
                client.last_active = time.time()

                # Update status from IDLE to CONNECTED if active
                if client.status == ClientStatus.IDLE:
                    client.status = ClientStatus.CONNECTED

    async def update_client_ping(self, client_id: str):
        """
        Update client last ping timestamp

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if client:
                client.last_ping = time.time()
                client.last_active = time.time()

    async def increment_request_count(self, client_id: str):
        """
        Increment client request count

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if client:
                client.request_count += 1

    def update_client_metadata(self, client_id: str, client_type: str, remote_addr: Optional[str] = None):
        """
        Update client metadata (HTTP sessions)

        Args:
            client_id: Client/session ID
            client_type: Type ('http' or 'websocket')
            remote_addr: Remote address
        """
        if client_type == 'http':
            if client_id not in self.http_sessions:
                self.http_sessions[client_id] = {}
            self.http_sessions[client_id].update({
                'last_seen': time.time(),
                'remote_addr': remote_addr
            })

    async def safe_send(
        self,
        client_id: str,
        message: Dict,
        queue_if_disconnected: bool = False
    ) -> bool:
        """
        Safely send message to client with proper locking and exception handling

        Performs all checks inside lock, then sends outside lock to avoid blocking.

        Args:
            client_id: Client ID
            message: Message to send
            queue_if_disconnected: Queue message if client is reconnecting

        Returns:
            bool: True if sent successfully, False otherwise
        """
        # Phase 1: Check and prepare (inside lock)
        async with self._lock:
            client = self.clients.get(client_id)

            # Check 1: Client exists
            if not client:
                if self.debug:
                    ColorPrint.yellow(f"[ClientManager] Cannot send: client {client_id[:8]}... not found")
                return False

            # Check 2: Client status
            if client.status != ClientStatus.CONNECTED:
                # Special case: Queue for reconnecting clients
                if queue_if_disconnected and client.status == ClientStatus.RECONNECTING:
                    # Apply queue size limit
                    MAX_PENDING_MESSAGES = 100
                    if len(client.pending_messages) < MAX_PENDING_MESSAGES:
                        client.pending_messages.append(message)
                        if self.debug:
                            ColorPrint.yellow(
                                f"[ClientManager] Message queued for {client_id[:8]}... "
                                f"(status: {client.status.value}, queue: {len(client.pending_messages)}/{MAX_PENDING_MESSAGES})"
                            )
                    else:
                        if self.debug:
                            ColorPrint.red(
                                f"[ClientManager] Queue full for {client_id[:8]}..., "
                                f"message dropped (limit: {MAX_PENDING_MESSAGES})"
                            )
                    return False
                else:
                    if self.debug:
                        ColorPrint.yellow(
                            f"[ClientManager] Cannot send to {client_id[:8]}... "
                            f"(status: {client.status.value})"
                        )
                    return False

            # Check 3: WebSocket closed state
            if client.ws.closed:
                # WebSocket is closed, update status
                client.status = ClientStatus.DISCONNECTED
                if self.debug:
                    ColorPrint.yellow(
                        f"[ClientManager] WebSocket closed for {client_id[:8]}..., "
                        f"updated status to DISCONNECTED"
                    )
                return False

            # Get reference to WebSocket (for use outside lock)
            ws = client.ws

        # Phase 2: Send message (outside lock to avoid blocking)
        try:
            await ws.send_json(message)

            # Phase 3: Update statistics (inside lock)
            async with self._lock:
                client = self.clients.get(client_id)
                if client:
                    client.sent_messages += 1
                    client.last_active = time.time()

            if self.debug:
                ColorPrint.green(f"[ClientManager] Message sent to {client_id[:8]}...")

            return True

        except Exception as e:
            # Handle connection errors
            if self.debug:
                ColorPrint.red(
                    f"[ClientManager] Failed to send to {client_id[:8]}...: "
                    f"{type(e).__name__}: {e}"
                )

            # Update client status on error
            async with self._lock:
                client = self.clients.get(client_id)
                if client and client.status == ClientStatus.CONNECTED:
                    client.status = ClientStatus.DISCONNECTED

            return False

    async def broadcast(
        self,
        message: Dict,
        status_filter: Optional[List[ClientStatus]] = None,
        exclude_clients: Optional[List[str]] = None
    ):
        """
        Broadcast message to multiple clients

        Args:
            message: Message to broadcast
            status_filter: Only send to clients with these statuses (default: [CONNECTED])
            exclude_clients: List of client IDs to exclude
        """
        if status_filter is None:
            status_filter = [ClientStatus.CONNECTED]

        if exclude_clients is None:
            exclude_clients = []

        async with self._lock:
            # Collect clients to send to
            target_clients = []
            for client_id, client in self.clients.items():
                if client.status in status_filter and client_id not in exclude_clients:
                    target_clients.append(client_id)

            if self.debug:
                ColorPrint.blue(
                    f"[ClientManager] Broadcasting to {len(target_clients)} clients "
                    f"(status filter: {[s.value for s in status_filter]})"
                )

        # Send to each client (outside lock to avoid blocking)
        tasks = []
        for client_id in target_clients:
            tasks.append(self.safe_send(client_id, message))

        # Execute concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successes
        success_count = sum(1 for r in results if r is True)

        if self.debug:
            ColorPrint.green(
                f"[ClientManager] Broadcast completed: {success_count}/{len(target_clients)} sent successfully"
            )

    async def send_pending_messages(self, client_id: str):
        """
        Send all pending messages to a reconnected client

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if not client or not client.pending_messages:
                return

            pending = client.pending_messages.copy()
            client.pending_messages.clear()

        if self.debug:
            ColorPrint.blue(f"[ClientManager] Sending {len(pending)} pending messages to {client_id[:8]}...")

        for message in pending:
            await self.safe_send(client_id, message)

    async def unregister_websocket_client(self, client_id: str):
        """
        Unregister WebSocket client - marks as RECONNECTING for potential reconnection

        Instead of immediately removing client, marks status as RECONNECTING
        to allow queuing messages and potential reconnection within timeout window.

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if not client:
                if self.debug:
                    ColorPrint.yellow(f"[ClientManager] Cannot unregister: client {client_id[:8]}... not found")
                return

            # Set status to RECONNECTING (not DISCONNECTED - allow reconnection)
            # Skip validation because RECONNECTING is valid from CONNECTED/IDLE
            old_status = client.status
            if old_status in [ClientStatus.CONNECTED, ClientStatus.IDLE]:
                client.status = ClientStatus.RECONNECTING
                client.disconnect_at = time.time()

                if self.debug:
                    ColorPrint.blue(
                        f"[ClientManager] Client {client_id[:8]}... marked as RECONNECTING "
                        f"(status: {old_status.value} → RECONNECTING, "
                        f"pending messages: {len(client.pending_messages)})"
                    )
                    if client.pending_messages:
                        ColorPrint.yellow(
                            f"[ClientManager] Client {client_id[:8]}... has {len(client.pending_messages)} "
                            f"pending messages (will be sent on reconnect)"
                        )
            else:
                # If already disconnecting/disconnected, mark as disconnected
                client.status = ClientStatus.DISCONNECTED
                client.disconnect_at = time.time()
                if self.debug:
                    ColorPrint.blue(
                        f"[ClientManager] Client {client_id[:8]}... marked as DISCONNECTED "
                        f"(was: {old_status.value})"
                    )

    async def remove_client(self, client_id: str):
        """
        Permanently remove client from registry (called after timeout)

        Args:
            client_id: Client ID
        """
        async with self._lock:
            client = self.clients.get(client_id)
            if not client:
                return

            # Mark as disconnected
            client.status = ClientStatus.DISCONNECTED
            if not client.disconnect_at:
                client.disconnect_at = time.time()

            # Discard pending messages
            if client.pending_messages:
                ColorPrint.yellow(
                    f"[ClientManager] Discarding {len(client.pending_messages)} "
                    f"pending messages for timed-out client {client_id[:8]}..."
                )

            # Remove from registry
            del self.clients[client_id]

            if self.debug:
                ColorPrint.blue(
                    f"[ClientManager] Client {client_id[:8]}... permanently removed "
                    f"(lifetime: {client.disconnect_at - client.created_at:.2f}s, "
                    f"requests: {client.request_count}, sent: {client.sent_messages})"
                )

    def get_websocket_client(self, client_id: str) -> Optional[WebSocketResponse]:
        """
        Get WebSocket connection by client ID

        Args:
            client_id: Client ID

        Returns:
            WebSocketResponse or None
        """
        client = self.clients.get(client_id)
        return client.ws if client else None

    def is_websocket_connected(self, client_id: str) -> bool:
        """
        Check if WebSocket client is connected

        Args:
            client_id: Client ID

        Returns:
            True if connected (status is CONNECTED and ws is not closed)
        """
        client = self.clients.get(client_id)
        if not client:
            return False

        return client.status == ClientStatus.CONNECTED and not client.ws.closed

    def get_client(self, client_id: str) -> Optional[ClientInfo]:
        """
        Get client information

        Args:
            client_id: Client ID

        Returns:
            ClientInfo or None
        """
        return self.clients.get(client_id)

    def get_all_websocket_clients(self) -> List[ClientInfo]:
        """
        Get all WebSocket clients

        Returns:
            List of ClientInfo
        """
        return list(self.clients.values())

    def get_clients_by_status(self, status: ClientStatus) -> List[ClientInfo]:
        """
        Get clients filtered by status

        Args:
            status: Status to filter by

        Returns:
            List of ClientInfo with matching status
        """
        return [c for c in self.clients.values() if c.status == status]

    def get_client_count(self) -> Dict[str, int]:
        """
        Get client count statistics

        Returns:
            Dictionary with counts by type
        """
        return {
            'websocket': len(self.clients),
            'http_sessions': len(self.http_sessions),
            'total': len(self.clients) + len(self.http_sessions)
        }

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get detailed statistics

        Returns:
            Dictionary with detailed statistics
        """
        stats = {
            'total_clients': len(self.clients),
            'http_sessions': len(self.http_sessions),
            'by_status': {},
            'total_requests': 0,
            'total_sent_messages': 0,
            'total_received_messages': 0,
            'total_pending_messages': 0
        }

        for client in self.clients.values():
            # Count by status
            status = client.status.value
            stats['by_status'][status] = stats['by_status'].get(status, 0) + 1

            # Aggregate statistics
            stats['total_requests'] += client.request_count
            stats['total_sent_messages'] += client.sent_messages
            stats['total_received_messages'] += client.received_messages
            stats['total_pending_messages'] += len(client.pending_messages)

        return stats

    async def cleanup_inactive_clients(
        self,
        max_inactive_time: float = 3600.0,
        max_reconnect_wait: float = 300.0
    ) -> int:
        """
        Clean up inactive and timed-out reconnecting clients

        Args:
            max_inactive_time: Maximum inactive time for CONNECTED clients (seconds, default: 1 hour)
            max_reconnect_wait: Maximum wait time for RECONNECTING clients (seconds, default: 5 minutes)

        Returns:
            Number of clients cleaned up
        """
        now = time.time()
        clients_to_mark_reconnecting = []
        clients_to_remove = []

        async with self._lock:
            for client_id, client in self.clients.items():
                # Case 1: CONNECTED but inactive too long → mark as RECONNECTING
                if client.status == ClientStatus.CONNECTED:
                    if now - client.last_active > max_inactive_time:
                        clients_to_mark_reconnecting.append(client_id)

                # Case 2: RECONNECTING and exceeded max wait time → permanently remove
                elif client.status == ClientStatus.RECONNECTING:
                    if client.disconnect_at and now - client.disconnect_at > max_reconnect_wait:
                        clients_to_remove.append(client_id)

        # Mark inactive CONNECTED clients as RECONNECTING
        for client_id in clients_to_mark_reconnecting:
            await self.unregister_websocket_client(client_id)

        # Permanently remove timed-out RECONNECTING clients
        for client_id in clients_to_remove:
            await self.remove_client(client_id)

        total_cleaned = len(clients_to_mark_reconnecting) + len(clients_to_remove)

        if self.debug and total_cleaned > 0:
            ColorPrint.blue(
                f"[ClientManager] Cleaned up {total_cleaned} clients "
                f"({len(clients_to_mark_reconnecting)} marked reconnecting, "
                f"{len(clients_to_remove)} permanently removed)"
            )

        return total_cleaned


__all__ = ['ClientManager', 'ClientInfo', 'ClientStatus']
