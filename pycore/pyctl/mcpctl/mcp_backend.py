#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend Server (RPC Mode)

Backend with:
- Singleton detection (port 58000-58099)
- RPC service (port 58100, HTTP + WebSocket)
- Integrated with launcher.py thread management
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
RPC_SERVICE_PORT = 58100

# Backend state
backend_info = {
    "backend_id": BACKEND_ID,
    "status": "initializing",
    "singleton_port": None,
    "rpc_port": RPC_SERVICE_PORT,
    "tools": ["get_file_info_with_ocr_and_document_parsing_tool"]
}


def get_backend_info() -> Dict[str, Any]:
    """Get backend information"""
    return backend_info.copy()


def handle_get_file_info(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """
    Mock implementation of get_file_info_with_ocr_and_document_parsing_tool

    Note: RPC handlers can be sync or async, this is sync for simplicity

    Args:
        params: Request parameters containing file_path
        request_id: RPC request ID (optional)
        context: RPC context (optional)

    Returns:
        Mock response with "hello ok!"
    """
    file_path = params.get("file_path", "")
    debug_print(f"[Backend {BACKEND_ID}] Received get_file_info request for: {file_path}", "Backend")

    return {
        "success": True,
        "backend_id": BACKEND_ID,
        "message": "hello ok!",
        "file_path": file_path,
        "mock": True
    }


def handle_backend_info(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Get backend info handler"""
    return get_backend_info()


def start_mcp_backend() -> bool:
    """
    Start MCP backend with RPC service

    Returns:
        True if started successfully
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server (RPC Mode)")
    ColorPrint.blue("=" * 70)
    ColorPrint.green(f"[Backend] Unique ID: {BACKEND_ID}")
    ColorPrint.blue(f"[Backend] Singleton Detection: port {SINGLETON_PORT_START}-{SINGLETON_PORT_START + SINGLETON_PORT_RANGE - 1}")
    ColorPrint.blue(f"[Backend] RPC Service: port {RPC_SERVICE_PORT}")
    ColorPrint.blue("=" * 70)

    # Create service config with RPC enabled
    config = ServiceConfig(
        app_id="mcp_backend",
        app_name=f"MCP Backend ({BACKEND_ID})",
        enable_ui=False,
        enable_rpc=True,           # Enable RPC service
        rpc_port=RPC_SERVICE_PORT,  # RPC port 58100
        rpc_host="0.0.0.0",
        enable_speech=False,
        enable_heartbeat=True,
        port_start=SINGLETON_PORT_START,
        port_range=SINGLETON_PORT_RANGE,
        singleton_check=True,
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
    if instances.singleton_detector and instances.rpc_server:
        singleton_port = instances.singleton_detector.get_port()
        backend_info["singleton_port"] = singleton_port
        backend_info["status"] = "running"

        ColorPrint.green("=" * 70)
        ColorPrint.green(f"[SUCCESS] Backend {BACKEND_ID} is PRIMARY instance")
        ColorPrint.green(f"[SUCCESS] Singleton port: {singleton_port}")
        ColorPrint.green(f"[SUCCESS] RPC port: {RPC_SERVICE_PORT}")
        ColorPrint.green("=" * 70)

        # Register MCP tool routes to RPC server
        ColorPrint.blue("[Backend] Registering MCP tool routes...")
        instances.rpc_server.route('get_file_info', handle_get_file_info)
        instances.rpc_server.route('backend_info', handle_backend_info)
        ColorPrint.green("[Backend] Registered routes: get_file_info, backend_info")

        ColorPrint.blue(f"[Backend] RPC HTTP: http://localhost:{RPC_SERVICE_PORT}/rpc/")
        ColorPrint.blue(f"[Backend] RPC WebSocket: ws://localhost:{RPC_SERVICE_PORT}/rpc/ws")
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
