# -*- coding: utf-8 -*-
"""
File Sync Client - Secondary Device Client

Syncs files from primary device.

Features:
- Periodic sync (every 5 seconds)
- Incremental updates (only changed files)
- Auto-discovery of primary device
- Sync status tracking

Usage:
    client = FileSyncClient(
        target_dir='D:/programing/core_node',
        primary_host='192.168.1.100'
    )
    client.start_auto_sync()
"""

import socket
import json
import os
import time
import threading
from typing import Optional, Dict, List, Callable
from pathlib import Path

from pycore.pyutils.launcher.device_sync._deprecated._old_servers.discovery import DeviceDiscovery


DEFAULT_SYNC_PORT = 45679
SYNC_INTERVAL = 5  # seconds


class FileSyncClient:
    """
    File sync client for secondary device.

    Usage:
        client = FileSyncClient(target_dir='D:/programing/core_node')

        # Auto-discover primary
        if client.discover_primary():
            client.start_auto_sync()

        # Or specify primary manually
        client.set_primary('192.168.1.100', 45679)
        client.start_auto_sync()
    """

    def __init__(self, target_dir: str, primary_host: Optional[str] = None, port: int = DEFAULT_SYNC_PORT):
        """
        Initialize sync client.

        Args:
            target_dir: Target directory to sync to
            primary_host: Primary device host (auto-discover if None)
            port: Primary device port
        """
        self.target_dir = Path(target_dir)
        self.primary_host = primary_host
        self.port = port

        # Sync state
        self.enabled = False
        self.running = False
        self.sync_thread: Optional[threading.Thread] = None

        # Local file cache
        self.local_files: Dict[str, Dict] = {}

        # Sync statistics
        self.last_sync_time: Optional[float] = None
        self.total_synced = 0
        self.total_downloaded = 0

        # Conflict detection
        self.conflict_detected = False
        self.conflict_info: Optional[Dict] = None

        # Callbacks
        self.on_sync_complete: Optional[Callable] = None
        self.on_sync_error: Optional[Callable] = None
        self.on_conflict_detected: Optional[Callable] = None

    def set_primary(self, host: str, port: int = DEFAULT_SYNC_PORT):
        """
        Set primary device manually.

        Args:
            host: Primary host IP
            port: Primary port
        """
        self.primary_host = host
        self.port = port
        print(f"[SyncClient] Primary set to {host}:{port}")

    def discover_primary(self) -> bool:
        """
        Auto-discover primary device on network.

        Returns:
            True if primary found
        """

        print("[SyncClient] Discovering primary device...")

        discovery = DeviceDiscovery(sync_port=self.port)
        primary = discovery.find_primary_device()

        if primary:
            self.primary_host = primary['host']
            self.port = primary['port']
            print(f"[SyncClient] Found primary: {self.primary_host}:{self.port}")
            return True
        else:
            print("[SyncClient] No primary device found")
            return False

    def enable_sync(self):
        """Enable auto sync."""
        self.enabled = True
        print("[SyncClient] Sync enabled")

    def disable_sync(self):
        """Disable auto sync."""
        self.enabled = False
        print("[SyncClient] Sync disabled")

    def is_sync_enabled(self) -> bool:
        """Check if sync is enabled."""
        return self.enabled

    def start_auto_sync(self):
        """Start auto sync thread."""
        if self.running:
            return

        if not self.primary_host:
            print("[SyncClient] Cannot start: No primary device set")
            return

        self.running = True
        self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()

        print("[SyncClient] Auto sync started")

    def stop_auto_sync(self):
        """Stop auto sync thread."""
        self.running = False

        if self.sync_thread and self.sync_thread.is_alive():
            self.sync_thread.join(timeout=SYNC_INTERVAL + 1)

        print("[SyncClient] Auto sync stopped")

    def sync_now(self) -> bool:
        """
        Perform immediate sync.

        Returns:
            True if sync successful
        """
        if not self.enabled:
            print("[SyncClient] Sync is disabled, skipping")
            return False

        if not self.primary_host:
            print("[SyncClient] No primary device set")
            return False

        # Check for network conflicts before syncing
        if self._check_for_conflicts():
            print("[SyncClient] CONFLICT DETECTED: Multiple primary devices on network")
            print("[SyncClient] Force stopping sync to prevent data corruption")
            self.disable_sync()

            if self.on_conflict_detected:
                self.on_conflict_detected(self.conflict_info)

            return False

        try:
            # Get file list from primary
            file_list = self._fetch_file_list()
            if not file_list:
                return False

            # Compare and download changed files
            changed_files = self._find_changed_files(file_list)

            if changed_files:
                print(f"[SyncClient] Syncing {len(changed_files)} files...")
                self._download_files(changed_files)

            self.last_sync_time = time.time()

            if self.on_sync_complete:
                self.on_sync_complete()

            return True

        except Exception as e:
            print(f"[SyncClient] Sync error: {e}")

            if self.on_sync_error:
                self.on_sync_error(str(e))

            return False

    def _sync_loop(self):
        """Auto sync loop (runs in background thread)."""
        while self.running:
            if self.enabled:
                self.sync_now()

            # Sleep interval
            for _ in range(SYNC_INTERVAL * 10):
                if not self.running:
                    break
                time.sleep(0.1)

    def _fetch_file_list(self) -> Optional[List[Dict]]:
        """
        Fetch file list from primary device.

        Returns:
            List of file metadata dicts
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)

        try:
            sock.connect((self.primary_host, self.port))
            sock.sendall(b'GET /list')

            # Receive response
            data = sock.recv(1024 * 1024).decode('utf-8')
            response = json.loads(data)

            if response['status'] == 'ok':
                return response['files']
            else:
                return None

        except Exception as e:
            print(f"[SyncClient] Failed to fetch file list: {e}")
            return None
        finally:
            sock.close()

    def _find_changed_files(self, remote_files: List[Dict]) -> List[Dict]:
        """
        Find files that need to be synced.

        Args:
            remote_files: Remote file list

        Returns:
            List of files to download
        """
        changed = []

        for remote_file in remote_files:
            path = remote_file['path']
            local_path = self.target_dir / path

            # File doesn't exist locally
            if not local_path.exists():
                changed.append(remote_file)
                continue

            # File size changed
            local_size = local_path.stat().st_size
            if local_size != remote_file['size']:
                changed.append(remote_file)
                continue

            # File modification time changed
            local_mtime = local_path.stat().st_mtime
            if abs(local_mtime - remote_file['mtime']) > 1:
                changed.append(remote_file)
                continue

        return changed

    def _download_files(self, files: List[Dict]):
        """
        Download files from primary device.

        Args:
            files: List of files to download
        """
        for file_info in files:
            path = file_info['path']
            print(f"[SyncClient] Downloading: {path}")

            content = self._download_file(path)
            if content:
                self._save_file(path, content, file_info['mtime'])
                self.total_synced += 1
                self.total_downloaded += len(content)

    def _download_file(self, file_path: str) -> Optional[bytes]:
        """
        Download single file from primary.

        Args:
            file_path: Relative file path

        Returns:
            File content bytes
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30)

        try:
            sock.connect((self.primary_host, self.port))

            request = f'GET /file/{file_path}'
            sock.sendall(request.encode('utf-8'))

            # Read size header
            size_line = b''
            while b'\n' not in size_line:
                size_line += sock.recv(1)

            file_size = int(size_line.decode('utf-8').strip())

            # Read file content
            content = b''
            while len(content) < file_size:
                chunk = sock.recv(min(8192, file_size - len(content)))
                if not chunk:
                    break
                content += chunk

            return content

        except Exception as e:
            print(f"[SyncClient] Failed to download {file_path}: {e}")
            return None
        finally:
            sock.close()

    def _save_file(self, file_path: str, content: bytes, mtime: float):
        """
        Save file to local directory.

        Args:
            file_path: Relative file path
            content: File content
            mtime: Modification time
        """
        full_path = self.target_dir / file_path

        # Create parent directories
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        with open(full_path, 'wb') as f:
            f.write(content)

        # Set modification time
        os.utime(full_path, (mtime, mtime))

    def _check_for_conflicts(self) -> bool:
        """
        Check for multiple primary devices on network (conflict).

        Returns:
            True if conflict detected
        """

        try:
            discovery = DeviceDiscovery(sync_port=self.port)
            primary = discovery.find_primary_device(use_cache=False)

            if primary and primary.get('conflict', False):
                self.conflict_detected = True
                self.conflict_info = {
                    'count': primary.get('conflict_count', 0),
                    'hosts': primary.get('conflict_hosts', []),
                    'detected_at': time.time()
                }
                return True
            else:
                # No conflict, clear previous conflict state
                self.conflict_detected = False
                self.conflict_info = None
                return False

        except Exception as e:
            print(f"[SyncClient] Failed to check for conflicts: {e}")
            return False

    def get_conflict_info(self) -> Optional[Dict]:
        """
        Get conflict information.

        Returns:
            Conflict info dict or None
        """
        return self.conflict_info

    def get_sync_stats(self) -> Dict:
        """
        Get sync statistics.

        Returns:
            Stats dict
        """
        return {
            'enabled': self.enabled,
            'running': self.running,
            'primary_host': self.primary_host,
            'last_sync': self.last_sync_time,
            'total_synced': self.total_synced,
            'total_downloaded_mb': round(self.total_downloaded / 1024 / 1024, 2),
            'conflict_detected': self.conflict_detected,
            'conflict_info': self.conflict_info
        }
