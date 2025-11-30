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
import requests
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import get_app_data_dir


class CodeSyncClient:
    """
    Code Synchronization Client

    Features:
    - Scan LAN for code sync servers (port 59000)
    - Connect to server and receive code changes
    - Test mode: Only prompt, don't actually overwrite
    - Auto-reconnect with client ID preservation
    """

    def __init__(self, target_dir: str = r"D:\programing\core_node", scan_interval: int = 5, enable_backup: bool = True):
        """
        Initialize code sync client

        Args:
            target_dir: Target directory for synced files
            scan_interval: Server scan interval in seconds
            enable_backup: Whether to backup files before overwriting
        """
        self.target_dir = Path(target_dir)
        self.scan_interval = scan_interval
        self.enable_backup = enable_backup

        # Client ID (persistent across reconnects)
        self.client_id = self._generate_client_id()

        # Server connection
        self.server_host: Optional[str] = None
        self.server_port: int = 59000
        self.connected = False

        # Client state
        self.running = False
        self.scan_thread: Optional[threading.Thread] = None
        self.sync_thread: Optional[threading.Thread] = None

        # Received files tracking (mirror server's client state format)
        self.received_file_states: Dict[str, Tuple[float, str]] = {}  # path -> (mtime, hash)

        # Statistics (for current sync session)
        self.received_count = 0  # Files actually received/processed
        self.skipped_count = 0   # Files skipped (already up-to-date)

        # Sync logs (recent activity)
        self.sync_logs: List[Dict] = []  # Recent logs for UI display
        self.max_logs = 50  # Keep last 50 logs in memory for UI
        self.max_logs_per_file = 20000  # Max 20000 logs per file

        # Failed files queue (for retry)
        self.failed_files: List[Dict] = []
        self.max_failed_files = 1000

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

        self.failed_files_file = self.logs_dir / 'failed_files.json'

        # Load existing failed files
        self._load_failed_files()

        ColorPrint.green(f"[CodeSync Client] Initialized with target: {self.target_dir}")
        ColorPrint.blue(f"[CodeSync Client] Client ID: {self.client_id}")
        ColorPrint.blue(f"[CodeSync Client] Backup enabled: {self.enable_backup}")
        ColorPrint.blue(f"[CodeSync Client] Backup dir: {self.backup_dir}")
        ColorPrint.blue(f"[CodeSync Client] Logs dir: {self.logs_dir}")

        if self.failed_files:
            ColorPrint.yellow(f"[CodeSync Client] {len(self.failed_files)} files pending retry")

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

    def _load_failed_files(self):
        """Load failed files queue from JSON file"""
        if not self.failed_files_file.exists():
            self.failed_files = []
            return

        with open(self.failed_files_file, 'r', encoding='utf-8') as f:
            self.failed_files = json.load(f)
        ColorPrint.blue(f"[CodeSync Client] Loaded {len(self.failed_files)} failed files")

    def _save_failed_files(self):
        """Save failed files queue to JSON file"""
        # Keep only max_failed_files
        if len(self.failed_files) > self.max_failed_files:
            self.failed_files = self.failed_files[-self.max_failed_files:]

        with open(self.failed_files_file, 'w', encoding='utf-8') as f:
            json.dump(self.failed_files, f, ensure_ascii=False, indent=2)

    def _add_to_failed_queue(self, file_info: Dict, reason: str):
        """
        Add file to failed queue for retry

        Args:
            file_info: File information dict
            reason: Failure reason
        """
        # Check if file already in queue
        rel_path = file_info['relative_path']
        for item in self.failed_files:
            if item.get('file_info', {}).get('relative_path') == rel_path:
                # Update existing entry
                item['retry_count'] = item.get('retry_count', 0) + 1
                item['last_attempt'] = datetime.now().isoformat()
                item['last_error'] = reason
                ColorPrint.yellow(f"[CodeSync Client] File retry count: {rel_path} ({item['retry_count']})")
                self._save_failed_files()
                return

        # Add new entry
        failed_entry = {
            'file_info': file_info,
            'added_at': datetime.now().isoformat(),
            'last_attempt': datetime.now().isoformat(),
            'retry_count': 1,
            'last_error': reason
        }

        self.failed_files.append(failed_entry)
        ColorPrint.yellow(f"[CodeSync Client] Added to retry queue: {rel_path}")

        # Save to file
        self._save_failed_files()

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

        # Start sync thread
        self.sync_thread = threading.Thread(
            target=self._sync_loop,
            daemon=True,
            name="CodeSync-ClientSync"
        )
        self.sync_thread.start()

        ColorPrint.green("[CodeSync Client] Started")

    def stop(self):
        """Stop code sync client"""
        if not self.running:
            return

        self.running = False

        if self.scan_thread:
            self.scan_thread.join(timeout=2.0)

        if self.sync_thread:
            self.sync_thread.join(timeout=2.0)

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
        self._scan_for_server()

        while self.running:
            try:
                time.sleep(self.scan_interval)

                if not self.running:
                    break

                # Scan for server if not connected
                if not self.connected:
                    self._scan_for_server()

            except Exception as e:
                ColorPrint.red(f"[CodeSync Client] Error in scan loop: {e}")
                import traceback
                traceback.print_exc()

        ColorPrint.yellow("[CodeSync Client] Server scanner stopped")

    def _sync_loop(self):
        """Sync loop"""
        ColorPrint.green("[CodeSync Client] Sync loop started")

        while self.running:
            try:
                time.sleep(self.scan_interval)

                if not self.running:
                    break

                # Sync if connected
                if self.connected and self.server_host:
                    self._sync_with_server()

            except Exception as e:
                ColorPrint.red(f"[CodeSync Client] Error in sync loop: {e}")
                import traceback
                traceback.print_exc()

        ColorPrint.yellow("[CodeSync Client] Sync loop stopped")

    def _scan_for_server(self):
        """Scan LAN for code sync server"""
        ColorPrint.blue("[CodeSync Client] Scanning for code sync server...")

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

        # Connect to first found server
        if found_servers:
            self.server_host = found_servers[0]
            self.connected = True
            ColorPrint.green(f"[CodeSync Client] Connected to server: {self.server_host}:{self.server_port}")

            # Register with server
            self._register_with_server()
        else:
            ColorPrint.yellow("[CodeSync Client] No code sync server found")

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

    def _register_with_server(self):
        """Register with code sync server"""
        try:
            url = f"http://{self.server_host}:{self.server_port}/code-sync/register"
            response = requests.post(url, json={'client_id': self.client_id}, timeout=5)

            if response.status_code == 200:
                data = response.json()

                if data.get('needs_initial_sync'):
                    ColorPrint.blue("[CodeSync Client] Needs initial sync")
                    self._do_initial_sync()
                else:
                    ColorPrint.blue("[CodeSync Client] Registered (already synced)")

            else:
                ColorPrint.red(f"[CodeSync Client] Registration failed: {response.status_code}")
                self.connected = False

        except Exception as e:
            ColorPrint.red(f"[CodeSync Client] Error registering: {e}")
            self.connected = False

    def _do_initial_sync(self):
        """Perform initial full sync"""
        ColorPrint.blue("[CodeSync Client] Starting initial sync...")

        try:
            url = f"http://{self.server_host}:{self.server_port}/code-sync/initial-sync"
            response = requests.post(url, json={'client_id': self.client_id}, timeout=30)

            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])

                ColorPrint.green(f"[CodeSync Client] Received {len(files)} files for initial sync")

                # Count received and skipped files
                received = 0
                skipped = 0
                for file_info in files:
                    result = self._process_file(file_info, is_initial=True)
                    if result == 'received':
                        received += 1
                    elif result == 'skipped':
                        skipped += 1

                # Update session statistics
                self.received_count += received
                self.skipped_count += skipped

                ColorPrint.green(
                    f"[CodeSync Client] Initial sync complete: "
                    f"{received} received, {skipped} skipped"
                )

            else:
                ColorPrint.red(f"[CodeSync Client] Initial sync failed: {response.status_code}")

        except Exception as e:
            ColorPrint.red(f"[CodeSync Client] Error in initial sync: {e}")
            import traceback
            traceback.print_exc()

    def _sync_with_server(self):
        """Sync changed files from server"""
        try:
            # First, retry failed files from previous attempts
            if self.failed_files:
                ColorPrint.yellow(f"[CodeSync Client] Retrying {len(self.failed_files)} failed files...")
                self._retry_failed_files()

            # Prepare request with statistics from last sync
            request_data = {
                'client_id': self.client_id,
                'received_count': self.received_count,
                'skipped_count': self.skipped_count
            }

            # Reset statistics for next sync
            self.received_count = 0
            self.skipped_count = 0

            url = f"http://{self.server_host}:{self.server_port}/code-sync/changes"
            response = requests.post(url, json=request_data, timeout=10)

            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])

                if files:
                    ColorPrint.blue(f"[CodeSync Client] Received {len(files)} changed files")

                    # Count received and skipped files
                    received = 0
                    skipped = 0
                    for file_info in files:
                        result = self._process_file(file_info, is_initial=False)
                        if result == 'received':
                            received += 1
                        elif result == 'skipped':
                            skipped += 1

                    # Update statistics for next report
                    self.received_count = received
                    self.skipped_count = skipped

                    ColorPrint.green(
                        f"[CodeSync Client] Sync complete: "
                        f"{received} received, {skipped} skipped"
                    )

            elif response.status_code == 404:
                # Client not registered
                ColorPrint.yellow("[CodeSync Client] Not registered, re-registering...")
                self._register_with_server()

            else:
                ColorPrint.red(f"[CodeSync Client] Sync failed: {response.status_code}")
                self.connected = False
                self.server_host = None

        except Exception as e:
            ColorPrint.red(f"[CodeSync Client] Error syncing: {e}")
            self.connected = False
            self.server_host = None

    def _retry_failed_files(self):
        """Retry downloading failed files"""
        if not self.failed_files:
            return

        ColorPrint.blue(f"[CodeSync Client] Retrying {len(self.failed_files)} failed files...")

        # Process failed files
        succeeded = []
        for i, failed_entry in enumerate(self.failed_files):
            file_info = failed_entry['file_info']
            retry_count = failed_entry.get('retry_count', 0)
            rel_path = file_info['relative_path']

            ColorPrint.yellow(f"[CodeSync Client] Retry {i+1}/{len(self.failed_files)}: {rel_path} (attempt #{retry_count})")

            # Try to process the file again
            result = self._process_file(file_info, is_initial=False)

            if result == 'received':
                # Success - mark for removal from failed queue
                succeeded.append(failed_entry)
                ColorPrint.green(f"[CodeSync Client] Retry succeeded: {rel_path}")
            elif result == 'failed':
                # Still failed - will remain in queue
                ColorPrint.red(f"[CodeSync Client] Retry failed: {rel_path}")

        # Remove succeeded files from failed queue
        if succeeded:
            for entry in succeeded:
                self.failed_files.remove(entry)

            ColorPrint.green(f"[CodeSync Client] {len(succeeded)} files recovered from failed queue")
            self._save_failed_files()

    def _download_file_content(self, rel_path: str) -> Optional[bytes]:
        """
        Download file content from server with retry logic

        Args:
            rel_path: Relative file path

        Returns:
            File content bytes or None
        """
        max_retries = 3
        retry_delay = 1.0  # Initial delay in seconds

        for attempt in range(max_retries):
            try:
                url = f"http://{self.server_host}:{self.server_port}/code-sync/download"
                response = requests.post(
                    url,
                    json={'client_id': self.client_id, 'file_path': rel_path},
                    timeout=30
                )

                if response.status_code == 200:
                    return response.content

                ColorPrint.red(f"[CodeSync Client] Download failed: {response.status_code}")
                return None

            except Exception as e:
                if attempt < max_retries - 1:
                    ColorPrint.yellow(f"[CodeSync Client] Download error (attempt {attempt + 1}/{max_retries}), retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    ColorPrint.red(f"[CodeSync Client] Download failed after {max_retries} attempts: {e}")
                    return None

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

    def _process_file(self, file_info: Dict, is_initial: bool = False) -> str:
        """
        Process received file - download and update if needed

        Args:
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
                ColorPrint.yellow(f"[CodeSync Client] WOULD OVERWRITE: {rel_path}")
                ColorPrint.yellow(f"  {reason}")

                # Download file content
                content = self._download_file_content(rel_path)
                if content is None:
                    error_reason = 'Failed to download file'
                    self._add_log('error', rel_path, error_reason)
                    self._add_to_failed_queue(file_info, error_reason)
                    return 'failed'

                # Backup existing file
                if not self._backup_file(target_path):
                    error_reason = 'Backup failed, skipping update'
                    self._add_log('error', rel_path, error_reason)
                    self._add_to_failed_queue(file_info, error_reason)
                    return 'failed'

                # Write new content
                if self._write_file(target_path, content, server_mtime):
                    self._add_log(
                        'received',
                        rel_path,
                        reason,
                        f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                    )
                    # Success - remove from failed queue if exists
                    self._remove_from_failed_queue(rel_path)
                    result = 'received'
                else:
                    error_reason = 'Failed to write file'
                    self._add_log('error', rel_path, error_reason)
                    self._add_to_failed_queue(file_info, error_reason)
                    result = 'failed'
            else:
                # Local version is newer or same - skip
                server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
                local_time = datetime.fromtimestamp(local_mtime).strftime('%Y-%m-%d %H:%M:%S')

                reason = f'Local newer/same: {local_time} >= {server_time}'
                self._add_log('skipped', rel_path, reason)
                result = 'skipped'
        else:
            # File doesn't exist locally - create new
            server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
            reason = f'New file from server: {server_time}'

            # Download file content
            content = self._download_file_content(rel_path)
            if content is None:
                error_reason = 'Failed to download new file'
                self._add_log('error', rel_path, error_reason)
                self._add_to_failed_queue(file_info, error_reason)
                return 'failed'

            # Write new file
            if self._write_file(target_path, content, server_mtime):
                self._add_log(
                    'received',
                    rel_path,
                    reason,
                    f'Size: {len(content)} bytes, Hash: {server_hash[:8]}'
                )
                # Success - remove from failed queue if exists
                self._remove_from_failed_queue(rel_path)
                result = 'received'
            else:
                error_reason = 'Failed to write new file'
                self._add_log('error', rel_path, error_reason)
                self._add_to_failed_queue(file_info, error_reason)
                result = 'failed'

        # Track received file state (mirror server format)
        if result == 'received':
            self.received_file_states[rel_path] = (server_mtime, server_hash)

        return result

    def _remove_from_failed_queue(self, rel_path: str):
        """
        Remove file from failed queue if exists

        Args:
            rel_path: Relative file path
        """
        for item in self.failed_files:
            if item.get('file_info', {}).get('relative_path') == rel_path:
                self.failed_files.remove(item)
                ColorPrint.green(f"[CodeSync Client] Removed from failed queue: {rel_path}")
                self._save_failed_files()
                break

    def get_status(self) -> Dict:
        """Get client status"""
        # Get timezone information
        tz_offset = datetime.now(timezone.utc).astimezone().strftime('%z')
        tz_name = time.tzname[time.daylight]

        return {
            'running': self.running,
            'client_id': self.client_id,
            'root_dir': str(self.target_dir),
            'target_dir': str(self.target_dir),
            'timezone': tz_name,
            'timezone_offset': tz_offset,
            'connected': self.connected,
            'server_host': self.server_host,
            'server_port': self.server_port,
            'scan_interval': self.scan_interval,
            'received_files_count': len(self.received_file_states),
            'received_count': self.received_count,
            'skipped_count': self.skipped_count,
            'enable_backup': self.enable_backup,
            'logs': self.sync_logs[-50:]  # Return last 50 logs for UI
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
