#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend Server (Singleton Mode)

Backend with:
- Singleton detection (port 58000-58099)
- HTTP API service (port 58100)
- Mock tool returning "hello ok!"
"""

import os
import sys
import uuid
import json
import time
from pathlib import Path
from typing import Dict, Any

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyctl.mcpctl.debug_config import debug_print, is_backend_debug
from pycore import ColorPrint
from pycore.pylauncher import launch_services, ServiceConfig
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Generate unique backend ID
BACKEND_ID = str(uuid.uuid4())[:8]

# Port configuration
SINGLETON_PORT_START = 58000
SINGLETON_PORT_RANGE = 100
HTTP_SERVICE_PORT = 58100

# Backend state
backend_info = {
    "backend_id": BACKEND_ID,
    "status": "initializing",
    "singleton_port": None,
    "http_port": HTTP_SERVICE_PORT,
    "tools": ["get_file_info_with_ocr_and_document_parsing_tool"]
}


def get_backend_info() -> Dict[str, Any]:
    """Get backend information"""
    return backend_info.copy()


async def handle_get_file_info(file_path: str, **kwargs) -> Dict[str, Any]:
    """
    Mock implementation of get_file_info_with_ocr_and_document_parsing_tool

    Args:
        file_path: Path to file
        **kwargs: Additional parameters

    Returns:
        Mock response with "hello ok!"
    """
    debug_print(f"[Backend {BACKEND_ID}] Received get_file_info request for: {file_path}", "Backend")

    return {
        "success": True,
        "backend_id": BACKEND_ID,
        "message": "hello ok!",
        "file_path": file_path,
        "mock": True
    }


def start_http_server_thread():
    """Start HTTP server in background thread"""
    import threading
    from fastapi import FastAPI
    import uvicorn

    ColorPrint.blue(f"[Backend {BACKEND_ID}] Starting HTTP server on port {HTTP_SERVICE_PORT}...")

    app = FastAPI(title=f"MCP Backend {BACKEND_ID}")

    @app.get("/")
    async def root():
        """Root endpoint"""
        return get_backend_info()

    @app.get("/backend_info")
    async def backend_info_endpoint():
        """Get backend information"""
        return get_backend_info()

    @app.post("/tool/get_file_info")
    async def get_file_info_endpoint(request: dict):
        """Handle get_file_info tool call"""
        file_path = request.get("file_path", "")
        kwargs = {k: v for k, v in request.items() if k != "file_path"}
        result = await handle_get_file_info(file_path, **kwargs)
        return result

    backend_info["status"] = "running"

    # Run uvicorn in thread
    def run_server():
        uvicorn.run(app, host="127.0.0.1", port=HTTP_SERVICE_PORT, log_level="warning")

    server_thread = threading.Thread(target=run_server, daemon=True, name="HTTPServer")
    server_thread.start()

    ColorPrint.green(f"[Backend {BACKEND_ID}] HTTP server running on http://localhost:{HTTP_SERVICE_PORT}")
    return server_thread


def start_mcp_backend() -> bool:
    """
    Start MCP backend with singleton detection

    Returns:
        True if started successfully
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server")
    ColorPrint.blue("=" * 70)
    ColorPrint.green(f"[Backend] Unique ID: {BACKEND_ID}")
    ColorPrint.blue(f"[Backend] Singleton Detection: port {SINGLETON_PORT_START}-{SINGLETON_PORT_START + SINGLETON_PORT_RANGE - 1}")
    ColorPrint.blue(f"[Backend] HTTP Service: port {HTTP_SERVICE_PORT}")
    ColorPrint.blue("=" * 70)

    # Create service config with singleton detection
    config = ServiceConfig(
        app_id="mcp_backend",
        app_name=f"MCP Backend ({BACKEND_ID})",
        enable_ui=False,
        enable_rpc=False,
        enable_speech=False,
        enable_heartbeat=True,  # Enable heartbeat
        port_start=SINGLETON_PORT_START,
        port_range=SINGLETON_PORT_RANGE,
        singleton_check=True,  # Enable singleton detection
        force_launch=False
    )

    # Register shutdown handler
    def on_shutdown_request(event_data):
        ColorPrint.yellow(f"\n[Backend {BACKEND_ID}] Shutdown requested: {event_data}")
        ColorPrint.yellow("[Backend] Cleaning up...")
        ColorPrint.green("[Backend] Shutdown complete")
        sys.exit(0)

    THREAD_BUS.register_event_handler('global.shutdown.requested', on_shutdown_request, priority=10)

    # Launch with singleton detection
    ColorPrint.blue("[Backend] Performing singleton detection...")
    instances = launch_services(
        config=config,
        shutdown_existing=True  # Shutdown existing backend if found
    )

    # Check if we became PRIMARY
    if instances.singleton_detector:
        singleton_port = instances.singleton_detector.get_port()
        backend_info["singleton_port"] = singleton_port

        ColorPrint.green("=" * 70)
        ColorPrint.green(f"[SUCCESS] Backend {BACKEND_ID} is PRIMARY instance")
        ColorPrint.green(f"[SUCCESS] Singleton port: {singleton_port}")
        ColorPrint.green("=" * 70)

        # Start HTTP server
        http_thread = start_http_server_thread()

        ColorPrint.yellow("\n[Backend] Server running...")
        ColorPrint.yellow("Press Ctrl+C to stop\n")

        # Keep running and monitor shutdown
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
        from pycore.pylauncher import stop_services
        stop_services(instances)
        ColorPrint.green("[Backend] Stopped")

        return True
    else:
        ColorPrint.red("[FAILED] Could not become PRIMARY instance")
        return False


if __name__ == "__main__":
    start_mcp_backend()
