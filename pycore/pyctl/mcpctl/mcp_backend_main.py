#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend Server - Single Entry Point

Modular architecture:
- config.py: Port configuration and backend info template
- handlers/: Route handlers (file_processing, database, codebase)
- routes.py: FastAPI route registration system

Usage:
    python -m pycore.pyctl.mcpctl.mcp_backend_main
"""

import os
import sys
import time
import uuid
import threading
from pathlib import Path

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import launch_services, stop_services, ServiceConfig
from pycore.pygvar import (
    MCP_BACKEND_SINGLETON_PORT_START,
    MCP_BACKEND_SINGLETON_PORT_RANGE,
    MCP_BACKEND_RPC_PORT_START
)
from pycore.pyctl.mcpctl.backend.config import (
    BACKEND_INFO_TEMPLATE
)
from pycore.pyctl.mcpctl.backend import handlers
from pycore.pyctl.mcpctl.backend.routes import register_routes
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict, get_global_state
from pyapps.mcp.controller import (
    get_file_info_controller_singleton,
    get_database_controller_singleton,
    get_codebase_controller_singleton
)


def start_mcp_backend(shutdown_existing: bool = True) -> bool:
    """Start MCP backend with modular architecture"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server (Modular Architecture + Smart Singleton)")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f"[Backend] Singleton Detection: port {MCP_BACKEND_SINGLETON_PORT_START}-{MCP_BACKEND_SINGLETON_PORT_START + MCP_BACKEND_SINGLETON_PORT_RANGE - 1}")
    ColorPrint.blue(f"[Backend] RPC v2 Service: port {MCP_BACKEND_RPC_PORT_START}")
    ColorPrint.blue("=" * 70)

    # Register shutdown handler
    def on_shutdown_request(event_data):
        ColorPrint.yellow(f"\n[Backend] Shutdown requested: {event_data}")
        handlers.file_processing.backend_info["status"] = "shutting_down"

    THREAD_BUS.register_event_handler('global.shutdown.requested', on_shutdown_request, priority=10)

    # Initialize global state manager
    global_state = get_global_state()
    ColorPrint.blue("[Backend] Global state manager initialized")

    # Create service configuration with state checker
    config = ServiceConfig(
        app_id="mcp_backend",
        app_name="MCP Backend Server",
        enable_ui=False,
        enable_rpc=False,  # Disable pylauncher RPC v1
        enable_speech=False,
        enable_heartbeat=True,
        port_start=MCP_BACKEND_SINGLETON_PORT_START,
        port_range=MCP_BACKEND_SINGLETON_PORT_RANGE,
        singleton_check=True,
        force_launch=False,
        state_checker=get_backend_state_dict  # Provide state checker for smart singleton
    )

    # Launch services via pylauncher
    ColorPrint.blue("[Backend] Launching services via pylauncher...")
    instances = launch_services(config=config, shutdown_existing=shutdown_existing)

    # Check if we successfully became PRIMARY
    if not instances.singleton_detector:
        ColorPrint.red("[FAILED] Could not become PRIMARY instance")
        return False

    # Get singleton port and update backend info
    singleton_port = instances.singleton_detector.get_port()
    backend_id = str(uuid.uuid4())[:8]

    # Initialize backend_info from template
    backend_info = BACKEND_INFO_TEMPLATE.copy()
    backend_info["backend_id"] = backend_id
    backend_info["singleton_port"] = singleton_port
    backend_info["rpc_port"] = MCP_BACKEND_RPC_PORT_START
    backend_info["status"] = "running"

    ColorPrint.green("=" * 70)
    ColorPrint.green(f"[SUCCESS] Backend {backend_id} is PRIMARY instance")
    ColorPrint.green(f"[SUCCESS] Singleton port: {singleton_port}")
    if instances.heartbeat_system:
        ColorPrint.green(f"[SUCCESS] Heartbeat system running")
    ColorPrint.green("=" * 70)

    # Initialize all controllers
    ColorPrint.blue("[Backend] Initializing controllers...")
    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()
    ColorPrint.green("[Backend] All controllers initialized (File, Database, Codebase)")

    # Set global controllers for handlers
    handlers.file_processing.backend_info = backend_info
    handlers.file_processing.file_controller = file_controller
    handlers.database.backend_info = backend_info
    handlers.database.db_controller = db_controller
    handlers.codebase.backend_info = backend_info
    handlers.codebase.codebase_controller = codebase_controller

    # Start minimal FastAPI server
    ColorPrint.blue("[Backend] Starting minimal FastAPI server...")

    from pycore.pyfoundations.third_party import get_third_package_fastapi, get_third_package_uvicorn

    fastapi_module = get_third_package_fastapi()
    uvicorn = get_third_package_uvicorn()
    FastAPI = fastapi_module.FastAPI

    # Create FastAPI app
    app = FastAPI(title="MCP Backend RPC", version="2.0")

    # Register all routes via routes.py
    register_routes(app, fastapi_module)

    # Add static file serving and web UI routes
    from pathlib import Path
    WEB_DIR = Path(__file__).parent / "web"
    STATIC_DIR = WEB_DIR / "static"

    # Mount static files
    if STATIC_DIR.exists():
        # Import StaticFiles from starlette (FastAPI dependency)
        try:
            from starlette.staticfiles import StaticFiles
            app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
            ColorPrint.green("[Backend] Static files mounted at /static")
        except ImportError:
            ColorPrint.yellow("[Backend] Warning: starlette not available, static files not mounted")

    # Root route serves web UI
    FileResponse = fastapi_module.responses.FileResponse

    @app.get("/")
    async def root():
        index_file = WEB_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "MCP Backend API", "version": "2.0", "web_ui": "not found"}

    ColorPrint.green("[Backend] Routes registered: 20 total (1 meta + 19 tools)")
    ColorPrint.green("  - File Processing: 4 tools")
    ColorPrint.green("  - Database: 7 tools")
    ColorPrint.green("  - Codebase: 8 tools")

    # Start FastAPI server in background thread
    def run_server():
        uvicorn.run(app, host="0.0.0.0", port=MCP_BACKEND_RPC_PORT_START, log_level="info")

    server_thread = threading.Thread(
        target=run_server,
        name="FastAPIServerThread",
        daemon=True
    )
    server_thread.start()

    ColorPrint.green(f"[SUCCESS] FastAPI server started (Thread: {server_thread.name})")
    ColorPrint.green(f"[SUCCESS] RPC service port: {MCP_BACKEND_RPC_PORT_START}")
    ColorPrint.blue(f"[Backend] RPC HTTP: http://localhost:{MCP_BACKEND_RPC_PORT_START}/rpc/")
    ColorPrint.green(f"[Backend] Smart singleton enabled: IDLE→Allow replacement, BUSY→Deny replacement")
    ColorPrint.yellow("\n[Backend] Server running...")
    ColorPrint.yellow("Press Ctrl+C to stop\n")

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

    # Cleanup
    ColorPrint.blue("[Backend] Stopping services...")
    stop_services(instances)
    backend_info["status"] = "stopped"
    ColorPrint.green("[Backend] Stopped")

    return True


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="MCP Backend Server (Modular Architecture)")
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
