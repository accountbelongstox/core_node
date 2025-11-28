# -*- coding: utf-8 -*-
"""
Code Sync Client - Receive code changes from server

Scans LAN for code sync servers (port 59000).
Receives code changes and prompts for overwrite (test mode).
"""

import time
import socket
import threading
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict

from pycore import ColorPrint


class CodeSyncClient:
    """
    Code Synchronization Client

    Features:
    - Scan LAN for code sync servers (port 59000)
    - Connect to server and receive code changes
    - Test mode: Only prompt, don't actually overwrite
    - Auto-reconnect with client ID preservation
    """

    def __init__(self, target_dir: str = r"D:\programing\core_node", scan_interval: int = 5):
        """
        Initialize code sync client

        Args:
            target_dir: Target directory for synced files
            scan_interval: Server scan interval in seconds
        """
        self.target_dir = Path(target_dir)
        self.scan_interval = scan_interval

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

        # Received files tracking
        self.received_files: Dict[str, float] = {}  # path -> mtime

        ColorPrint.green(f"[CodeSync Client] Initialized with target: {self.target_dir}")
        ColorPrint.blue(f"[CodeSync Client] Client ID: {self.client_id}")

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

                for file_info in files:
                    self._process_file(file_info, is_initial=True)

            else:
                ColorPrint.red(f"[CodeSync Client] Initial sync failed: {response.status_code}")

        except Exception as e:
            ColorPrint.red(f"[CodeSync Client] Error in initial sync: {e}")
            import traceback
            traceback.print_exc()

    def _sync_with_server(self):
        """Sync changed files from server"""
        try:
            url = f"http://{self.server_host}:{self.server_port}/code-sync/changes"
            response = requests.post(url, json={'client_id': self.client_id}, timeout=10)

            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])

                if files:
                    ColorPrint.blue(f"[CodeSync Client] Received {len(files)} changed files")

                    for file_info in files:
                        self._process_file(file_info, is_initial=False)

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

    def _process_file(self, file_info: Dict, is_initial: bool = False):
        """
        Process received file (TEST MODE - only prompt, don't overwrite)

        Args:
            file_info: File information dict
            is_initial: Whether this is initial sync
        """
        rel_path = file_info['relative_path']
        server_mtime = file_info['mtime']
        server_hash = file_info['hash']

        target_path = self.target_dir / rel_path

        # Check if file exists locally
        if target_path.exists():
            local_stat = target_path.stat()
            local_mtime = local_stat.st_mtime

            # Compare modification times
            if server_mtime > local_mtime:
                # Server version is newer
                server_time = datetime.fromtimestamp(server_mtime).strftime('%Y-%m-%d %H:%M:%S')
                local_time = datetime.fromtimestamp(local_mtime).strftime('%Y-%m-%d %H:%M:%S')

                ColorPrint.yellow(f"[CodeSync Client] WOULD OVERWRITE: {rel_path}")
                ColorPrint.yellow(f"  Server: {server_time} | Local: {local_time}")

                # TEST MODE: Don't actually overwrite
                # In production, would download and overwrite here

            else:
                # Local version is newer or same - ignore
                ColorPrint.blue(f"[CodeSync Client] IGNORE (local newer): {rel_path}")

        else:
            # File doesn't exist locally
            ColorPrint.green(f"[CodeSync Client] NEW FILE: {rel_path}")

            # TEST MODE: Don't actually create
            # In production, would download and create here

        # Track received file
        self.received_files[rel_path] = server_mtime

    def get_status(self) -> Dict:
        """Get client status"""
        return {
            'running': self.running,
            'client_id': self.client_id,
            'target_dir': str(self.target_dir),
            'connected': self.connected,
            'server_host': self.server_host,
            'server_port': self.server_port,
            'scan_interval': self.scan_interval,
            'received_files_count': len(self.received_files)
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
