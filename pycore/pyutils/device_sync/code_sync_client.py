# -*- coding: utf-8 -*-
"""
Code Sync Client - Receive code changes from server

Scans LAN for code sync servers (port 59000).
Receives code changes and prompts for overwrite (test mode).
"""

import os
import json
import time
import socket
import threading
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import get_app_data_dir, CORE_NODE_ROOT
from pycore.pyfoundations.third_party import get_third_package_requests

# Get requests via third_party manager
requests = get_third_package_requests()


class ServerConnection:
    """
    Server Connection - Middle layer for single server connection

    Encapsulates all logic for connecting to and syncing with a single code sync server.
    This allows the main client to manage multiple server connections.
    """

    def __init__(self, host: str, port: int, client_id: str, client: 'CodeSyncClient'):
        """
        Initialize server connection

        Args:
            host: Server host/IP
            port: Server port
            client_id: Client identifier
            client: Parent CodeSyncClient instance (for shared resources)
        """
        self.host = host
        self.port = port
        self.client_id = client_id
        self.client = client  # Reference to parent client for shared resources

        # Connection state
        self.connected = False
        self.is_initial_sync_done = False

        # File state tracking (for this server only)
        self.received_file_states: Dict[str, Tuple[float, str]] = {}  # path -> (mtime, hash)

        # Statistics (for this server)
        self.received_count = 0
        self.skipped_count = 0

        # Failed files queue (for this server)
        self.failed_files: List[Dict] = []

        # Sync thread (for this server)
        self.sync_thread: Optional[threading.Thread] = None
        self.running = False

    def start(self):
        """Start syncing with this server"""
        if self.running:
            return

        self.running = True

        # Register with server
        if self._register():
            # Start sync thread
            self.sync_thread = threading.Thread(
                target=self._sync_loop,
                daemon=True,
                name=f"CodeSync-{self.host}"
            )
            self.sync_thread.start()
            ColorPrint.green(f"[ServerConnection] Started sync with {self.host}:{self.port}")

    def stop(self):
        """Stop syncing with this server"""
        self.running = False
        self.connected = False

        if self.sync_thread:
            self.sync_thread.join(timeout=2)

        ColorPrint.yellow(f"[ServerConnection] Stopped sync with {self.host}:{self.port}")

    def _register(self) -> bool:
        """
        Register with server

        Returns:
            True if registration succeeded
        """
        try:
            url = f"http://{self.host}:{self.port}/code-sync/register"
            response = requests.post(url, json={'client_id': self.client_id}, timeout=5)

            if response.status_code == 200:
                data = response.json()
                self.connected = True

                if data.get('needs_initial_sync'):
                    ColorPrint.blue(f"[ServerConnection] {self.host} - Needs initial sync")
                    self._do_initial_sync()
                else:
                    ColorPrint.blue(f"[ServerConnection] {self.host} - Registered (already synced)")
                    self.is_initial_sync_done = True

                return True
            else:
                ColorPrint.red(f"[ServerConnection] {self.host} - Registration failed: {response.status_code}")
                return False

        except Exception as e:
            ColorPrint.red(f"[ServerConnection] {self.host} - Error registering: {e}")
            return False

    def _do_initial_sync(self):
        """Perform initial full sync from this server"""
        ColorPrint.blue(f"[ServerConnection] {self.host} - Starting initial sync...")

        try:
            url = f"http://{self.host}:{self.port}/code-sync/initial-sync"
            response = requests.post(url, json={'client_id': self.client_id}, timeout=30)

            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])

                ColorPrint.green(f"[ServerConnection] {self.host} - Received {len(files)} files for initial sync")

                # Process files
                received = 0
                skipped = 0
                for file_info in files:
                    result = self._process_file(file_info, is_initial=True)
                    if result == 'received':
                        received += 1
                    elif result == 'skipped':
                        skipped += 1

                # Update statistics
                self.received_count += received
                self.skipped_count += skipped
                self.is_initial_sync_done = True

                ColorPrint.green(
                    f"[ServerConnection] {self.host} - Initial sync complete: "
                    f"{received} received, {skipped} skipped"
                )

            else:
                ColorPrint.red(f"[ServerConnection] {self.host} - Initial sync failed: {response.status_code}")

        except Exception as e:
            ColorPrint.red(f"[ServerConnection] {self.host} - Error in initial sync: {e}")

    def _sync_loop(self):
        """Sync loop for this server"""
        while self.running:
            if self.connected:
                self._sync_changes()

            time.sleep(self.client.scan_interval)

    def _sync_changes(self):
        """Sync changed files from this server"""
        try:
            # Retry failed files first
            if self.failed_files:
                self._retry_failed_files()

            # Prepare request with statistics
            request_data = {
                'client_id': self.client_id,
                'received_count': self.received_count,
                'skipped_count': self.skipped_count
            }

            # Reset statistics
            self.received_count = 0
            self.skipped_count = 0

            url = f"http://{self.host}:{self.port}/code-sync/changes"
            response = requests.post(url, json=request_data, timeout=10)

            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])

                if files:
                    ColorPrint.blue(f"[ServerConnection] {self.host} - Received {len(files)} changed files")

                    # Process files
                    received = 0
                    skipped = 0
                    for file_info in files:
                        result = self._process_file(file_info, is_initial=False)
                        if result == 'received':
                            received += 1
                        elif result == 'skipped':
                            skipped += 1

                    # Update statistics
                    self.received_count = received
                    self.skipped_count = skipped

                    ColorPrint.green(
                        f"[ServerConnection] {self.host} - Sync complete: "
                        f"{received} received, {skipped} skipped"
                    )

            elif response.status_code == 404:
                # Not registered, re-register
                ColorPrint.yellow(f"[ServerConnection] {self.host} - Not registered, re-registering...")
                self._register()

            else:
                ColorPrint.red(f"[ServerConnection] {self.host} - Sync failed: {response.status_code}")
                self.connected = False

        except Exception as e:
            ColorPrint.red(f"[ServerConnection] {self.host} - Error syncing: {e}")
            self.connected = False

    def _retry_failed_files(self):
        """Retry downloading failed files"""
        if not self.failed_files:
            return

        ColorPrint.blue(f"[ServerConnection] {self.host} - Retrying {len(self.failed_files)} failed files...")

        succeeded = []
        for i, failed_entry in enumerate(self.failed_files):
            file_info = failed_entry['file_info']
            retry_count = failed_entry.get('retry_count', 0)
            rel_path = file_info['relative_path']

            ColorPrint.yellow(
                f"[ServerConnection] {self.host} - Retry {i+1}/{len(self.failed_files)}: "
                f"{rel_path} (attempt #{retry_count})"
            )

            result = self._process_file(file_info, is_initial=False)

            if result == 'received':
                succeeded.append(failed_entry)
                ColorPrint.green(f"[ServerConnection] {self.host} - Retry succeeded: {rel_path}")
            elif result == 'failed':
                failed_entry['retry_count'] = retry_count + 1

        # Remove succeeded files from failed queue
        for entry in succeeded:
            self.failed_files.remove(entry)

        if succeeded:
            ColorPrint.green(
                f"[ServerConnection] {self.host} - Retry complete: "
                f"{len(succeeded)}/{len(self.failed_files) + len(succeeded)} succeeded"
            )

    def _process_file(self, file_info: Dict, is_initial: bool = False) -> str:
        """
        Process received file - delegate to parent client for actual file operations

        Args:
            file_info: File information dict
            is_initial: Whether this is initial sync

        Returns:
            'received', 'skipped', or 'failed'
        """
        # Delegate to parent client which handles actual file operations
        return self.client._process_file_for_server(self, file_info, is_initial)

    def _download_file(self, rel_path: str) -> Optional[bytes]:
        """
        Download file content from this server

        Args:
            rel_path: Relative file path

        Returns:
            File content bytes or None
        """
        max_retries = 3
        retry_delay = 1.0

        for attempt in range(max_retries):
            try:
                url = f"http://{self.host}:{self.port}/code-sync/download"
                response = requests.post(
                    url,
                    json={'client_id': self.client_id, 'file_path': rel_path},
                    timeout=30
                )

                if response.status_code == 200:
                    return response.content

                ColorPrint.red(f"[ServerConnection] {self.host} - Download failed: {response.status_code}")
                return None

            except Exception as e:
                if attempt < max_retries - 1:
                    ColorPrint.yellow(
                        f"[ServerConnection] {self.host} - Download error "
                        f"(attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s..."
                    )
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    ColorPrint.red(
                        f"[ServerConnection] {self.host} - Download failed after "
                        f"{max_retries} attempts: {e}"
                    )
                    return None

        return None

    def get_status(self) -> Dict:
        """Get status of this server connection"""
        return {
            'host': self.host,
            'port': self.port,
            'connected': self.connected,
            'initial_sync_done': self.is_initial_sync_done,
            'received_file_count': len(self.received_file_states),
            'received_count': self.received_count,
            'skipped_count': self.skipped_count,
            'failed_files_count': len(self.failed_files)
        }


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
            target_dir: Target directory for synced files (defaults to CORE_NODE_ROOT)
            scan_interval: Server scan interval in seconds
            enable_backup: Whether to backup files before overwriting
        """
        # Use CORE_NODE_ROOT from system_paths if not provided
        if target_dir is None:
            target_dir = str(CORE_NODE_ROOT)

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

        # Sync logs (recent activity - shared across all servers)
        self.sync_logs: List[Dict] = []  # Recent logs for UI display
        self.max_logs = 50  # Keep last 50 logs in memory for UI
        self.max_logs_per_file = 20000  # Max 20000 logs per file

        # Log file path
        self.logs_dir = get_app_data_dir() / 'code_sync_logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        # Backup directory (in external app data dir)
        self.backup_dir = get_app_data_dir() / 'code_sync_backups'
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        # Current log file tracking
        self.current_log_file = None
        self.current_log_line_count = 0
        self._init_log_file()

        ColorPrint.green(f"[CodeSync Client] Initialized with target: {self.target_dir}")
        ColorPrint.blue(f"[CodeSync Client] Client ID: {self.client_id}")
        ColorPrint.blue(f"[CodeSync Client] Backup enabled: {self.enable_backup}")
        ColorPrint.blue(f"[CodeSync Client] Backup dir: {self.backup_dir}")
        ColorPrint.blue(f"[CodeSync Client] Logs dir: {self.logs_dir}")

    def _init_log_file(self):
        """Initialize current log file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.current_log_file = self.logs_dir / f'sync_logs_{timestamp}.log'
        self.current_log_line_count = 0
        ColorPrint.blue(f"[CodeSync Client] Log file: {self.current_log_file.name}")

    def _write_log_line(self, log_line: str):
        """Write a log line to file"""
        # Check if need to rotate
        if self.current_log_line_count >= self.max_logs_per_file:
            self._init_log_file()

        # Append to log file
        with open(self.current_log_file, 'a', encoding='utf-8') as f:
            f.write(log_line + '\n')

        self.current_log_line_count += 1


    def _add_log(self, action: str, file_path: str, reason: str, details: str = ""):
        """
        Add a log entry

        Args:
            action: Action type ('received', 'skipped', 'backup', 'error')
            file_path: File path
            reason: Reason for the action
            details: Additional details
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Create log entry for memory (UI display)
        log_entry = {
            'timestamp': timestamp,
            'action': action,
            'file': file_path,
            'reason': reason,
            'details': details
        }

        # Add to memory (keep last N for UI)
        self.sync_logs.append(log_entry)
        if len(self.sync_logs) > self.max_logs:
            self.sync_logs = self.sync_logs[-self.max_logs:]

        # Write to log file (simple text format)
        log_line = f"[{timestamp}] {action.upper()}: {file_path} - {reason}"
        if details:
            log_line += f" | {details}"
        self._write_log_line(log_line)

        # Print to console
        ColorPrint.blue(f"[{timestamp.split()[1]}] {action.upper()}: {file_path} - {reason}")
        if details:
            ColorPrint.blue(f"  Details: {details}")

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

        ColorPrint.green("[CodeSync Client] Started")

    def stop(self):
        """Stop code sync client"""
        if not self.running:
            return

        self.running = False

        # Stop all server connections
        for host, server in list(self.servers.items()):
            server.stop()

        if self.scan_thread:
            self.scan_thread.join(timeout=2.0)

        ColorPrint.yellow("[CodeSync Client] Stopped")

    def _generate_client_id(self) -> str:
        """Generate unique client ID"""
        import uuid
        import platform

        hostname = platform.node()
        mac = uuid.getnode()

        return f"{hostname}_{mac}_{int(time.time())}"

    def _scan_loop(self):
        """Server scanner loop"""
        ColorPrint.green("[CodeSync Client] Server scanner started")

        # Initial scan
        self._scan_for_servers()

        # Periodic re-scan for new servers
        while self.running:
            try:
                time.sleep(30)  # Re-scan every 30 seconds for new servers

                if not self.running:
                    break

                self._scan_for_servers()

            except Exception as e:
                ColorPrint.red(f"[CodeSync Client] Error in scan loop: {e}")

        ColorPrint.yellow("[CodeSync Client] Server scanner stopped")

    def _scan_for_servers(self):
        """Scan LAN for code sync servers and connect to all"""
        ColorPrint.blue("[CodeSync Client] Scanning for code sync servers...")

        # Get local network segment
        local_ip = self._get_local_ip()
        if not local_ip:
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

    def _get_local_ip(self) -> Optional[str]:
        """Get local IP address"""
        try:
            # Create UDP socket to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                # Connect to external address (doesn't actually send data)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
                return local_ip
        except Exception as e:
            ColorPrint.red(f"[CodeSync Client] Error getting local IP: {e}")
            return None


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

        self._add_log(
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
                    self._add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    return 'failed'

                # Backup existing file
                if not self._backup_file(target_path):
                    error_reason = 'Backup failed, skipping update'
                    self._add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    return 'failed'

                # Write new content
                if self._write_file(target_path, content, server_mtime):
                    self._add_log(
                        'received',
                        f'[{server_conn.host}] {rel_path}',
                        reason,
                        f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                    )
                    result = 'received'
                else:
                    error_reason = 'Failed to write file'
                    self._add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                    self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                    result = 'failed'
            else:
                # Local version is newer or same - skip
                server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
                local_time = datetime.fromtimestamp(local_mtime).strftime('%Y-%m-%d %H:%M:%S')

                reason = f'Local newer/same: {local_time} >= {server_time}'
                self._add_log('skipped', f'[{server_conn.host}] {rel_path}', reason)
                result = 'skipped'
        else:
            # File doesn't exist locally - create new
            server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
            reason = f'New file from server: {server_time}'

            # Download file content from this specific server
            content = server_conn._download_file(rel_path)
            if content is None:
                error_reason = 'Failed to download new file'
                self._add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
                self._add_to_server_failed_queue(server_conn, file_info, error_reason)
                return 'failed'

            # Write new file
            if self._write_file(target_path, content, server_mtime):
                self._add_log(
                    'received',
                    f'[{server_conn.host}] {rel_path}',
                    reason,
                    f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                )
                result = 'received'
            else:
                error_reason = 'Failed to write new file'
                self._add_log('error', f'[{server_conn.host}] {rel_path}', error_reason)
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
            'logs': self.sync_logs[-50:],  # Return last 50 logs for UI

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
