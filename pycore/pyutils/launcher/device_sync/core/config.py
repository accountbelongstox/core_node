# -*- coding: utf-8 -*-
"""
Global Configuration - Shared configuration object for all device sync components

Simple global state management without complex dependencies.
"""

import os
import sys
import socket
import uuid
from pathlib import Path
from typing import Optional


# Default constants
DEFAULT_HTTP_PORT = 58923
DEFAULT_SYNC_INTERVAL = 5  # seconds
DEFAULT_ROOT_DIR = "../.."  # Default to parent's parent directory


def get_cache_dir() -> Path:
    """
    Get unified cache directory across platforms

    Windows: C:\\Users\\用户名\\.core_node\\.device_sync
    Linux: /var/_core_node/_device_sync
    """
    if sys.platform == 'win32':
        # Windows: Use user home directory
        cache_dir = Path.home() / '.core_node' / '.device_sync'
    else:
        # Linux/Unix: Use /var/_core_node
        cache_dir = Path('/var/_core_node/_device_sync')

    # Create directory if it doesn't exist
    cache_dir.mkdir(parents=True, exist_ok=True)

    return cache_dir


class GlobalConfig:
    """
    Global configuration object shared across all device sync components.

    This replaces the complex DeviceManager with a simple shared state.
    """

    def __init__(self):
        # Core settings
        self.isPrimaryServer: bool = False
        self.sync_enabled: bool = False

        # Network settings
        self.http_port: int = 58923
        self.local_ip: Optional[str] = None
        self.network_prefix: Optional[str] = None  # e.g., "192.168.50"
        self.gateway_ip: Optional[str] = None

        # Directory settings
        self.root_dir: Optional[Path] = None
        self.file_cache: list = []  # Cached file list

        # Device info
        self.device_id: Optional[str] = None
        self.hostname: Optional[str] = None

        # Runtime state
        self.server_running: bool = False
        self.client_running: bool = False

        # API access control
        self.api_enabled: bool = True  # API accessible by default

        # File scanning options
        self.scan_node_modules: bool = False  # Skip node_modules by default
        # .git is always scanned (never excluded)

        # Network devices
        self.online_devices: list = []  # All devices on network
        self.primary_servers: list = []  # PRIMARY servers on network

        # Primary server info (for clients to connect to)
        self.primary_server_ip: Optional[str] = None
        self.primary_server_port: int = 58923

        # Connected clients (for PRIMARY server)
        self.connected_clients: list = []  # List of currently connected clients

        # Scan statistics
        self.last_scan_time: Optional[float] = None  # Last file scan timestamp
        self.total_scans: int = 0  # Total number of scans performed

    def set_as_primary(self):
        """Set this device as PRIMARY server"""
        self.isPrimaryServer = True
        self.sync_enabled = False  # Primary doesn't sync, it serves
        print(f"[Config] Set as PRIMARY server")

    def set_as_secondary(self):
        """Set this device as SECONDARY (client)"""
        self.isPrimaryServer = False
        # sync_enabled is controlled separately
        print(f"[Config] Set as SECONDARY")

    def enable_sync(self):
        """Enable sync (only for SECONDARY)"""
        if self.isPrimaryServer:
            print("[Config] Cannot enable sync: This is PRIMARY server")
            return False

        self.sync_enabled = True
        print("[Config] Sync enabled")
        return True

    def disable_sync(self):
        """Disable sync"""
        self.sync_enabled = False
        print("[Config] Sync disabled")

    def enable_api(self):
        """Enable API access"""
        self.api_enabled = True
        print("[Config] API access enabled")

    def disable_api(self):
        """Disable API access"""
        self.api_enabled = False
        print("[Config] API access disabled")

    def update_network_info(self):
        """Update local network information"""
        # Get local IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            self.local_ip = s.getsockname()[0]
            s.close()

            # Extract network prefix (e.g., "192.168.50" from "192.168.50.88")
            if self.local_ip:
                parts = self.local_ip.split('.')
                if len(parts) == 4:
                    self.network_prefix = '.'.join(parts[:3])

        except:
            self.local_ip = "127.0.0.1"
            self.network_prefix = "127.0.0"

        # Try to get gateway IP
        self._detect_gateway()

    def _detect_gateway(self):
        """Detect gateway/router IP"""
        if not self.network_prefix:
            return

        # Usually gateway is .1 or .254
        for last_octet in [1, 254]:
            gateway = f"{self.network_prefix}.{last_octet}"
            try:
                # Try to connect to common router ports
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.3)
                result = s.connect_ex((gateway, 80))
                s.close()
                if result == 0:
                    self.gateway_ip = gateway
                    return
            except:
                pass

    def update_online_devices(self, devices: list):
        """Update list of online devices"""
        self.online_devices = devices

        # Filter PRIMARY servers
        self.primary_servers = [
            d for d in devices
            if d.get('mode') == 'primary'
        ]

    def get_primary_server(self):
        """Get PRIMARY server (first one if multiple)"""
        if self.primary_servers:
            return self.primary_servers[0]
        return None

    def has_multiple_primary_servers(self) -> bool:
        """Check if there are multiple PRIMARY servers (conflict)"""
        return len(self.primary_servers) > 1

    def _should_exclude_path(self, path: Path) -> bool:
        """
        Check if path should be excluded from scanning

        Args:
            path: Path to check

        Returns:
            True if should be excluded
        """
        path_str = str(path).replace('\\', '/')
        parts = path_str.split('/')

        # .git is NEVER excluded (always scanned)
        if '.git' in parts:
            return False

        # Define directories to exclude (when scan_node_modules is False)
        exclude_dirs = [
            'node_modules',
            '__pycache__',
            '.pytest_cache',
            '.mypy_cache',
            '.tox',
            'venv',
            '.venv',
            '.next',
            '.nuxt',
            'target',
            'vendor',
            # Flutter/Dart temporary files
            '.dart_tool',
            '.flutter-plugins',
            '.flutter-plugins-dependencies'
        ]

        # If scan_node_modules is False, exclude these directories
        if not self.scan_node_modules:
            for exclude_dir in exclude_dirs:
                if exclude_dir in parts:
                    return True

        return False

    def build_file_cache(self):
        """Build file cache for root directory"""
        import time

        if not self.root_dir or not self.root_dir.exists():
            return

        start_time = time.time()
        self.file_cache = []
        excluded_count = 0

        for file_path in self.root_dir.rglob('*'):
            if file_path.is_file():
                try:
                    # Check if path should be excluded
                    if self._should_exclude_path(file_path):
                        excluded_count += 1
                        continue

                    stat = file_path.stat()
                    rel_path = file_path.relative_to(self.root_dir)

                    self.file_cache.append({
                        'path': str(rel_path).replace('\\', '/'),
                        'size': stat.st_size,
                        'mtime': stat.st_mtime
                    })

                except Exception:
                    continue

        # Update scan statistics
        self.last_scan_time = time.time()
        self.total_scans += 1
        duration = self.last_scan_time - start_time

        print(f"[Config] File cache built: {len(self.file_cache)} files (excluded: {excluded_count}, took {duration:.2f}s)")

    def get_status(self) -> dict:
        """Get current configuration status"""
        import time
        from datetime import datetime

        return {
            'isPrimaryServer': self.isPrimaryServer,
            'sync_enabled': self.sync_enabled,
            'api_enabled': self.api_enabled,
            'scan_node_modules': self.scan_node_modules,
            'http_port': self.http_port,
            'local_ip': self.local_ip,
            'network_prefix': self.network_prefix,
            'gateway_ip': self.gateway_ip,
            'device_id': self.device_id,
            'hostname': self.hostname,
            'server_running': self.server_running,
            'client_running': self.client_running,
            'primary_server_ip': self.primary_server_ip,
            'root_dir': str(self.root_dir) if self.root_dir else None,
            'online_devices_count': len(self.online_devices),
            'online_devices': self.online_devices,
            'primary_servers_count': len(self.primary_servers),
            'file_cache_count': len(self.file_cache),
            'connected_clients_count': len(self.connected_clients),
            'connected_clients': self.connected_clients,
            'total_scans': self.total_scans,
            'last_scan_time': datetime.fromtimestamp(self.last_scan_time).strftime('%Y-%m-%d %H:%M:%S') if self.last_scan_time else None
        }

    def __repr__(self):
        mode = "PRIMARY" if self.isPrimaryServer else "SECONDARY"
        sync = "ON" if self.sync_enabled else "OFF"
        return f"<GlobalConfig mode={mode} sync={sync} port={self.http_port} ip={self.local_ip}>"


# Global singleton instance
_global_config: Optional[GlobalConfig] = None


def get_global_config() -> GlobalConfig:
    """Get or create global configuration singleton"""
    global _global_config
    if _global_config is None:
        _global_config = GlobalConfig()
    return _global_config


def init_global_config(root_dir: str, http_port: int = 58923) -> GlobalConfig:
    """
    Initialize global configuration.

    Args:
        root_dir: Root directory for file sync
        http_port: HTTP server port

    Returns:
        GlobalConfig instance
    """
    global _global_config

    if _global_config is None:
        _global_config = GlobalConfig()

    _global_config.root_dir = Path(root_dir)
    _global_config.http_port = http_port

    # Get hostname
    _global_config.hostname = socket.gethostname()

    # Get device ID from unified cache directory
    cache_dir = get_cache_dir()
    device_id_file = cache_dir / 'device_id.txt'
    if device_id_file.exists():
        _global_config.device_id = device_id_file.read_text().strip()
    else:
        _global_config.device_id = str(uuid.uuid4())
        device_id_file.write_text(_global_config.device_id)

    # Update network information
    _global_config.update_network_info()

    print(f"[Config] Initialized: {_global_config}")
    print(f"[Config] Network: {_global_config.network_prefix}.x (Gateway: {_global_config.gateway_ip})")

    return _global_config
