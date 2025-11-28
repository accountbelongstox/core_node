# -*- coding: utf-8 -*-
"""
HTTP File Sync Client - Secondary Device Client

Syncs files from primary device using HTTP/REST API.

Features:
- HTTP-based file synchronization
- Periodic sync (every 5 seconds)
- Incremental updates
- Auto-discovery via HTTP
- Conflict detection

Usage:
    client = HTTPFileSyncClient(target_dir='D:/programing/core_node')
    if client.discover_primary():
        client.start_auto_sync()
"""

import os
import time
import threading
import json
from typing import Optional, Dict, List, Callable
from pathlib import Path
import urllib.request
import urllib.error

from .simple_device_scanner import SimpleDeviceScanner

DEFAULT_HTTP_PORT = 58923
SYNC_INTERVAL = 5  # seconds


class HTTPFileSyncClient:
    """
    HTTP-based file sync client for secondary device.

    Uses standard HTTP/REST API for all operations.
    """

    def __init__(self, target_dir: str, primary_host: Optional[str] = None, port: int = DEFAULT_HTTP_PORT):
        """
        Initialize HTTP sync client.

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

    def set_primary(self, host: str, port: int = DEFAULT_HTTP_PORT):
        """
        Set primary device manually.

        Args:
            host: Primary host IP
            port: Primary port
        """
        self.primary_host = host
        self.port = port
        print(f"[HTTPClient] Primary set to {host}:{port}")

    def discover_primary(self) -> bool:
        """
        Auto-discover primary device on network.

        Returns:
            True if primary found
        """
        print("[HTTPClient] Discovering primary device...")

        scanner = SimpleDeviceScanner(port=self.port)
        primary = scanner.find_primary_device()

        if primary:
            self.primary_host = primary['ip']
            self.port = primary['http_port']
            print(f"[HTTPClient] Found primary: {self.primary_host}:{self.port}")
            return True
        else:
            print("[HTTPClient] No primary device found")
            return False

    def enable_sync(self):
        """Enable auto sync."""
        self.enabled = True
        print("[HTTPClient] Sync enabled")

    def disable_sync(self):
        """Disable auto sync."""
        self.enabled = False
        print("[HTTPClient] Sync disabled")

    def is_sync_enabled(self) -> bool:
        """Check if sync is enabled."""
        return self.enabled

    def start_auto_sync(self):
        """Start auto sync thread."""
        if self.running:
            return

        if not self.primary_host:
            print("[HTTPClient] Cannot start: No primary device set")
            return

        self.running = True
        self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()

        print("[HTTPClient] Auto sync started")

    def stop_auto_sync(self):
        """Stop auto sync thread."""
        self.running = False

        if self.sync_thread and self.sync_thread.is_alive():
            self.sync_thread.join(timeout=SYNC_INTERVAL + 1)

        print("[HTTPClient] Auto sync stopped")

    def sync_now(self) -> bool:
        """
        Perform immediate sync.

        Returns:
            True if sync successful
        """
        if not self.enabled:
            print("[HTTPClient] Sync is disabled, skipping")
            return False

        if not self.primary_host:
            print("[HTTPClient] No primary device set")
            return False

        # Check for conflicts
        if self._check_for_conflicts():
            print("[HTTPClient] CONFLICT DETECTED: Multiple primary devices")
            print("[HTTPClient] Force stopping sync")
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
                print(f"[HTTPClient] Syncing {len(changed_files)} files...")
                self._download_files(changed_files)

            self.last_sync_time = time.time()

            if self.on_sync_complete:
                self.on_sync_complete()

            return True

        except Exception as e:
            print(f"[HTTPClient] Sync error: {e}")

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
        Fetch file list from primary device via HTTP.

        Returns:
            List of file metadata dicts
        """
        url = f"http://{self.primary_host}:{self.port}/api/files"

        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                data = response.read().decode('utf-8')
                result = json.loads(data)

                if result.get('status') == 'ok':
                    return result.get('files', [])
                else:
                    return None

        except urllib.error.URLError as e:
            print(f"[HTTPClient] Failed to fetch file list: {e}")
            return None
        except Exception as e:
            print(f"[HTTPClient] Error: {e}")
            return None

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
            print(f"[HTTPClient] Downloading: {path}")

            content = self._download_file(path)
            if content:
                self._save_file(path, content, file_info['mtime'])
                self.total_synced += 1
                self.total_downloaded += len(content)

    def _download_file(self, file_path: str) -> Optional[bytes]:
        """
        Download single file from primary via HTTP.

        Args:
            file_path: Relative file path

        Returns:
            File content bytes
        """
        # URL encode file path
        encoded_path = urllib.parse.quote(file_path)
        url = f"http://{self.primary_host}:{self.port}/api/file/{encoded_path}"

        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()

        except urllib.error.URLError as e:
            print(f"[HTTPClient] Failed to download {file_path}: {e}")
            return None
        except Exception as e:
            print(f"[HTTPClient] Error: {e}")
            return None

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
            scanner = SimpleDeviceScanner(port=self.port)
            devices = scanner.scan_devices()
            primary_devices = scanner.get_primary_devices(devices)

            if len(primary_devices) > 1:
                self.conflict_detected = True
                self.conflict_info = {
                    'count': len(primary_devices),
                    'hosts': [d['ip'] for d in primary_devices],
                    'detected_at': time.time()
                }
                return True
            else:
                # No conflict, clear previous state
                self.conflict_detected = False
                self.conflict_info = None
                return False

        except Exception as e:
            print(f"[HTTPClient] Failed to check for conflicts: {e}")
            return False

    def get_conflict_info(self) -> Optional[Dict]:
        """Get conflict information."""
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
