# -*- coding: utf-8 -*-
"""
Code Sync Manager - Manages server/client mode switching

Coordinates between code sync server and client modes.
Only one mode can be active at a time.
"""

import threading
from typing import Optional, Literal

from pycore import ColorPrint

from .code_sync_server import CodeSyncServer, get_code_sync_server
from .code_sync_client import CodeSyncClient, get_code_sync_client


CodeSyncMode = Literal["disabled", "server", "client"]


class CodeSyncManager:
    """
    Code Sync Manager

    Manages switching between server and client modes.
    Ensures only one mode is active at a time.
    """

    def __init__(self):
        """Initialize code sync manager"""
        self.mode: CodeSyncMode = "disabled"
        self.mode_lock = threading.Lock()

        ColorPrint.green("[CodeSync Manager] Initialized")

    def get_mode(self) -> CodeSyncMode:
        """Get current mode"""
        return self.mode

    def is_server_mode(self) -> bool:
        """Check if in server mode"""
        return self.mode == "server"

    def is_client_mode(self) -> bool:
        """Check if in client mode"""
        return self.mode == "client"

    def set_server_mode(self):
        """Switch to server mode"""
        with self.mode_lock:
            # Stop any existing service
            self._stop_all()

            # Start server
            server = get_code_sync_server()
            server.start()

            self.mode = "server"
            ColorPrint.green("[CodeSync Manager] Switched to SERVER mode")

    def set_client_mode(self):
        """Switch to client mode"""
        with self.mode_lock:
            # Stop any existing service
            self._stop_all()

            # Start client
            client = get_code_sync_client()
            client.start()

            self.mode = "client"
            ColorPrint.green("[CodeSync Manager] Switched to CLIENT mode")

    def toggle_mode(self):
        """Toggle between server and client modes"""
        with self.mode_lock:
            if self.mode == "disabled":
                # Start as server
                self.set_server_mode()
            elif self.mode == "server":
                # Switch to client
                self.set_client_mode()
            elif self.mode == "client":
                # Disable
                self.stop()
            else:
                # Unknown state, start as server
                self.set_server_mode()

    def stop(self):
        """Stop both server and client"""
        with self.mode_lock:
            self._stop_all()
            self.mode = "disabled"
            ColorPrint.yellow("[CodeSync Manager] Stopped")

    def _stop_all(self):
        """Stop both server and client (internal)"""
        # Stop server
        try:
            server = get_code_sync_server()
            server.stop()
        except Exception as e:
            ColorPrint.yellow(f"[CodeSync Manager] Error stopping server: {e}")

        # Stop client
        try:
            client = get_code_sync_client()
            client.stop()
        except Exception as e:
            ColorPrint.yellow(f"[CodeSync Manager] Error stopping client: {e}")

    def get_server(self) -> Optional[CodeSyncServer]:
        """Get server instance (only if in server mode)"""
        if self.mode == "server":
            return get_code_sync_server()
        return None

    def get_client(self) -> Optional[CodeSyncClient]:
        """Get client instance (only if in client mode)"""
        if self.mode == "client":
            return get_code_sync_client()
        return None

    def get_status(self) -> dict:
        """Get detailed status"""
        status = {
            "mode": self.mode
        }

        if self.mode == "server":
            server = self.get_server()
            if server:
                status["server"] = server.get_status()

        elif self.mode == "client":
            client = self.get_client()
            if client:
                status["client"] = client.get_status()

        return status


# Global singleton
_code_sync_manager: Optional[CodeSyncManager] = None
_manager_lock = threading.Lock()


def get_code_sync_manager() -> CodeSyncManager:
    """Get global code sync manager instance"""
    global _code_sync_manager

    if _code_sync_manager is None:
        with _manager_lock:
            if _code_sync_manager is None:
                _code_sync_manager = CodeSyncManager()

    return _code_sync_manager
