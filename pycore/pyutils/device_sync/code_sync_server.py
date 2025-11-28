# -*- coding: utf-8 -*-
"""
Code Sync Server - Push code changes to connected clients

Pushes code from D:\programing\core_node to connected clients.
Excludes temporary and build directories.
"""

import os
import time
import hashlib
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional, Tuple

from pycore import ColorPrint


class CodeSyncClient:
    """Represents a connected client"""

    def __init__(self, client_id: str, ip: str):
        self.client_id = client_id
        self.ip = ip
        self.connected_at = datetime.now()
        self.last_seen = datetime.now()
        # Track synced files with their state (mtime, hash)
        self.synced_file_states: Dict[str, Tuple[float, str]] = {}
        self.is_initial_sync_done = False

    def update_last_seen(self):
        """Update last seen timestamp"""
        self.last_seen = datetime.now()

    def is_expired(self, timeout_minutes: int = 5) -> bool:
        """Check if client connection expired"""
        return (datetime.now() - self.last_seen) > timedelta(minutes=timeout_minutes)

    def mark_files_synced(self, file_states: Dict[str, Tuple[float, str]]):
        """
        Mark files as synced with their current state

        Args:
            file_states: {relative_path: (mtime, hash)}
        """
        self.synced_file_states.update(file_states)


class CodeSyncServer:
    """
    Code Synchronization Server

    Features:
    - Push code from D:\programing\core_node
    - Exclude temp/build directories
    - Track connected clients (5min timeout)
    - Initial full sync + incremental updates every 5s
    """

    # Directories to exclude from sync
    EXCLUDED_DIRS = {
        '__pycache__',
        '.git',
        'node_modules',
        '.next',
        '.nuxt',
        'dist',
        'build',
        'out',
        '.cache',
        '.vite',
        '.dart_tool',
        'flutter_build',
        'venv',
        'env',
        '.venv',
        '.pytest_cache',
        '.mypy_cache',
        'target',  # Rust
        'bin',
        'obj',  # C#
        '.idea',
        '.vscode',
        'coverage',
    }

    # File extensions to exclude
    EXCLUDED_EXTENSIONS = {
        '.pyc',
        '.pyo',
        '.pyd',
        '.so',
        '.dll',
        '.dylib',
        '.exe',
        '.log',
        '.sqlite',
        '.db',
        '.tmp',
    }

    def __init__(self, root_dir: str = r"D:\programing\core_node", scan_interval: int = 5):
        """
        Initialize code sync server

        Args:
            root_dir: Root directory to sync
            scan_interval: Minimum interval between scans (seconds)
        """
        self.root_dir = Path(root_dir)
        self.scan_interval = scan_interval

        # Client management
        self.clients: Dict[str, CodeSyncClient] = {}
        self.clients_lock = threading.Lock()

        # File cache (for performance, avoid rescanning too frequently)
        self.file_cache: Dict[str, Tuple[float, str]] = {}  # path -> (mtime, hash)
        self.file_cache_lock = threading.Lock()
        self.last_scan_time: float = 0  # Last time we scanned the filesystem

        # Server state
        self.running = False

        ColorPrint.green(f"[CodeSync Server] Initialized with root: {self.root_dir}")

    def start(self):
        """Start code sync server"""
        if self.running:
            ColorPrint.yellow("[CodeSync Server] Already running")
            return

        self.running = True
        ColorPrint.green("[CodeSync Server] Started (on-demand scan mode)")

    def stop(self):
        """Stop code sync server"""
        if not self.running:
            return

        self.running = False
        ColorPrint.yellow("[CodeSync Server] Stopped")

    def register_client(self, client_id: str, ip: str) -> bool:
        """
        Register a client connection

        Args:
            client_id: Unique client identifier
            ip: Client IP address

        Returns:
            True if this is a new client (needs initial sync)
        """
        with self.clients_lock:
            # Check if client exists and not expired
            if client_id in self.clients:
                client = self.clients[client_id]

                if not client.is_expired():
                    # Existing client reconnecting within 5min
                    client.update_last_seen()
                    ColorPrint.blue(f"[CodeSync Server] Client reconnected: {client_id} ({ip})")
                    return False  # No initial sync needed
                else:
                    # Client expired, treat as new
                    ColorPrint.yellow(f"[CodeSync Server] Client expired, re-registering: {client_id} ({ip})")
                    del self.clients[client_id]

            # New client
            client = CodeSyncClient(client_id, ip)
            self.clients[client_id] = client
            ColorPrint.green(f"[CodeSync Server] New client registered: {client_id} ({ip})")
            return True  # Needs initial sync

    def get_initial_sync_files(self, client_id: str) -> List[Dict]:
        """
        Get all files for initial sync

        Args:
            client_id: Client identifier

        Returns:
            List of file info dicts
        """
        ColorPrint.blue(f"[CodeSync Server] Preparing initial sync for {client_id}...")

        # Trigger scan before initial sync
        self._scan_if_needed()

        files = []
        file_states = {}

        with self.file_cache_lock:
            current_cache = self.file_cache.copy()

        for rel_path, (mtime, file_hash) in current_cache.items():
            file_path = self.root_dir / rel_path
            file_info = self._get_file_info(file_path)
            if file_info:
                files.append(file_info)
                file_states[rel_path] = (mtime, file_hash)

        # Mark client as synced with current file states
        with self.clients_lock:
            if client_id in self.clients:
                client = self.clients[client_id]
                client.mark_files_synced(file_states)
                client.is_initial_sync_done = True

        ColorPrint.green(f"[CodeSync Server] Initial sync prepared: {len(files)} files for {client_id}")
        return files

    def get_changed_files(self, client_id: str) -> List[Dict]:
        """
        Get changed files for incremental sync

        Compare client's synced state with current file cache to find changes.

        Args:
            client_id: Client identifier

        Returns:
            List of changed file info dicts
        """
        with self.clients_lock:
            if client_id not in self.clients:
                ColorPrint.yellow(f"[CodeSync Server] Unknown client: {client_id}")
                return []

            client = self.clients[client_id]
            client.update_last_seen()

            if not client.is_initial_sync_done:
                ColorPrint.yellow(f"[CodeSync Server] Client {client_id} not initialized")
                return []

            # Get client's synced state
            client_synced_states = client.synced_file_states.copy()

        # Trigger scan before checking changes
        self._scan_if_needed()

        # Compare with current file cache to find changes
        changed = []
        new_states = {}

        with self.file_cache_lock:
            current_cache = self.file_cache.copy()

        # Check for new or modified files
        for rel_path, (current_mtime, current_hash) in current_cache.items():
            if rel_path not in client_synced_states:
                # New file for this client
                file_path = self.root_dir / rel_path
                file_info = self._get_file_info(file_path)
                if file_info:
                    changed.append(file_info)
                    new_states[rel_path] = (current_mtime, current_hash)
            else:
                # Check if file changed
                synced_mtime, synced_hash = client_synced_states[rel_path]
                if current_hash != synced_hash or current_mtime > synced_mtime:
                    # File modified
                    file_path = self.root_dir / rel_path
                    file_info = self._get_file_info(file_path)
                    if file_info:
                        changed.append(file_info)
                        new_states[rel_path] = (current_mtime, current_hash)

        # Update client's synced states
        if new_states:
            with self.clients_lock:
                if client_id in self.clients:
                    self.clients[client_id].mark_files_synced(new_states)

        if changed:
            ColorPrint.green(f"[CodeSync Server] Sync for {client_id}: {len(changed)} changed files")

        return changed

    def _scan_if_needed(self):
        """
        Scan files only if needed (on-demand)

        Only rescans if more than scan_interval seconds have passed since last scan.
        This avoids rescanning for every client request.
        """
        current_time = time.time()

        # Check if we need to rescan
        if current_time - self.last_scan_time < self.scan_interval:
            # Recent scan exists, skip
            return

        ColorPrint.blue(f"[CodeSync Server] Scanning filesystem...")
        start_time = time.time()

        with self.file_cache_lock:
            for file_path in self._scan_all_files():
                rel_path = str(file_path.relative_to(self.root_dir))

                try:
                    stat = file_path.stat()
                    mtime = stat.st_mtime

                    # Check if file changed
                    if rel_path in self.file_cache:
                        cached_mtime, cached_hash = self.file_cache[rel_path]

                        if mtime > cached_mtime:
                            # File potentially modified, check hash
                            file_hash = self._hash_file(file_path)

                            if file_hash != cached_hash:
                                # Content changed
                                self.file_cache[rel_path] = (mtime, file_hash)
                                ColorPrint.blue(f"[CodeSync Server] File changed: {rel_path}")
                    else:
                        # New file
                        file_hash = self._hash_file(file_path)
                        self.file_cache[rel_path] = (mtime, file_hash)
                        ColorPrint.green(f"[CodeSync Server] New file: {rel_path}")

                except Exception as e:
                    ColorPrint.red(f"[CodeSync Server] Error scanning {rel_path}: {e}")

            # Update last scan time
            self.last_scan_time = current_time

        elapsed = time.time() - start_time
        ColorPrint.green(f"[CodeSync Server] Scan complete: {len(self.file_cache)} files ({elapsed:.2f}s)")

        # Cleanup expired clients periodically
        self._cleanup_expired_clients()

    def _scan_all_files(self) -> List[Path]:
        """
        Scan all files in root directory

        Returns:
            List of file paths
        """
        files = []

        for root, dirs, filenames in os.walk(self.root_dir):
            # Filter excluded directories
            dirs[:] = [d for d in dirs if d not in self.EXCLUDED_DIRS]

            for filename in filenames:
                # Skip excluded extensions
                if any(filename.endswith(ext) for ext in self.EXCLUDED_EXTENSIONS):
                    continue

                file_path = Path(root) / filename
                files.append(file_path)

        return files

    def _get_file_info(self, file_path: Path) -> Optional[Dict]:
        """
        Get file information

        Args:
            file_path: Absolute file path

        Returns:
            File info dict or None
        """
        try:
            stat = file_path.stat()
            rel_path = str(file_path.relative_to(self.root_dir))

            return {
                'relative_path': rel_path,
                'size': stat.st_size,
                'mtime': stat.st_mtime,
                'hash': self._hash_file(file_path)
            }
        except Exception as e:
            ColorPrint.red(f"[CodeSync Server] Error getting file info: {e}")
            return None

    def _hash_file(self, file_path: Path) -> str:
        """
        Calculate file MD5 hash

        Args:
            file_path: File path

        Returns:
            MD5 hash hex string
        """
        try:
            md5 = hashlib.md5()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    md5.update(chunk)
            return md5.hexdigest()
        except Exception as e:
            ColorPrint.red(f"[CodeSync Server] Error hashing file: {e}")
            return ""

    def _cleanup_expired_clients(self):
        """Remove expired clients"""
        with self.clients_lock:
            expired = [
                client_id for client_id, client in self.clients.items()
                if client.is_expired()
            ]

            for client_id in expired:
                del self.clients[client_id]
                ColorPrint.yellow(f"[CodeSync Server] Client expired: {client_id}")

    def get_status(self) -> Dict:
        """Get server status"""
        with self.clients_lock:
            with self.file_cache_lock:
                return {
                    'running': self.running,
                    'root_dir': str(self.root_dir),
                    'scan_interval': self.scan_interval,
                    'clients_count': len(self.clients),
                    'clients': [
                        {
                            'id': client_id,
                            'ip': client.ip,
                            'connected_at': client.connected_at.isoformat(),
                            'last_seen': client.last_seen.isoformat(),
                            'synced_files': len(client.synced_file_states),
                            'initial_sync_done': client.is_initial_sync_done
                        }
                        for client_id, client in self.clients.items()
                    ],
                    'total_files': len(self.file_cache),
                    'changed_files': 0  # Not tracked globally anymore
                }


# Global singleton
_code_sync_server: Optional[CodeSyncServer] = None
_server_lock = threading.Lock()


def get_code_sync_server() -> CodeSyncServer:
    """Get global code sync server instance"""
    global _code_sync_server

    if _code_sync_server is None:
        with _server_lock:
            if _code_sync_server is None:
                _code_sync_server = CodeSyncServer()

    return _code_sync_server
