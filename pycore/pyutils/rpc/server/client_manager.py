#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Client Manager - Manages client connections and metadata

Handles client metadata tracking, connection management,
and client table operations.
"""

import time
from typing import Dict, Optional, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

WebSocketResponse = aiohttp.web_ws.WebSocketResponse


class ClientManager:
    """
    Client Manager - Manages client connections and metadata
    
    Tracks client metadata, manages WebSocket connections,
    and handles client table operations.
    """
    
    def __init__(self, debug: bool = False):
        """
        Initialize Client Manager
        
        Args:
            debug: Enable debug logging
        """
        self.debug = debug
        
        # WebSocket clients (global client table)
        self.ws_clients: Dict[str, WebSocketResponse] = {}
        self.client_metadata: Dict[str, Dict[str, Any]] = {}  # Client metadata (last_active, etc.)
        
        # HTTP clients (session-based)
        self.http_sessions: Dict[str, Dict[str, Any]] = {}
    
    def update_client_metadata(self, client_id: str, client_type: str, remote_addr: Optional[str]):
        """
        Update client metadata (for client table management)
        
        Args:
            client_id: Client ID
            client_type: Client type
            remote_addr: Remote address
        """
        if client_id not in self.client_metadata:
            self.client_metadata[client_id] = {
                'client_type': client_type,
                'created_at': time.time(),
                'last_active': time.time(),
                'remote_addr': remote_addr,
                'request_count': 0
            }
        else:
            self.client_metadata[client_id]['last_active'] = time.time()
            self.client_metadata[client_id]['request_count'] += 1
    
    def register_websocket_client(self, client_id: str, ws: WebSocketResponse, remote_addr: Optional[str] = None):
        """
        Register WebSocket client
        
        Args:
            client_id: Client ID
            ws: WebSocket connection
            remote_addr: Remote address
        """
        self.ws_clients[client_id] = ws
        self.update_client_metadata(client_id, 'websocket', remote_addr)
        
        if self.debug:
            ColorPrint.green(f"[ClientManager] WebSocket client registered: {client_id}")
    
    def unregister_websocket_client(self, client_id: str):
        """
        Unregister WebSocket client
        
        Args:
            client_id: Client ID
        """
        self.ws_clients.pop(client_id, None)
        self.client_metadata.pop(client_id, None)
        
        if self.debug:
            ColorPrint.blue(f"[ClientManager] WebSocket client unregistered: {client_id}")
    
    def get_websocket_client(self, client_id: str) -> Optional[WebSocketResponse]:
        """
        Get WebSocket client by ID
        
        Args:
            client_id: Client ID
            
        Returns:
            WebSocket connection or None
        """
        return self.ws_clients.get(client_id)
    
    def is_websocket_connected(self, client_id: str) -> bool:
        """
        Check if WebSocket client is connected
        
        Args:
            client_id: Client ID
            
        Returns:
            True if connected
        """
        ws = self.ws_clients.get(client_id)
        return ws is not None and not ws.closed
    
    def get_client_count(self) -> Dict[str, int]:
        """
        Get client count statistics
        
        Returns:
            Dictionary with client counts
        """
        return {
            'websocket': len(self.ws_clients),
            'http_sessions': len(self.http_sessions),
            'total_metadata': len(self.client_metadata)
        }
    
    def cleanup_inactive_clients(self, max_inactive_time: float = 3600.0) -> int:
        """
        Clean up inactive clients
        
        Args:
            max_inactive_time: Maximum inactive time in seconds
            
        Returns:
            Number of clients cleaned up
        """
        now = time.time()
        cleaned = 0
        inactive_clients = []
        
        for client_id, metadata in self.client_metadata.items():
            if now - metadata['last_active'] > max_inactive_time:
                inactive_clients.append(client_id)
        
        for client_id in inactive_clients:
            if metadata['client_type'] == 'websocket':
                self.unregister_websocket_client(client_id)
            else:
                self.client_metadata.pop(client_id, None)
                self.http_sessions.pop(client_id, None)
            cleaned += 1
        
        if self.debug and cleaned > 0:
            ColorPrint.blue(f"[ClientManager] Cleaned up {cleaned} inactive clients")
        
        return cleaned

__all__ = ['ClientManager']

