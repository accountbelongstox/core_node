# -*- coding: utf-8 -*-
"""
Server Connection - middle layer for a single code-sync server connection.

Encapsulates all logic for connecting to and syncing with one code sync server,
so the main client (CodeSyncClient) can manage several server connections at
once. Extracted from client.py.

Stdlib only: HTTP via `.runtime.http` (urllib), logging via `.runtime.log`.
No pycore import, no third_party.
"""

import time
import threading
from typing import Optional, List, Dict, Tuple

from .runtime import (
    log as ColorPrint,
    http as requests,
)


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
