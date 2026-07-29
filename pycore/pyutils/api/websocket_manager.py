"""WebSocket connection manager"""

from typing import Dict, Set, Optional, Any
import asyncio
from datetime import datetime

from pycore.pyfoundations.third_party.api import get_third_package_fastapi

# Get fastapi via third_party manager
fastapi = get_third_package_fastapi()
WebSocket = fastapi.WebSocket


class WebSocketManager:
    """
    WebSocket connection manager (generic utility)

    Features:
    - Connection management (grouped by key)
    - Broadcast messages
    - Automatic cleanup of disconnected connections
    - Thread-safe operations

    Use cases:
    - Video stream broadcasting (one device → multiple clients)
    - Control message routing (client → device)
    - Group control event broadcasting (master → slaves)

    Example:
        ws_manager = WebSocketManager()

        # Connect
        await ws_manager.connect("device1", websocket)

        # Broadcast to all connections of device1
        await ws_manager.broadcast("device1", video_data)

        # Disconnect
        await ws_manager.disconnect("device1", websocket)
    """

    def __init__(self):
        """Initialize WebSocket manager"""
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        self._connection_times: Dict[WebSocket, datetime] = {}

    async def connect(
        self,
        key: str,
        websocket: WebSocket,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Add connection

        Args:
            key: Grouping key (e.g., device serial)
            websocket: WebSocket connection
            metadata: Connection metadata (optional)
        """
        await websocket.accept()

        async with self._lock:
            if key not in self._connections:
                self._connections[key] = set()

            self._connections[key].add(websocket)

            if metadata:
                self._connection_metadata[websocket] = metadata

            self._connection_times[websocket] = datetime.now()

    async def disconnect(self, key: str, websocket: WebSocket):
        """
        Remove connection

        Args:
            key: Grouping key
            websocket: WebSocket connection
        """
        async with self._lock:
            if key in self._connections:
                self._connections[key].discard(websocket)

                if not self._connections[key]:
                    del self._connections[key]

            self._connection_metadata.pop(websocket, None)
            self._connection_times.pop(websocket, None)

    async def broadcast(
        self,
        key: str,
        data: bytes,
        exclude: Optional[Set[WebSocket]] = None
    ):
        """
        Broadcast data to all connections in group

        Args:
            key: Target group key
            data: Data to send (bytes)
            exclude: Connections to exclude (optional)
        """
        if key not in self._connections:
            return

        exclude = exclude or set()
        disconnected = set()

        for ws in self._connections[key]:
            if ws in exclude:
                continue

            try:
                await ws.send_bytes(data)
            except Exception:
                disconnected.add(ws)

        # Clean up disconnected connections
        for ws in disconnected:
            await self.disconnect(key, ws)

    async def broadcast_json(
        self,
        key: str,
        data: Dict[str, Any],
        exclude: Optional[Set[WebSocket]] = None
    ):
        """
        Broadcast JSON data to all connections in group

        Args:
            key: Target group key
            data: JSON data dictionary
            exclude: Connections to exclude (optional)
        """
        if key not in self._connections:
            return

        exclude = exclude or set()
        disconnected = set()

        for ws in self._connections[key]:
            if ws in exclude:
                continue

            try:
                await ws.send_json(data)
            except Exception:
                disconnected.add(ws)

        # Clean up disconnected connections
        for ws in disconnected:
            await self.disconnect(key, ws)

    async def send_bytes(
        self,
        key: str,
        websocket: WebSocket,
        data: bytes
    ):
        """
        Send bytes to specific connection

        Args:
            key: Grouping key
            websocket: Target WebSocket connection
            data: Data to send
        """
        try:
            await websocket.send_bytes(data)
        except Exception:
            await self.disconnect(key, websocket)

    async def send_json(
        self,
        key: str,
        websocket: WebSocket,
        data: Dict[str, Any]
    ):
        """
        Send JSON to specific connection

        Args:
            key: Grouping key
            websocket: Target WebSocket connection
            data: JSON data dictionary
        """
        try:
            await websocket.send_json(data)
        except Exception:
            await self.disconnect(key, websocket)

    def get_connection_count(self, key: str) -> int:
        """
        Get number of connections in group

        Args:
            key: Grouping key

        Returns:
            Number of connections
        """
        return len(self._connections.get(key, set()))

    def get_all_keys(self) -> list:
        """
        Get all group keys

        Returns:
            List of all keys
        """
        return list(self._connections.keys())

    def get_metadata(self, websocket: WebSocket) -> Optional[Dict[str, Any]]:
        """
        Get connection metadata

        Args:
            websocket: WebSocket connection

        Returns:
            Metadata dictionary or None
        """
        return self._connection_metadata.get(websocket)

    def get_connection_time(self, websocket: WebSocket) -> Optional[datetime]:
        """
        Get connection time

        Args:
            websocket: WebSocket connection

        Returns:
            Connection datetime or None
        """
        return self._connection_times.get(websocket)

    def get_total_connections(self) -> int:
        """
        Get total number of connections across all groups

        Returns:
            Total connection count
        """
        return sum(len(conns) for conns in self._connections.values())

    def has_connections(self, key: str) -> bool:
        """
        Check if group has any connections

        Args:
            key: Grouping key

        Returns:
            True if has connections, False otherwise
        """
        return key in self._connections and len(self._connections[key]) > 0

    async def disconnect_all(self, key: str):
        """
        Disconnect all connections in group

        Args:
            key: Grouping key
        """
        if key not in self._connections:
            return

        connections = list(self._connections[key])
        for ws in connections:
            try:
                await ws.close()
            except Exception:
                pass
            await self.disconnect(key, ws)

    async def close_all(self):
        """Close all connections in all groups"""
        keys = self.get_all_keys()
        for key in keys:
            await self.disconnect_all(key)

    def __repr__(self) -> str:
        return (
            f"WebSocketManager(groups={len(self._connections)}, "
            f"total_connections={self.get_total_connections()})"
        )
