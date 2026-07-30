# -*- coding: utf-8 -*-
"""
Global Configuration - Shared configuration for Pycore Module Caller

Simple global state management for the HTTP API service.
"""

import os
import sys
import socket
import time
import copy
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import HTTP_BIND_HOST, PYCORE_HTTP_PORT


DEFAULT_HTTP_PORT = PYCORE_HTTP_PORT
DEFAULT_PYCORE_ROOT = Path(__file__).parent.parent


class GlobalConfig:
    """
    Global configuration object for Pycore Module Caller service.

    Manages service settings, network info, and runtime state.
    """

    def __init__(self):
        self._state = {
            'pycore_root': DEFAULT_PYCORE_ROOT,
            'http_port': DEFAULT_HTTP_PORT,
            'host': HTTP_BIND_HOST,
            'local_ip': None,
            'server_running': False,
            'api_enabled': True,
            'allow_file_import': True,
            'debug_mode': False,
            'call_history': [],
            'max_history_size': 100,
            'allowed_modules': [],
            'blocked_modules': [],
        }
        init_serialized_owner(
            self,
            'callmodule.global_config.state',
            'CallmoduleGlobalConfigStateThread',
        )

    @serialized_method
    def _get_value(self, name: str) -> Any:
        return copy.deepcopy(self._state[name])

    @serialized_method
    def _set_value(self, name: str, value: Any) -> None:
        self._state[name] = copy.deepcopy(value)

    pycore_root = property(
        lambda self: self._get_value('pycore_root'),
        lambda self, value: self._set_value('pycore_root', Path(value)),
    )
    http_port = property(
        lambda self: self._get_value('http_port'),
        lambda self, value: self._set_value('http_port', int(value)),
    )
    host = property(
        lambda self: self._get_value('host'),
        lambda self, value: self._set_value('host', str(value)),
    )
    local_ip = property(
        lambda self: self._get_value('local_ip'),
        lambda self, value: self._set_value('local_ip', value),
    )
    server_running = property(
        lambda self: self._get_value('server_running'),
        lambda self, value: self._set_value('server_running', bool(value)),
    )
    api_enabled = property(
        lambda self: self._get_value('api_enabled'),
        lambda self, value: self._set_value('api_enabled', bool(value)),
    )
    allow_file_import = property(
        lambda self: self._get_value('allow_file_import'),
        lambda self, value: self._set_value('allow_file_import', bool(value)),
    )
    debug_mode = property(
        lambda self: self._get_value('debug_mode'),
        lambda self, value: self._set_value('debug_mode', bool(value)),
    )
    call_history = property(
        lambda self: self._get_value('call_history'),
        lambda self, value: self._set_value('call_history', list(value)),
    )
    max_history_size = property(
        lambda self: self._get_value('max_history_size'),
        lambda self, value: self._set_value('max_history_size', int(value)),
    )
    allowed_modules = property(
        lambda self: self._get_value('allowed_modules'),
        lambda self, value: self._set_value('allowed_modules', list(value)),
    )
    blocked_modules = property(
        lambda self: self._get_value('blocked_modules'),
        lambda self, value: self._set_value('blocked_modules', list(value)),
    )

    @serialized_method
    def enable_api(self):
        """Enable API access"""
        self.api_enabled = True
        ColorPrint.green("[Config] API access enabled")

    @serialized_method
    def disable_api(self):
        """Disable API access"""
        self.api_enabled = False
        ColorPrint.yellow("[Config] API access disabled")

    @serialized_method
    def enable_debug(self):
        """Enable debug mode"""
        self.debug_mode = True
        ColorPrint.green("[Config] Debug mode enabled")

    @serialized_method
    def disable_debug(self):
        """Disable debug mode"""
        self.debug_mode = False
        ColorPrint.yellow("[Config] Debug mode disabled")

    @serialized_method
    def update_network_info(self):
        """Update local network information"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            self.local_ip = s.getsockname()[0]
            s.close()
        except:
            self.local_ip = "127.0.0.1"

    @serialized_method
    def add_call_history(self, module: str, function: str, success: bool, error: Optional[str] = None):
        """Add entry to call history"""
        entry = {
            'timestamp': time.time(),
            'module': module,
            'function': function,
            'success': success,
            'error': error
        }

        self._state['call_history'].append(entry)
        max_history_size = self._state['max_history_size']
        if len(self._state['call_history']) > max_history_size:
            self._state['call_history'] = self._state['call_history'][-max_history_size:]

    @serialized_method
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

    @serialized_method
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
            'blocked_modules': self.blocked_modules,
        }

    @serialized_method
    def configure(
        self,
        pycore_root: Optional[str],
        http_port: int,
        host: str,
        debug: bool,
    ) -> None:
        if pycore_root:
            self._state['pycore_root'] = Path(pycore_root)
        self._state['http_port'] = int(http_port)
        self._state['host'] = host
        self._state['debug_mode'] = bool(debug)
        self.update_network_info()

    @serialized_method
    def __repr__(self):
        api_status = "ENABLED" if self.api_enabled else "DISABLED"
        return f"<GlobalConfig port={self.http_port} api={api_status} debug={self.debug_mode}>"


global_config = GlobalConfig()
