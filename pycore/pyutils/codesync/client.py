# -*- coding: utf-8 -*-
"""
Code Sync Client - Receive code changes from server

Scans LAN for code sync servers (port 59000) and pulls the newest version of each
file across all configured/discovered dev-ends.

This module now holds only the CodeSyncClient lifecycle (start/stop, shutdown
handler, event emit), the LAN server scan, and file pull/overwrite + backup. The
single-peer sync middle layer lives in `.server_connection` (ServerConnection)
and the rotating sync logger lives in `.sync_logger` (SyncLogger).

Public API preserved: `CodeSyncClient` + `get_code_sync_client` are re-exported
here so `from .client import CodeSyncClient, get_code_sync_client` keeps working.

Stdlib only: HTTP via `.runtime.http` (urllib), logging / events / shutdown /
paths via `.runtime` (no pycore import, no third_party).
"""

import os
import time
import threading
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict

from .runtime import (
    log as ColorPrint,
    http as requests,
    emit_event,
    is_shutdown_requested,
    register_shutdown_handler,
    get_app_data_dir,
    get_core_node_root,
    get_local_lan_ip,
)

from .server_connection import ServerConnection
from .sync_logger import SyncLogger


class CodeSyncClient:
    """
    Code Synchronization Client - Multi-server support

    Features:
    - Scan LAN for code sync servers (port 59000)
    - Connect to multiple servers simultaneously
    - Receive code changes from all connected servers
    - Auto-reconnect with client ID preservation
    """

    def __init__(self, target_dir: str = None, scan_interval: int = 5, enable_backup: bool = True):
        """
        Initialize code sync client

        Args:
            target_dir: Target directory for synced files (defaults to the core_node root)
            scan_interval: Server scan interval in seconds
            enable_backup: Whether to backup files before overwriting
        """
        # Default to the core_node repo root if not provided.
        if target_dir is None:
            target_dir = str(get_core_node_root())

        self.target_dir = Path(target_dir)
        self.scan_interval = scan_interval
        self.enable_backup = enable_backup

        # Client ID (persistent across reconnects)
        self.client_id = self._generate_client_id()

        # Multi-server connections
        self.servers: Dict[str, ServerConnection] = {}  # {host: ServerConnection}
        self.server_port: int = 59000

        # Client state
        self.running = False
        self.scan_thread: Optional[threading.Thread] = None

        # Rotating sync logger (recent activity ring + on-disk log files).
        self.logs_dir = get_app_data_dir() / 'code_sync_logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.logger = SyncLogger(self.logs_dir)

        # Backup directory (in external app data dir)
        self.backup_dir = get_app_data_dir() / 'code_sync_backups'
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        ColorPrint.green(f"[CodeSync Client] Initialized with target: {self.target_dir}")
        ColorPrint.blue(f"[CodeSync Client] Client ID: {self.client_id}")
        ColorPrint.blue(f"[CodeSync Client] Backup enabled: {self.enable_backup}")
        ColorPrint.blue(f"[CodeSync Client] Backup dir: {self.backup_dir}")
        ColorPrint.blue(f"[CodeSync Client] Logs dir: {self.logs_dir}")

    def start(self):
        """Start code sync client"""
        if self.running:
            ColorPrint.yellow("[CodeSync Client] Already running")
            return

        self.running = True

        # Start server scanner thread
        self.scan_thread = threading.Thread(
            target=self._scan_loop,
            daemon=True,
            name="CodeSync-ClientScanner"
        )
        self.scan_thread.start()

        # Register shutdown handler (priority=70 for service threads).
        register_shutdown_handler(self.stop, priority=70, name="code_sync_client")
        ColorPrint.blue("[CodeSync Client] Registered shutdown handler (priority=70)")

        # Trigger client started event (UI / bus; no-op standalone).
        emit_event('code_sync.client.started', {
            'target_dir': str(self.target_dir),
            'client_id': self.client_id,
            'backup_enabled': self.enable_backup
        }, async_mode=True)

        ColorPrint.green("[CodeSync Client] Started")

    def stop(self):
        """Stop code sync client (also called by the shutdown handler)."""
        if not self.running:
            return

        self.running = False

        # Stop all server connections
        for host, server in list(self.servers.items()):
            server.stop()

        if self.scan_thread:
            self.scan_thread.join(timeout=2.0)

        # Trigger client stopped event (UI / bus; no-op standalone).
        emit_event('code_sync.client.stopped', {
            'servers_count': len(self.servers)
        }, async_mode=True)

        ColorPrint.yellow("[CodeSync Client] Stopped")

    def _generate_client_id(self) -> str:
        """Generate unique client ID"""
        import uuid
        import platform

        hostname = platform.node()
        mac = uuid.getnode()

        return f"{hostname}_{mac}_{int(time.time())}"

    def _scan_loop(self):
        """Server scanner loop (honours the global shutdown flag)."""
        ColorPrint.green("[CodeSync Client] Server scanner started")

        # Initial scan
        self._scan_for_servers()

        # Periodic re-scan for new servers
        while self.running:
            # Check if global shutdown was requested
            if is_shutdown_requested():
                ColorPrint.yellow("[CodeSync Client] Shutdown detected, stopping scanner...")
                break

            try:
                time.sleep(30)  # Re-scan every 30 seconds for new servers

                if not self.running or is_shutdown_requested():
                    break

                self._scan_for_servers()

            except Exception as e:
                ColorPrint.red(f"[CodeSync Client] Error in scan loop: {e}")

        ColorPrint.yellow("[CodeSync Client] Server scanner stopped")

    def _scan_for_servers(self):
        """Scan LAN for code sync servers and connect to all"""
        ColorPrint.blue("[CodeSync Client] Scanning for code sync servers...")

        # Get local network segment (reuses runtime's hook-aware LAN IP helper,
        # which falls back to the UDP-connect-to-8.8.8.8 trick then "127.0.0.1").
        local_ip = get_local_lan_ip()
        if not local_ip or local_ip == "127.0.0.1":
            ColorPrint.yellow("[CodeSync Client] Cannot determine local IP")
            return

        # Extract network segment (e.g., 192.168.1)
        segments = local_ip.split('.')
        network_prefix = '.'.join(segments[:3])

        ColorPrint.blue(f"[CodeSync Client] Scanning network: {network_prefix}.0/24")

        # Scan common IPs in parallel
        found_servers = []

        def check_host(ip: str):
            try:
                # Try to connect to code-sync endpoint
                url = f"http://{ip}:{self.server_port}/code-sync/ping"
                response = requests.get(url, timeout=1)

                if response.status_code == 200:
                    found_servers.append(ip)
                    ColorPrint.green(f"[CodeSync Client] Found server: {ip}")

            except Exception:
                pass

        # Scan 1-254
        threads = []
        for i in range(1, 255):
            ip = f"{network_prefix}.{i}"

            # Skip local IP
            if ip == local_ip:
                continue

            thread = threading.Thread(target=check_host, args=(ip,), daemon=True)
            threads.append(thread)
            thread.start()

        # Wait for all threads (max 5 seconds)
        start_time = time.time()
        for thread in threads:
            remaining_time = max(0, 5 - (time.time() - start_time))
            thread.join(timeout=remaining_time)

        # Connect to ALL found servers
        if found_servers:
            ColorPrint.green(f"[CodeSync Client] Found {len(found_servers)} server(s)")

            for server_host in found_servers:
                # Skip if already connected to this server
                if server_host in self.servers:
                    ColorPrint.blue(f"[CodeSync Client] Already connected to {server_host}")
                    continue

                # Create and start new server connection
                server_conn = ServerConnection(
                    host=server_host,
                    port=self.server_port,
                    client_id=self.client_id,
                    client=self
                )
                self.servers[server_host] = server_conn
                server_conn.start()

        else:
            ColorPrint.yellow("[CodeSync Client] No code sync servers found")

    def add_server(self, host: str, port: int = None):
        """
        Explicitly connect to a code-sync server (a configured dev-end peer).

        Used by the manager to point the client at the dev peers from the committed
        peer config, in addition to any LAN-discovered servers. Idempotent.
        """
        if not host:
            return
        port = port or self.server_port
        if host in self.servers:
            return
        server_conn = ServerConnection(
            host=host, port=port, client_id=self.client_id, client=self)
        self.servers[host] = server_conn
        if self.running:
            server_conn.start()
        ColorPrint.green(f"[CodeSync Client] Added configured dev-end server: {host}:{port}")

    def _backup_file(self, file_path: Path) -> bool:
        """
        Backup file before overwriting

        Args:
            file_path: File path to backup

        Returns:
            True if backup succeeded
        """
        if not self.enable_backup:
            return True

        # Get relative path to maintain directory structure
        rel_path = file_path.relative_to(self.target_dir)

        # Create backup path in dedicated backup directory
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = self.backup_dir / f"{rel_path}.backup_{timestamp}"

        # Create parent directories
        backup_path.parent.mkdir(parents=True, exist_ok=True)

        # Copy file to backup location
        shutil.copy2(file_path, backup_path)

        self.logger.add_log(
            'backup',
            str(rel_path),
            f'Backed up to backup dir',
            f'Size: {file_path.stat().st_size} bytes, Backup: {backup_path.name}'
        )

        ColorPrint.green(f"[CodeSync Client] Backed up: {rel_path} -> {backup_path}")
        return True

    def _write_file(self, file_path: Path, content: bytes, mtime: float) -> bool:
        """
        Write file content and set modification time

        Args:
            file_path: Target file path
            content: File content
            mtime: Modification time to set

        Returns:
            True if write succeeded
        """
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Canonicalize text line endings to LF (binary untouched) so a Windows
        # dev's CRLF files don't break shell scripts or diverge from git's blobs
        # on a Linux client. Loop-safe: this path skips by mtime, not hash.
        from .textnorm import normalize_eol
        content = normalize_eol(content)

        with open(file_path, 'wb') as f:
            f.write(content)

        os.utime(file_path, (mtime, mtime))
        return True

    def _process_file_for_server(self, server_conn: 'ServerConnection', file_info: Dict, is_initial: bool = False) -> str:
        """
        Process received file from a specific server - download and update if needed

        Args:
            server_conn: ServerConnection instance that owns this file operation
            file_info: File information dict
            is_initial: Whether this is initial sync

        Returns:
            'received', 'skipped', or 'failed'
        """
        rel_path = file_info['relative_path']
        server_mtime = file_info['mtime']
        server_hash = file_info['hash']
        server_size = file_info.get('size', 0)

        target_path = self.target_dir / rel_path

        # Check if file exists locally
        if target_path.exists():
            local_stat = target_path.stat()
            local_mtime = local_stat.st_mtime

            # Compare modification times - skip if server is older or same
            if server_mtime > local_mtime:
                # Server version is newer - need to update (WOULD OVERWRITE)
                server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
                local_time = datetime.fromtimestamp(local_mtime).strftime('%Y-%m-%d %H:%M:%S')

                reason = f'Server newer: {server_time} > Local: {local_time}'
                ColorPrint.yellow(f"[CodeSync Client] [{server_conn.host}] WOULD OVERWRITE: {rel_path}")
                ColorPrint.yellow(f"  {reason}")

                # Download file content from this specific server
                content = server_conn._download_file(rel_path)
                if content is None:
                    error_reason = 'Failed to download file'
                    self.logger.add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    return 'failed'

                # Backup existing file
                if not self._backup_file(target_path):
                    error_reason = 'Backup failed, skipping update'
                    self.logger.add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    return 'failed'

                # Write new content
                if self._write_file(target_path, content, server_mtime):
                    self.logger.add_log(
                        'received',
                        f'[{server_conn.host}] {rel_path}',
                        reason,
                        f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                    )
                    result = 'received'
                else:
                    error_reason = 'Failed to write file'
                    self.logger.add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    result = 'failed'
            else:
                # Local version is newer or same - skip
                server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
                local_time = datetime.fromtimestamp(local_mtime).strftime('%Y-%m-%d %H:%M:%S')

                reason = f'Local newer/same: {local_time} >= {server_time}'
                self.logger.add_log('skipped', f'[{server_conn.host}] {rel_path}', reason)
                result = 'skipped'
        else:
            # File doesn't exist locally - create new
            server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
            reason = f'New file from server: {server_time}'

            # Download file content from this specific server
            content = server_conn._download_file(rel_path)
            if content is None:
                error_reason = 'Failed to download new file'
                self.logger.add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                return 'failed'

            # Write new file
            if self._write_file(target_path, content, server_mtime):
                self.logger.add_log(
                    'received',
                    f'[{server_conn.host}] {rel_path}',
                    reason,
                    f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                )
                result = 'received'
            else:
                error_reason = 'Failed to write new file'
                self.logger.add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                result = 'failed'

        # Track received file state on server connection
        if result == 'received':
            server_conn.received_file_states[rel_path] = (server_mtime, server_hash)

        return result

    def _add_to_server_failed_queue(self, server_conn: 'ServerConnection', file_info: Dict, reason: str):
        """
        Add file to server's failed queue

        Args:
            server_conn: ServerConnection instance
            file_info: File information dict
            reason: Failure reason
        """
        # Check if already in queue
        for item in server_conn.failed_files:
            if item.get('file_info', {}).get('relative_path') == file_info['relative_path']:
                return

        # Add to queue
        server_conn.failed_files.append({
            'file_info': file_info,
            'reason': reason,
            'retry_count': 0,
            'failed_at': datetime.now().isoformat()
        })

        ColorPrint.red(f"[ServerConnection] {server_conn.host} - Added to failed queue: {file_info['relative_path']}")

    def get_status(self) -> Dict:
        """Get client status with multi-server support"""
        # Get timezone information
        tz_offset = datetime.now(timezone.utc).astimezone().strftime('%z')
        tz_name = time.tzname[time.daylight]

        # Aggregate statistics from all servers
        total_received_files = 0
        total_received_count = 0
        total_skipped_count = 0
        total_failed_files = 0

        servers_status = []
        for host, server_conn in self.servers.items():
            server_info = server_conn.get_status()
            servers_status.append(server_info)

            total_received_files += server_info['received_file_count']
            total_received_count += server_info['received_count']
            total_skipped_count += server_info['skipped_count']
            total_failed_files += server_info['failed_files_count']

        return {
            'running': self.running,
            'client_id': self.client_id,
            'root_dir': str(self.target_dir),
            'target_dir': str(self.target_dir),
            'timezone': tz_name,
            'timezone_offset': tz_offset,
            'server_port': self.server_port,
            'scan_interval': self.scan_interval,
            'enable_backup': self.enable_backup,
            'logs': self.logger.recent_logs(),  # Return last 50 logs for UI

            # Multi-server statistics
            'servers_count': len(self.servers),
            'servers': servers_status,
            'total_received_files': total_received_files,
            'total_received_count': total_received_count,
            'total_skipped_count': total_skipped_count,
            'total_failed_files': total_failed_files
        }


# Global singleton
_code_sync_client: Optional[CodeSyncClient] = None
_client_lock = threading.Lock()


def get_code_sync_client() -> CodeSyncClient:
    """Get global code sync client instance"""
    global _code_sync_client

    if _code_sync_client is None:
        with _client_lock:
            if _code_sync_client is None:
                _code_sync_client = CodeSyncClient()

    return _code_sync_client
