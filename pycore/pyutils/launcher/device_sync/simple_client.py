# -*- coding: utf-8 -*-
"""
Simple Sync Client - Syncs files from PRIMARY server

Only handles SECONDARY client functionality.
Uses global_config for shared state.
"""

import os
import time
import json
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Optional, Dict, List

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

from pycore.pyutils.launcher.device_sync.core.config import get_global_config, DEFAULT_SYNC_INTERVAL
from pycore.pyutils.launcher.device_sync.simple_device_scanner import SimpleDeviceScanner
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class SimpleClient:
    """
    Simple sync client for SECONDARY devices

    Only handles file synchronization from PRIMARY server.
    Uses global_config for shared state.
    """

    def __init__(self):
        """Initialize simple client"""
        self.config = get_global_config()
        self.running = False
        self.sync_thread: Optional[Any] = None
        self._running_signal = f"device_sync.simple_client.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        # Sync statistics
        self.last_sync_time: Optional[float] = None
        self.total_synced = 0
        self.total_downloaded = 0

    def start(self):
        """Start sync client"""
        if self.running:
            ColorPrint.warning("Client already running")
            return

        if not self.config.sync_enabled:
            ColorPrint.warning("Sync is not enabled")
            return

        if self.config.isPrimaryServer:
            ColorPrint.error("Cannot start client: This is PRIMARY server")
            return

        ColorPrint.info("Starting sync client...")

        # Discover PRIMARY server if not set
        if not self.config.primary_server_ip:
            if not self._discover_primary():
                ColorPrint.error("Failed to discover PRIMARY server")
                return

        # Start sync thread
        self.running = True
        THREAD_BUS.signal(self._running_signal, True)
        self.sync_thread = start_bus_task(
            self._sync_loop,
            thread_name="SimpleSyncClientThread",
        )

        self.config.client_running = True

        ColorPrint.info(f"✓ Sync client started (syncing from {self.config.primary_server_ip}:{self.config.primary_server_port})")

    def stop(self):
        """Stop sync client"""
        if not self.running:
            return

        ColorPrint.info("Stopping sync client...")

        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

        if self.sync_thread and self.sync_thread.is_alive():
            self.sync_thread.join(timeout=DEFAULT_SYNC_INTERVAL + 1)

        self.config.client_running = False

        ColorPrint.info("Sync client stopped")

    def sync_now(self) -> bool:
        """
        Perform immediate sync

        Returns:
            True if sync successful
        """
        if not self.config.sync_enabled:
            ColorPrint.debug("Sync is disabled, skipping")
            return False

        if not self.config.primary_server_ip:
            ColorPrint.warning("No primary server set")
            return False

        try:
            # Get file list from primary
            file_list = self._fetch_file_list()
            if not file_list:
                return False

            # Compare and download changed files
            changed_files = self._find_changed_files(file_list)

            if changed_files:
                ColorPrint.info(f"Syncing {len(changed_files)} files...")
                self._download_files(changed_files)
            else:
                ColorPrint.debug("No files to sync")

            self.last_sync_time = time.time()
            return True

        except Exception as e:
            ColorPrint.error(f"Sync error: {e}")
            return False

    def _sync_loop(self):
        """Auto sync loop (runs in background thread)"""
        while THREAD_BUS.get_signal(self._running_signal, False):
            if self.config.sync_enabled:
                self.sync_now()

            # Sleep interval
            for _ in range(DEFAULT_SYNC_INTERVAL * 10):
                if not THREAD_BUS.get_signal(self._running_signal, False):
                    break
                time.sleep(0.1)

    def _discover_primary(self) -> bool:
        """
        Auto-discover PRIMARY server on network

        Returns:
            True if primary found
        """
        ColorPrint.info("Discovering PRIMARY server...")

        scanner = SimpleDeviceScanner(port=self.config.http_port)
        primary = scanner.find_primary_device()

        if primary:
            self.config.primary_server_ip = primary['ip']
            self.config.primary_server_port = primary['http_port']
            ColorPrint.info(f"Found PRIMARY server: {self.config.primary_server_ip}:{self.config.primary_server_port}")
            return True
        else:
            ColorPrint.warning("No PRIMARY server found on network")
            return False

    def _fetch_file_list(self) -> Optional[List[Dict]]:
        """
        Fetch file list from PRIMARY server

        Returns:
            List of file metadata dicts
        """
        url = f"http://{self.config.primary_server_ip}:{self.config.primary_server_port}/api/files"

        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                data = response.read().decode('utf-8')
                result = json.loads(data)

                if result.get('status') == 'ok':
                    return result.get('files', [])
                else:
                    ColorPrint.error(f"Failed to fetch file list: {result}")
                    return None

        except urllib.error.URLError as e:
            ColorPrint.error(f"Failed to fetch file list: {e}")
            return None
        except Exception as e:
            ColorPrint.error(f"Error fetching file list: {e}")
            return None

    def _find_changed_files(self, remote_files: List[Dict]) -> List[Dict]:
        """
        Find files that need to be synced

        Args:
            remote_files: Remote file list

        Returns:
            List of files to download
        """
        changed = []

        for remote_file in remote_files:
            path = remote_file['path']
            local_path = self.config.root_dir / path

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
        Download files from PRIMARY server

        Args:
            files: List of files to download
        """
        for file_info in files:
            path = file_info['path']
            ColorPrint.info(f"Downloading: {path}")

            content = self._download_file(path)
            if content:
                self._save_file(path, content, file_info['mtime'])
                self.total_synced += 1
                self.total_downloaded += len(content)

    def _download_file(self, file_path: str) -> Optional[bytes]:
        """
        Download single file from PRIMARY server

        Args:
            file_path: Relative file path

        Returns:
            File content bytes
        """
        # URL encode file path
        encoded_path = urllib.parse.quote(file_path)
        url = f"http://{self.config.primary_server_ip}:{self.config.primary_server_port}/api/file/{encoded_path}"

        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()

        except urllib.error.URLError as e:
            ColorPrint.error(f"Failed to download {file_path}: {e}")
            return None
        except Exception as e:
            ColorPrint.error(f"Error downloading {file_path}: {e}")
            return None

    def _save_file(self, file_path: str, content: bytes, mtime: float):
        """
        Save file to local directory

        Args:
            file_path: Relative file path
            content: File content
            mtime: Modification time
        """
        full_path = self.config.root_dir / file_path

        # Create parent directories
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        with open(full_path, 'wb') as f:
            f.write(content)

        # Set modification time
        os.utime(full_path, (mtime, mtime))

    def is_running(self) -> bool:
        """Check if client is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))

    def get_stats(self) -> Dict:
        """
        Get sync statistics

        Returns:
            Stats dict
        """
        return {
            'running': bool(THREAD_BUS.get_signal(self._running_signal, False)),
            'sync_enabled': self.config.sync_enabled,
            'primary_server_ip': self.config.primary_server_ip,
            'last_sync': self.last_sync_time,
            'total_synced': self.total_synced,
            'total_downloaded_mb': round(self.total_downloaded / 1024 / 1024, 2)
        }
