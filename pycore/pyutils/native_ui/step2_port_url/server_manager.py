#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Server Manager - Manages dev servers and file servers for native UI

Handles:
- Nuxt dev server startup and lifecycle
- Vue dist static file server
- Port detection and allocation
- Process cleanup on shutdown
"""

from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import threading
import time
import socket
from typing import Optional, Dict, List
from pathlib import Path
from dataclasses import dataclass
from pycore import ColorPrint
import subprocess

import traceback

from pycore.pyutils.native_ui.step7_managers.shutdown_manager import get_shutdown_manager




@dataclass
class ServerProcess:
    """Information about a managed server process"""
    name: str
    process: subprocess.Popen
    port: int
    url: str
    type: str  # "nuxt_dev" or "vue_static"
    working_dir: Path


class ServerManager:
    """
    Manages server processes for native UI applications

    Features:
    - Port availability checking
    - Process lifecycle management
    - Automatic cleanup on shutdown
    - Thread-safe operations
    """

    _instance: Optional['ServerManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize server manager (only once)"""
        if getattr(self, '_initialized', False):
            return

        self._servers: Dict[str, ServerProcess] = {}
        self._servers_lock = threading.Lock()
        self._shutdown_registered = False

        ColorPrint.print_info("[ServerManager] Initialized (singleton)")
        self._initialized = True

    def is_port_available(self, port: int, host: str = '127.0.0.1') -> bool:
        """
        Check if a port is available

        Args:
            port: Port number to check
            host: Host address (default: 127.0.0.1)

        Returns:
            True if port is available, False otherwise
        """
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(1.0)
                result = sock.connect_ex((host, port))
                return result != 0  # Port is available if connection fails
        except Exception as e:
            ColorPrint.print_warn(f"[ServerManager] Error checking port {port}: {e}")
            return False

    def find_available_port(self, start_port: int = 3000, max_attempts: int = 100) -> Optional[int]:
        """
        Find an available port starting from start_port

        Args:
            start_port: Starting port number
            max_attempts: Maximum number of ports to try

        Returns:
            Available port number or None if no port found
        """
        for port in range(start_port, start_port + max_attempts):
            if self.is_port_available(port):
                return port
        return None

    def wait_for_port(self, port: int, timeout: float = 30.0, host: str = '127.0.0.1') -> bool:
        """
        Wait for a port to become active (server ready)

        Args:
            port: Port number to wait for
            timeout: Maximum time to wait in seconds
            host: Host address

        Returns:
            True if port became active, False if timeout
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            if not self.is_port_available(port, host):
                # Port is now in use (server is ready)
                return True
            time.sleep(0.5)
        return False

    def start_nuxt_dev_server(
        self,
        app_name: str,
        project_root: Path,
        port: Optional[int] = None
    ) -> Optional[ServerProcess]:
        """
        Start Nuxt dev server for an app

        Args:
            app_name: Application name (e.g., "app_pymatrix")
            project_root: Project root directory
            port: Port to use (auto-allocate if None)

        Returns:
            ServerProcess if successful, None otherwise
        """
        with self._servers_lock:
            # Check if already started
            if app_name in self._servers:
                ColorPrint.print_warn(f"[ServerManager] Nuxt server already running: {app_name}")
                return self._servers[app_name]

            # Locate Nuxt app directory
            app_dir = project_root / "poly_apps" / "nuxt_main" / "apps" / app_name
            if not app_dir.exists():
                # Try without "app_" prefix
                if app_name.startswith("app_"):
                    app_dir = project_root / "poly_apps" / "nuxt_main" / "apps" / app_name[4:]

            if not app_dir.exists():
                ColorPrint.print_error(f"[ServerManager] Nuxt app not found: {app_dir}")
                return None

            # Check package.json
            package_json = app_dir / "package.json"
            if not package_json.exists():
                ColorPrint.print_error(f"[ServerManager] package.json not found: {package_json}")
                return None

            # Allocate port
            if port is None:
                port = self.find_available_port(start_port=3000)
                if port is None:
                    ColorPrint.print_error("[ServerManager] No available port for Nuxt dev server")
                    return None
            else:
                if not self.is_port_available(port):
                    ColorPrint.print_warn(f"[ServerManager] Port {port} already in use, assuming dev server running")
                    # Create a placeholder ServerProcess
                    url = f"http://localhost:{port}"
                    placeholder = ServerProcess(
                        name=app_name,
                        process=None,  # No process (externally managed)
                        port=port,
                        url=url,
                        type="nuxt_dev",
                        working_dir=app_dir
                    )
                    self._servers[app_name] = placeholder
                    return placeholder

            # Start Nuxt dev server
            ColorPrint.print_info(f"[ServerManager] Starting Nuxt dev server: {app_name} on port {port}")

            try:
                # Set environment variables
                env = {
                    **subprocess.os.environ,
                    'PORT': str(port),
                    'HOST': '0.0.0.0'
                }

                # Start process
                process = subprocess.Popen(
                    ['npm', 'run', 'dev'],
                    cwd=str(app_dir),
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    shell=False
                )

                # Wait for server to be ready
                ColorPrint.print_info(f"[ServerManager] Waiting for Nuxt dev server on port {port}...")
                if not self.wait_for_port(port, timeout=60.0):
                    ColorPrint.print_error("[ServerManager] Nuxt dev server failed to start (timeout)")
                    process.kill()
                    return None

                url = f"http://localhost:{port}"
                server_process = ServerProcess(
                    name=app_name,
                    process=process,
                    port=port,
                    url=url,
                    type="nuxt_dev",
                    working_dir=app_dir
                )

                self._servers[app_name] = server_process
                ColorPrint.print_success(f"[ServerManager] Nuxt dev server started: {url}")

                # Register shutdown hook on first server start
                self._register_shutdown_hook()

                return server_process

            except Exception as e:
                ColorPrint.print_error(f"[ServerManager] Failed to start Nuxt dev server: {e}")
                traceback.print_exc()
                return None

    def start_vue_static_server(
        self,
        dist_path: Path,
        port: Optional[int] = None
    ) -> Optional[ServerProcess]:
        """
        Start static file server for Vue dist build

        Args:
            dist_path: Path to Vue dist directory
            port: Port to use (auto-allocate if None)

        Returns:
            ServerProcess if successful, None otherwise
        """
        with self._servers_lock:
            # Generate unique name for this dist
            server_name = f"vue_dist_{dist_path.name}"

            # Check if already started
            if server_name in self._servers:
                ColorPrint.print_warn(f"[ServerManager] Static server already running: {server_name}")
                return self._servers[server_name]

            # Verify dist directory exists
            if not dist_path.exists() or not dist_path.is_dir():
                ColorPrint.print_error(f"[ServerManager] Dist directory not found: {dist_path}")
                return None

            # Verify index.html exists
            index_html = dist_path / "index.html"
            if not index_html.exists():
                ColorPrint.print_error(f"[ServerManager] index.html not found: {index_html}")
                return None

            # Allocate port
            if port is None:
                port = self.find_available_port(start_port=8000)
                if port is None:
                    ColorPrint.print_error("[ServerManager] No available port for static server")
                    return None

            # Start static file server using Python's http.server
            ColorPrint.print_info(f"[ServerManager] Starting static file server: {dist_path} on port {port}")

            try:
                # Start Python's http.server
                process = subprocess.Popen(
                    ['python', '-m', 'http.server', str(port)],
                    cwd=str(dist_path),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    shell=False
                )

                # Wait for server to be ready
                ColorPrint.print_info(f"[ServerManager] Waiting for static server on port {port}...")
                if not self.wait_for_port(port, timeout=10.0):
                    ColorPrint.print_error("[ServerManager] Static server failed to start (timeout)")
                    process.kill()
                    return None

                url = f"http://localhost:{port}"
                server_process = ServerProcess(
                    name=server_name,
                    process=process,
                    port=port,
                    url=url,
                    type="vue_static",
                    working_dir=dist_path
                )

                self._servers[server_name] = server_process
                ColorPrint.print_success(f"[ServerManager] Static server started: {url}")

                # Register shutdown hook on first server start
                self._register_shutdown_hook()

                return server_process

            except Exception as e:
                ColorPrint.print_error(f"[ServerManager] Failed to start static server: {e}")
                traceback.print_exc()
                return None

    def stop_server(self, name: str) -> bool:
        """
        Stop a managed server

        Args:
            name: Server name

        Returns:
            True if stopped successfully
        """
        with self._servers_lock:
            if name not in self._servers:
                ColorPrint.print_warn(f"[ServerManager] Server not found: {name}")
                return False

            server = self._servers[name]

            # Skip if no process (externally managed)
            if server.process is None:
                ColorPrint.print_info(f"[ServerManager] Server externally managed, skipping: {name}")
                del self._servers[name]
                return True

            try:
                ColorPrint.print_info(f"[ServerManager] Stopping server: {name}")

                # Terminate process
                server.process.terminate()

                # Wait for process to finish
                try:
                    server.process.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    # Force kill if not terminated
                    ColorPrint.print_warn(f"[ServerManager] Force killing server: {name}")
                    server.process.kill()
                    server.process.wait()

                del self._servers[name]
                ColorPrint.print_success(f"[ServerManager] Server stopped: {name}")
                return True

            except Exception as e:
                ColorPrint.print_error(f"[ServerManager] Error stopping server {name}: {e}")
                return False

    def stop_all_servers(self):
        """Stop all managed servers"""
        ColorPrint.print_info("[ServerManager] Stopping all servers...")

        with self._servers_lock:
            server_names = list(self._servers.keys())

        for name in server_names:
            self.stop_server(name)

        ColorPrint.print_success("[ServerManager] All servers stopped")

    def get_server_info(self, name: str) -> Optional[ServerProcess]:
        """Get information about a server"""
        with self._servers_lock:
            return self._servers.get(name)

    def list_servers(self) -> List[ServerProcess]:
        """List all managed servers"""
        with self._servers_lock:
            return list(self._servers.values())

    def _register_shutdown_hook(self):
        """Register shutdown hook to cleanup servers"""
        if self._shutdown_registered:
            return

        try:

            shutdown_mgr = get_shutdown_manager()
            shutdown_mgr.add_shutdown_hook(
                name="server_manager_cleanup",
                callback=self.stop_all_servers,
                priority=50  # Higher priority = earlier execution
            )

            ColorPrint.print_info("[ServerManager] Registered shutdown hook")
            self._shutdown_registered = True

        except Exception as e:
            ColorPrint.print_warn(f"[ServerManager] Failed to register shutdown hook: {e}")


def get_server_manager() -> ServerManager:
    """
    Get the singleton ServerManager instance

    Returns:
        ServerManager singleton instance
    """
    return ServerManager()


# Export
__all__ = [
    'ServerManager',
    'ServerProcess',
    'get_server_manager'
]
