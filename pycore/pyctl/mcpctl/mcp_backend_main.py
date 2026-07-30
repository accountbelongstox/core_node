#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend Server - RPC v2 Architecture (Refactored 2025-11-19)

Architecture:
- Uses pycore.pylauncher (new refactored version)
- Uses pycore.pyutils.rpc_v2 (RpcServer)
- Does NOT directly implement HTTP server
- All business logic reused from backend/handlers

Usage:
    python -m pycore.pyctl.mcpctl.mcp_backend_main
"""

import sys
import time
import uuid
from pathlib import Path

import argparse


# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pylauncher.launcher import LauncherConfig, ServiceLauncher
from pycore.pyfoundations.pygvar import MCP_BACKEND_RPC_PORT, RPC_CONTROLLER_PREFIX
from pycore.pyctl.mcpctl.backend.config import BACKEND_INFO_TEMPLATE
from pycore.pyctl.mcpctl.backend.handlers.context import set_handler_context
from pycore.pyctl.mcpctl.backend.rpc_routes import register_mcp_routes
from pyapps.mcp.controller import (
    get_file_info_controller_singleton,
    get_database_controller_singleton,
    get_codebase_controller_singleton
)

# Web UI paths
WEB_DIR = Path(__file__).parent / "web"
STATIC_DIR = WEB_DIR / "static"


def start_mcp_backend(shutdown_existing: bool = True) -> bool:
    """Start MCP backend with RPC v2 architecture"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server (RPC v2 Architecture)")
    ColorPrint.blue("=" * 70)

    # Initialize global state manager
    ColorPrint.blue("[Backend] Global state manager initialized")

    # Create launcher configuration using new API
    config = LauncherConfig(
        app_id="mcp_backend",
        app_name="MCP Backend Server",
        services={
            'heartbeat': {},  # Always enabled by default
            'rpc_v2': {
                'port': MCP_BACKEND_RPC_PORT,
                'host': '0.0.0.0',
                'debug': True
            }
        }
    )

    # Launch services via new ServiceLauncher
    ColorPrint.blue("[Backend] Launching services via PyLauncher (RPC v2)...")
    launcher = ServiceLauncher(config)

    if not launcher.start():
        ColorPrint.red("[FAILED] Could not start services")
        return False

    # Get the RPC v2 runner.
    rpc_runner = launcher.get_service('rpc_v2')
    if not rpc_runner:
        ColorPrint.red("[FAILED] RPC v2 service not started")
        launcher.stop()
        return False

    # Get actual RPC server from runner
    rpc_server = rpc_runner.server if hasattr(rpc_runner, 'server') else rpc_runner
    if not rpc_server:
        ColorPrint.red("[FAILED] Could not get RPC v2 server instance")
        launcher.stop()
        return False

    # Generate backend ID
    backend_id = str(uuid.uuid4())[:8]

    # Initialize backend_info from template
    backend_info = BACKEND_INFO_TEMPLATE.copy()
    backend_info["backend_id"] = backend_id
    backend_info["singleton_port"] = None  # No singleton detection in this architecture
    backend_info["rpc_port"] = MCP_BACKEND_RPC_PORT
    backend_info["status"] = "running"
    backend_info["start_time"] = int(time.time())

    ColorPrint.green("=" * 70)
    ColorPrint.green(f"[SUCCESS] Backend {backend_id} started")
    ColorPrint.green(f"[SUCCESS] RPC v2 server running on port {MCP_BACKEND_RPC_PORT}")
    if launcher.is_running('heartbeat'):
        ColorPrint.green(f"[SUCCESS] Heartbeat system running")
    ColorPrint.green("=" * 70)

    # Initialize all controllers (复用业务逻辑)
    ColorPrint.blue("[Backend] Initializing controllers...")
    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()
    ColorPrint.green("[Backend] All controllers initialized (File, Database, Codebase)")

    set_handler_context(
        backend_info,
        file_controller,
        db_controller,
        codebase_controller,
    )

    # Register MCP routes to RPC v2 server (使用 rpc_routes.py)
    ColorPrint.blue("[Backend] Registering MCP routes to RPC v2 server...")
    register_mcp_routes(rpc_server)

    # Mount Web UI static files (if available)
    if STATIC_DIR.exists() and hasattr(rpc_server, 'add_static_dir'):
        rpc_server.add_static_dir("/static", str(STATIC_DIR))
        ColorPrint.green(f"[Backend] Static files mounted at /static")

    # Mount root route for Web UI (if available)
    if (WEB_DIR / "index.html").exists() and hasattr(rpc_server, 'add_static_dir'):
        rpc_server.add_static_dir("/", str(WEB_DIR))
        ColorPrint.green(f"[Backend] Web UI mounted at http://localhost:{MCP_BACKEND_RPC_PORT}/")

    ColorPrint.blue(
        f"[Backend] RPC HTTP: http://localhost:{MCP_BACKEND_RPC_PORT}"
        f"{RPC_CONTROLLER_PREFIX}/<route>"
    )
    ColorPrint.blue(
        f"[Backend] HTTP controllers: "
        f"http://localhost:{MCP_BACKEND_RPC_PORT}/api/controllers"
    )
    ColorPrint.yellow("\n[Backend] Server running...")
    ColorPrint.yellow("Press Ctrl+C to stop\n")

    # Register shutdown handler
    def on_shutdown_request(event_data):
        ColorPrint.yellow(f"\n[Backend] Shutdown requested: {event_data}")
        backend_info["status"] = "shutting_down"

    THREAD_BUS.register_event_handler('global.shutdown.requested', on_shutdown_request, priority=10)

    # Keep service running and monitor shutdown signal
    try:
        while True:
            if THREAD_BUS.is_shutdown_requested():
                reason = THREAD_BUS.get_shutdown_reason()
                ColorPrint.yellow(f"\n[Backend] Shutdown signal: {reason}")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.blue("\n[Backend] Shutting down (Ctrl+C)...")

    # Cleanup - use launcher's stop method
    ColorPrint.blue("[Backend] Stopping services...")
    launcher.stop()
    backend_info["status"] = "stopped"
    ColorPrint.green("[Backend] Stopped")

    return True


def main():
    """Main entry point"""

    parser = argparse.ArgumentParser(description="MCP Backend Server (RPC v2 Architecture)")
    parser.add_argument(
        "--no-shutdown-existing",
        action="store_true",
        help="Do NOT shutdown existing instance"
    )

    args = parser.parse_args()
    shutdown_existing = not args.no_shutdown_existing

    success = start_mcp_backend(shutdown_existing=shutdown_existing)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
