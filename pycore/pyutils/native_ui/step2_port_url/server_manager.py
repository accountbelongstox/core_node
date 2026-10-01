#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Server Manager - dev servers and static file servers for native UI.

Handles Nuxt dev server startup, Vue dist static servers, port allocation and
process cleanup on shutdown. State lives on one THREAD_BUS owner thread.
"""

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.port_utils import find_available_port, is_port_in_use, wait_for_port_bound

NUXT_DEFAULT_PORT_START = 3000
STATIC_DEFAULT_PORT_START = 8000
PORT_SCAN_ATTEMPTS = 100
NUXT_READY_TIMEOUT_SECONDS = 60.0
STATIC_READY_TIMEOUT_SECONDS = 10.0
STOP_TIMEOUT_SECONDS = 5.0
SERIALIZED_TIMEOUT_SECONDS = 120.0
SHUTDOWN_HOOK_PRIORITY = 50
LOCAL_HOST = "localhost"
BIND_HOST = "0.0.0.0"


@dataclass
class ServerProcess:
    """Information about a managed server process"""
    name: str
    process: Optional[subprocess.Popen]
    port: int
    url: str
    type: str  # "nuxt_dev" or "vue_static"
    working_dir: Path


class ServerManager:
    """Manages server processes for native UI applications."""

    def __init__(self):
        self._servers: Dict[str, ServerProcess] = {}
        self._shutdown_registered = False
        init_serialized_owner(
            self,
            'pyutils.native_ui.server_manager',
            'NativeUIServerManagerThread',
            timeout=SERIALIZED_TIMEOUT_SECONDS,
        )

    def _spawn(self, name: str, argv: List[str], cwd: Path, port: int, server_type: str,
               timeout: float, env: Optional[Dict[str, str]] = None) -> Optional[ServerProcess]:
        try:
            process = subprocess.Popen(
                argv, cwd=str(cwd), env=env,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False,
            )
        except OSError as e:
            ColorPrint.print_error(f"[ServerManager] Failed to start {name} argv={argv} cwd={cwd}: {e}")
            return None

        ColorPrint.print_info(f"[ServerManager] Waiting for {name} on port {port}...")
        if not wait_for_port_bound(port, timeout):
            ColorPrint.print_error(f"[ServerManager] {name} failed to start (timeout {timeout}s)")
            process.kill()
            return None

        server = ServerProcess(
            name=name, process=process, port=port,
            url=f"http://{LOCAL_HOST}:{port}", type=server_type, working_dir=cwd,
        )
        self._servers[name] = server
        ColorPrint.print_success(f"[ServerManager] {name} started: {server.url}")
        self._register_shutdown_hook()
        return server

    @serialized_method
    def start_nuxt_dev_server(
        self,
        app_name: str,
        project_root: Path,
        port: Optional[int] = None
    ) -> Optional[ServerProcess]:
        """Start the Nuxt dev server for an app (reuses a running one)."""
        if app_name in self._servers:
            return self._servers[app_name]

        apps_dir = project_root / "poly_apps" / "nuxt_main" / "apps"
        app_dir = apps_dir / app_name
        if not app_dir.exists() and app_name.startswith("app_"):
            app_dir = apps_dir / app_name[4:]
        if not (app_dir / "package.json").exists():
            ColorPrint.print_error(f"[ServerManager] Nuxt app package.json not found: {app_dir}")
            return None

        if port is None:
            port = find_available_port(NUXT_DEFAULT_PORT_START, PORT_SCAN_ATTEMPTS)
            if port is None:
                ColorPrint.print_error("[ServerManager] No available port for Nuxt dev server")
                return None
        elif is_port_in_use(port):
            ColorPrint.print_warn(f"[ServerManager] Port {port} already in use, assuming dev server running")
            placeholder = ServerProcess(
                name=app_name, process=None, port=port,
                url=f"http://{LOCAL_HOST}:{port}", type="nuxt_dev", working_dir=app_dir,
            )
            self._servers[app_name] = placeholder
            return placeholder

        ColorPrint.print_info(f"[ServerManager] Starting Nuxt dev server: {app_name} on port {port}")
        env = {**os.environ, 'PORT': str(port), 'HOST': BIND_HOST}
        return self._spawn(app_name, ['npm', 'run', 'dev'], app_dir, port, "nuxt_dev",
                           NUXT_READY_TIMEOUT_SECONDS, env=env)

    @serialized_method
    def start_vue_static_server(
        self,
        dist_path: Path,
        port: Optional[int] = None
    ) -> Optional[ServerProcess]:
        """Start a static file server for a Vue dist build (reuses a running one)."""
        server_name = f"vue_dist_{dist_path.name}"
        if server_name in self._servers:
            return self._servers[server_name]

        if not (dist_path / "index.html").exists():
            ColorPrint.print_error(f"[ServerManager] index.html not found in dist: {dist_path}")
            return None

        if port is None:
            port = find_available_port(STATIC_DEFAULT_PORT_START, PORT_SCAN_ATTEMPTS)
            if port is None:
                ColorPrint.print_error("[ServerManager] No available port for static server")
                return None

        ColorPrint.print_info(f"[ServerManager] Starting static file server: {dist_path} on port {port}")
        return self._spawn(server_name, [sys.executable, '-m', 'http.server', str(port)], dist_path, port,
                           "vue_static", STATIC_READY_TIMEOUT_SECONDS)

    @serialized_method
    def stop_server(self, name: str) -> bool:
        """Stop a managed server."""
        server = self._servers.pop(name, None)
        if server is None:
            ColorPrint.print_warn(f"[ServerManager] Server not found: {name}")
            return False
        if server.process is None:
            return True

        ColorPrint.print_info(f"[ServerManager] Stopping server: {name}")
        server.process.terminate()
        try:
            server.process.wait(timeout=STOP_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            ColorPrint.print_warn(f"[ServerManager] Force killing server: {name}")
            server.process.kill()
            server.process.wait()
        ColorPrint.print_success(f"[ServerManager] Server stopped: {name}")
        return True

    @serialized_method
    def stop_all_servers(self):
        """Stop all managed servers."""
        for name in list(self._servers.keys()):
            self.stop_server(name)
        ColorPrint.print_success("[ServerManager] All servers stopped")

    @serialized_method
    def server_info(self, name: str) -> Optional[ServerProcess]:
        return self._servers.get(name)

    @serialized_method
    def list_servers(self) -> List[ServerProcess]:
        return list(self._servers.values())

    def _register_shutdown_hook(self):
        if self._shutdown_registered:
            return
        THREAD_BUS.register_shutdown_handler(
            handler=self.stop_all_servers,
            priority=SHUTDOWN_HOOK_PRIORITY,
            name="native_ui_server_manager",
        )
        self._shutdown_registered = True


server_manager = ServerManager()
