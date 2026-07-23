# -*- coding: utf-8 -*-
"""
File Sync Server - Primary Device Server

Provides file synchronization services for secondary devices.

Features:
- File metadata caching
- Incremental updates (only modified files)
- HTTP-like protocol over TCP
- File content serving

Port: 45679 (configurable)
Endpoints:
- DISCOVER -> PRIMARY
- PING -> PONG
- GET /list -> File list JSON
- GET /file/<path> -> File content
"""

import socket
import json
import os
import time
import hashlib
from contextlib import nullcontext
from typing import Any, Optional, Dict, List
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pathlib import Path

from pycore.pyutils.launcher.device_sync._deprecated._old_servers.web_server import DeviceSyncWebServer


DEFAULT_SYNC_PORT = 45679


class FileSyncServer:
    """
    File sync server for primary device.

    Usage:
        server = FileSyncServer(
            root_dir='D:/programing/core_node',
            port=45679
        )
        server.start()
    """

    def __init__(self, root_dir: str, port: int = DEFAULT_SYNC_PORT, web_port: int = 8080):
        """
        Initialize sync server.

        Args:
            root_dir: Root directory to serve
            port: Server port
            web_port: Web UI port (default: 8080)
        """
        self.root_dir = Path(root_dir)
        self.port = port
        self.web_port = web_port
        self.running = False
        self.server_socket: Optional[socket.socket] = None
        self.server_thread: Optional[Any] = None
        self._running_signal = f"device_sync.legacy_server.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

        # File metadata cache
        self.file_cache: Dict[str, Dict] = {}
        self.cache_scope = nullcontext()
        init_serialized_owner(self, "device_sync.legacy_server", "LegacySyncServerState")

        # Web server
        self.web_server = None

        # Build initial cache
        self._rebuild_cache()

    def start(self) -> bool:
        """
        Start sync server.

        Returns:
            True if started successfully
        """
        if self.running:
            return True

        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind(('0.0.0.0', self.port))
            self.server_socket.listen(10)
            self.server_socket.settimeout(1)
        except Exception as e:
            print(f"[SyncServer] Failed to bind port {self.port}: {e}")
            return False

        self.running = True
        THREAD_BUS.signal(self._running_signal, True)
        self.server_thread = start_bus_task(
            self._server_loop,
            thread_name="LegacySyncServerThread",
        )

        print(f"[SyncServer] Started on port {self.port}, serving: {self.root_dir}")

        # Start web server
        try:
            self.web_server = DeviceSyncWebServer(port=self.web_port, sync_server=self)
            self.web_server.start()
        except Exception as e:
            print(f"[SyncServer] Warning: Web server failed to start: {e}")

        return True

    def stop(self):
        """Stop sync server."""
        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

        # Stop web server
        if self.web_server:
            try:
                self.web_server.stop()
            except Exception as e:
                print(f"[SyncServer] Error stopping web server: {e}")

        if self.server_socket:
            self.server_socket.close()

        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(timeout=2)

        print("[SyncServer] Stopped")

    def _server_loop(self):
        """Server main loop."""
        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                client_socket, addr = self.server_socket.accept()
                start_bus_task(
                    self._handle_client,
                    client_socket,
                    addr,
                    thread_name="LegacySyncClientThread",
                )
            except socket.timeout:
                continue
            except Exception as e:
                if THREAD_BUS.get_signal(self._running_signal, False):
                    print(f"[SyncServer] Error: {e}")

    def _handle_client(self, client_socket: socket.socket, addr):
        """
        Handle client request.

        Args:
            client_socket: Client socket
            addr: Client address
        """
        try:
            # Receive request
            request = client_socket.recv(4096).decode('utf-8').strip()

            if request == 'DISCOVER':
                # Discovery request
                client_socket.sendall(b'PRIMARY')

            elif request == 'PING':
                # Ping request
                client_socket.sendall(b'PONG')

            elif request == 'GET /list':
                # File list request
                self._handle_list_request(client_socket)

            elif request.startswith('GET /file/'):
                # File content request
                file_path = request[10:]  # Remove 'GET /file/'
                self._handle_file_request(client_socket, file_path)

            elif request == 'REFRESH':
                # Refresh cache request
                self._rebuild_cache()
                client_socket.sendall(b'OK')

            else:
                client_socket.sendall(b'ERROR: Unknown command')

        except Exception as e:
            error_msg = f'ERROR: {str(e)}'
            client_socket.sendall(error_msg.encode('utf-8'))
        finally:
            client_socket.close()

    @serialized_method
    def _handle_list_request(self, client_socket: socket.socket):
        """
        Handle file list request.

        Args:
            client_socket: Client socket
        """
        with self.cache_scope:
            file_list = list(self.file_cache.values())

        response = json.dumps({
            'status': 'ok',
            'files': file_list,
            'timestamp': time.time()
        })

        client_socket.sendall(response.encode('utf-8'))

    def _handle_file_request(self, client_socket: socket.socket, file_path: str):
        """
        Handle file content request.

        Args:
            client_socket: Client socket
            file_path: Relative file path
        """
        full_path = self.root_dir / file_path

        if not full_path.exists():
            client_socket.sendall(b'ERROR: File not found')
            return

        if not self._is_safe_path(full_path):
            client_socket.sendall(b'ERROR: Access denied')
            return

        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            # Send file size first
            size_header = f"{len(content)}\n".encode('utf-8')
            client_socket.sendall(size_header)

            # Send file content
            client_socket.sendall(content)
        except Exception as e:
            error_msg = f'ERROR: {str(e)}'
            client_socket.sendall(error_msg.encode('utf-8'))

    @serialized_method
    def _rebuild_cache(self):
        """Rebuild file metadata cache."""
        print("[SyncServer] Building file cache...")

        with self.cache_scope:
            self.file_cache.clear()

            for file_path in self._walk_directory(self.root_dir):
                rel_path = file_path.relative_to(self.root_dir)
                self.file_cache[str(rel_path)] = self._get_file_metadata(file_path, rel_path)

        print(f"[SyncServer] Cache built: {len(self.file_cache)} files")

    def _walk_directory(self, directory: Path):
        """
        Walk directory and yield file paths.

        Args:
            directory: Directory to walk

        Yields:
            File paths
        """
        exclude_dirs = {
            '__pycache__', '.git', 'node_modules', '.vscode',
            'dist', 'build', '.cache', '.pytest_cache', 'venv', 'env'
        }

        for root, dirs, files in os.walk(directory):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                file_path = Path(root) / file
                yield file_path

    def _get_file_metadata(self, file_path: Path, rel_path: Path) -> Dict:
        """
        Get file metadata.

        Args:
            file_path: Full file path
            rel_path: Relative file path

        Returns:
            Metadata dict
        """
        stat = file_path.stat()

        return {
            'path': str(rel_path).replace('\\', '/'),
            'size': stat.st_size,
            'mtime': stat.st_mtime,
            'hash': self._calculate_file_hash(file_path) if stat.st_size < 10 * 1024 * 1024 else None
        }

    def _calculate_file_hash(self, file_path: Path) -> str:
        """
        Calculate file hash.

        Args:
            file_path: File path

        Returns:
            MD5 hash string
        """
        hasher = hashlib.md5()

        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)

        return hasher.hexdigest()

    def _is_safe_path(self, path: Path) -> bool:
        """
        Check if path is safe (within root directory).

        Args:
            path: Path to check

        Returns:
            True if safe
        """
        try:
            path.resolve().relative_to(self.root_dir.resolve())
            return True
        except ValueError:
            return False

    @serialized_method
    def get_cache_stats(self) -> Dict:
        """
        Get cache statistics.

        Returns:
            Stats dict
        """
        with self.cache_scope:
            total_size = sum(f['size'] for f in self.file_cache.values())

            return {
                'file_count': len(self.file_cache),
                'total_size': total_size,
                'total_size_mb': round(total_size / 1024 / 1024, 2)
            }
