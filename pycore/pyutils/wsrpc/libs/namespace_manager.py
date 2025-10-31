# -*- coding: utf-8 -*-
"""
Namespace Manager
Manages namespaces and rooms for grouped broadcasting
"""

import threading
from typing import Dict, Set, List
from pycore.pyfoundations.color_print import ColorPrint


class NamespaceManager:
    """Manages namespaces and rooms for client grouping"""

    def __init__(self):
        """Initialize namespace manager"""
        self.namespaces: Dict[str, Set[str]] = {}
        self.client_namespaces: Dict[str, Set[str]] = {}
        self.rooms: Dict[str, Set[str]] = {}
        self.client_rooms: Dict[str, Set[str]] = {}
        self._lock = threading.Lock()

    def create_namespace(self, name: str) -> 'NamespaceManager':
        """
        Create a new namespace

        Args:
            name: Namespace name

        Returns:
            Self for chaining
        """
        with self._lock:
            if name not in self.namespaces:
                self.namespaces[name] = set()
                ColorPrint.debug(f"Namespace created: {name}")
        return self

    def join_namespace(self, client_id: str, namespace: str) -> bool:
        """
        Add client to namespace

        Args:
            client_id: Client identifier
            namespace: Namespace name

        Returns:
            True if successful
        """
        with self._lock:
            if namespace not in self.namespaces:
                self.create_namespace(namespace)

            self.namespaces[namespace].add(client_id)

            if client_id not in self.client_namespaces:
                self.client_namespaces[client_id] = set()
            self.client_namespaces[client_id].add(namespace)

            ColorPrint.debug(f"Client {client_id} joined namespace {namespace}")
            return True

    def leave_namespace(self, client_id: str, namespace: str) -> bool:
        """
        Remove client from namespace

        Args:
            client_id: Client identifier
            namespace: Namespace name

        Returns:
            True if successful
        """
        with self._lock:
            if namespace in self.namespaces:
                self.namespaces[namespace].discard(client_id)
                if not self.namespaces[namespace]:
                    del self.namespaces[namespace]

            if client_id in self.client_namespaces:
                self.client_namespaces[client_id].discard(namespace)
                if not self.client_namespaces[client_id]:
                    del self.client_namespaces[client_id]

            ColorPrint.debug(f"Client {client_id} left namespace {namespace}")
            return True

    def get_namespace_clients(self, namespace: str) -> List[str]:
        """
        Get all clients in a namespace

        Args:
            namespace: Namespace name

        Returns:
            List of client IDs
        """
        with self._lock:
            ns = self.namespaces.get(namespace)
            return list(ns) if ns else []

    def get_client_namespaces(self, client_id: str) -> List[str]:
        """
        Get all namespaces a client is in

        Args:
            client_id: Client identifier

        Returns:
            List of namespace names
        """
        with self._lock:
            client_ns = self.client_namespaces.get(client_id)
            return list(client_ns) if client_ns else []

    def join_room(self, client_id: str, room: str, namespace: str = 'default') -> bool:
        """
        Add client to a room

        Args:
            client_id: Client identifier
            room: Room name
            namespace: Namespace name

        Returns:
            True if successful
        """
        with self._lock:
            room_key = f"{namespace}:{room}"

            if room_key not in self.rooms:
                self.rooms[room_key] = set()

            self.rooms[room_key].add(client_id)

            if client_id not in self.client_rooms:
                self.client_rooms[client_id] = set()
            self.client_rooms[client_id].add(room_key)

            ColorPrint.debug(f"Client {client_id} joined room {room} in namespace {namespace}")
            return True

    def leave_room(self, client_id: str, room: str, namespace: str = 'default') -> bool:
        """
        Remove client from a room

        Args:
            client_id: Client identifier
            room: Room name
            namespace: Namespace name

        Returns:
            True if successful
        """
        with self._lock:
            room_key = f"{namespace}:{room}"

            if room_key in self.rooms:
                self.rooms[room_key].discard(client_id)
                if not self.rooms[room_key]:
                    del self.rooms[room_key]

            if client_id in self.client_rooms:
                self.client_rooms[client_id].discard(room_key)
                if not self.client_rooms[client_id]:
                    del self.client_rooms[client_id]

            ColorPrint.debug(f"Client {client_id} left room {room} in namespace {namespace}")
            return True

    def get_room_clients(self, room: str, namespace: str = 'default') -> List[str]:
        """
        Get all clients in a room

        Args:
            room: Room name
            namespace: Namespace name

        Returns:
            List of client IDs
        """
        with self._lock:
            room_key = f"{namespace}:{room}"
            room_set = self.rooms.get(room_key)
            return list(room_set) if room_set else []

    def get_client_rooms(self, client_id: str) -> List[str]:
        """
        Get all rooms a client is in

        Args:
            client_id: Client identifier

        Returns:
            List of room keys (namespace:room)
        """
        with self._lock:
            client_room_set = self.client_rooms.get(client_id)
            return list(client_room_set) if client_room_set else []

    def remove_client(self, client_id: str):
        """
        Remove client from all namespaces and rooms

        Args:
            client_id: Client identifier
        """
        with self._lock:
            # Remove from all namespaces
            if client_id in self.client_namespaces:
                for namespace in list(self.client_namespaces[client_id]):
                    self.leave_namespace(client_id, namespace)

            # Remove from all rooms
            if client_id in self.client_rooms:
                for room_key in list(self.client_rooms[client_id]):
                    namespace, room = room_key.split(':', 1)
                    self.leave_room(client_id, room, namespace)

            ColorPrint.debug(f"Client {client_id} removed from all namespaces and rooms")

    def get_stats(self) -> Dict:
        """
        Get namespace manager statistics

        Returns:
            Dictionary with statistics
        """
        with self._lock:
            return {
                'namespaces': len(self.namespaces),
                'rooms': len(self.rooms),
                'clients': len(self.client_namespaces)
            }

    def get_all_namespaces(self) -> List[str]:
        """
        Get all namespace names

        Returns:
            List of namespace names
        """
        with self._lock:
            return list(self.namespaces.keys())

    def get_all_rooms(self, namespace: Optional[str] = None) -> List[str]:
        """
        Get all room names, optionally filtered by namespace

        Args:
            namespace: Optional namespace filter

        Returns:
            List of room names
        """
        with self._lock:
            rooms = list(self.rooms.keys())
            if namespace:
                return [
                    key.split(':', 1)[1]
                    for key in rooms
                    if key.startswith(f"{namespace}:")
                ]
            return rooms

    def clear(self):
        """Clear all namespaces and rooms"""
        with self._lock:
            self.namespaces.clear()
            self.client_namespaces.clear()
            self.rooms.clear()
            self.client_rooms.clear()
            ColorPrint.debug("Namespace manager cleared")
