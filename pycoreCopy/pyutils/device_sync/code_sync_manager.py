# -*- coding: utf-8 -*-
"""
Code Sync Manager - Manages server/client mode switching

Coordinates between code sync server and client modes.
Only one mode can be active at a time.
"""

import json
import threading
from pathlib import Path
from typing import Optional, Literal

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import get_app_config_dir

from .code_sync_server import CodeSyncServer, get_code_sync_server
from .code_sync_client import CodeSyncClient, get_code_sync_client


CodeSyncMode = Literal["disabled", "server", "client"]

# Config file for persisting mode
CONFIG_FILE = get_app_config_dir() / "code_sync_mode.json"


class CodeSyncManager:
    """
    Code Sync Manager

    Manages switching between server and client modes.
    Ensures only one mode is active at a time.
    """

    def __init__(self):
        """Initialize code sync manager"""
        self.mode_lock = threading.Lock()

        # Load saved mode from config file
        self.mode: CodeSyncMode = self._load_mode()

        # Auto-start if mode is not disabled
        if self.mode == "server":
            server = get_code_sync_server()
            server.start()
            ColorPrint.green("[CodeSync Manager] Auto-started in SERVER mode")
        elif self.mode == "client":
            client = get_code_sync_client()
            client.start()
            ColorPrint.green("[CodeSync Manager] Auto-started in CLIENT mode")
        else:
            ColorPrint.green("[CodeSync Manager] Initialized in DISABLED mode")

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
            self._save_mode()
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
            self._save_mode()
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
            self._save_mode()
            ColorPrint.yellow("[CodeSync Manager] Stopped")

    def _load_mode(self) -> CodeSyncMode:
        """
        Load saved mode from config file

        Returns:
            CodeSyncMode: Saved mode or "disabled" if not found
        """
        if not CONFIG_FILE.exists():
            return "disabled"

        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            mode = config.get('mode', 'disabled')

            if mode not in ['disabled', 'server', 'client']:
                ColorPrint.yellow(f"[CodeSync Manager] Invalid mode in config: {mode}, using disabled")
                return "disabled"

            ColorPrint.blue(f"[CodeSync Manager] Loaded mode from config: {mode}")
            return mode

    def _save_mode(self):
        """Save current mode to config file"""
        config = {'mode': self.mode}

        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)

        ColorPrint.blue(f"[CodeSync Manager] Saved mode to config: {self.mode}")

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
