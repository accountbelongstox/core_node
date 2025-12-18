# -*- coding: utf-8 -*-
"""
Global Configuration - Shared configuration for Pycore Module Caller

Simple global state management for the HTTP API service.
"""

import os
import sys
import socket
import time
from pathlib import Path
from typing import Optional


DEFAULT_HTTP_PORT = 59000
DEFAULT_PYCORE_ROOT = Path(__file__).parent.parent


class GlobalConfig:
    """
    Global configuration object for Pycore Module Caller service.

    Manages service settings, network info, and runtime state.
    """

    def __init__(self):
        # Core settings
        self.pycore_root: Path = DEFAULT_PYCORE_ROOT
        self.http_port: int = DEFAULT_HTTP_PORT

        # Network settings
        self.host: str = '0.0.0.0'  # Listen on all interfaces for network access
        self.local_ip: Optional[str] = None

        # Runtime state
        self.server_running: bool = False

        # API access control
        self.api_enabled: bool = True
        self.allow_file_import: bool = True
        self.debug_mode: bool = False

        # Module call history
        self.call_history: list = []
        self.max_history_size: int = 100

        # Security
        self.allowed_modules: list = []  # Empty = allow all
        self.blocked_modules: list = []  # Modules to explicitly block

    def enable_api(self):
        """Enable API access"""
        self.api_enabled = True
        print("[Config] API access enabled")

    def disable_api(self):
        """Disable API access"""
        self.api_enabled = False
        print("[Config] API access disabled")

    def enable_debug(self):
        """Enable debug mode"""
        self.debug_mode = True
        print("[Config] Debug mode enabled")

    def disable_debug(self):
        """Disable debug mode"""
        self.debug_mode = False
        print("[Config] Debug mode disabled")

    def update_network_info(self):
        """Update local network information"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            self.local_ip = s.getsockname()[0]
            s.close()
        except:
            self.local_ip = "127.0.0.1"

    def add_call_history(self, module: str, function: str, success: bool, error: Optional[str] = None):
        """Add entry to call history"""
        entry = {
            'timestamp': time.time(),
            'module': module,
            'function': function,
            'success': success,
            'error': error
        }

        self.call_history.append(entry)

        # Limit history size
        if len(self.call_history) > self.max_history_size:
            self.call_history = self.call_history[-self.max_history_size:]

    def is_module_allowed(self, module_path: str) -> tuple[bool, str]:
        """
        Check if module is allowed to be called

        Returns:
            (allowed: bool, reason: str)
        """
        # Check blocked list first
        for blocked in self.blocked_modules:
            if module_path.startswith(blocked):
                return False, f"Module '{module_path}' is blocked"

        # If allowed_modules is empty, allow all (except blocked)
        if not self.allowed_modules:
            return True, "All modules allowed"

        # Check allowed list
        for allowed in self.allowed_modules:
            if module_path.startswith(allowed):
                return True, f"Module matches allowed pattern '{allowed}'"

        return False, f"Module '{module_path}' not in allowed list"

    def get_status(self) -> dict:
        """Get current configuration status"""
        return {
            'pycore_root': str(self.pycore_root),
            'http_port': self.http_port,
            'host': self.host,
            'local_ip': self.local_ip,
            'server_running': self.server_running,
            'api_enabled': self.api_enabled,
            'allow_file_import': self.allow_file_import,
            'debug_mode': self.debug_mode,
            'call_history_count': len(self.call_history),
            'allowed_modules': self.allowed_modules,
            'blocked_modules': self.blocked_modules
        }

    def __repr__(self):
        api_status = "ENABLED" if self.api_enabled else "DISABLED"
        return f"<GlobalConfig port={self.http_port} api={api_status} debug={self.debug_mode}>"


# Global singleton instance
_global_config: Optional[GlobalConfig] = None


def get_global_config() -> GlobalConfig:
    """Get or create global configuration singleton"""
    global _global_config
    if _global_config is None:
        _global_config = GlobalConfig()
    return _global_config


def init_global_config(
    pycore_root: Optional[str] = None,
    http_port: int = DEFAULT_HTTP_PORT,
    host: str = '0.0.0.0',
    debug: bool = False
) -> GlobalConfig:
    """
    Initialize global configuration.

    Args:
        pycore_root: Root directory of pycore (default: auto-detect)
        http_port: HTTP server port
        host: Host to bind to ('0.0.0.0' for all interfaces)
        debug: Enable debug mode

    Returns:
        GlobalConfig instance
    """
    global _global_config

    if _global_config is None:
        _global_config = GlobalConfig()

    if pycore_root:
        _global_config.pycore_root = Path(pycore_root)

    _global_config.http_port = http_port
    _global_config.host = host
    _global_config.debug_mode = debug

    # Update network information
    _global_config.update_network_info()

    print(f"[Config] Initialized: {_global_config}")
    print(f"[Config] Pycore Root: {_global_config.pycore_root}")
    print(f"[Config] Server will listen on {_global_config.host}:{_global_config.http_port}")

    return _global_config
