#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend Server (RPC v2 Mode)

Backend with:
- Singleton detection (port 58000-58099)
- RPC v2 service (FastAPIRPCServer, port 58100)
- Sync route support (backend_info returns immediately)
- Integrated with SingletonDetector for multi-instance management
"""

import os
import sys
import uuid
import asyncio
import threading
import time
from pathlib import Path
from typing import Dict, Any

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyctl.mcpctl.debug_config import debug_print, is_backend_debug
from pycore import ColorPrint
from pycore.pylauncher.singleton_detector import SingletonDetector
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
    "rpc_version": "v2",
    "tools": ["get_file_info_with_ocr_and_document_parsing_tool"]
}


def get_backend_info() -> Dict[str, Any]:
    """Get backend information (sync handler)"""
    return backend_info.copy()


def handle_get_file_info(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """
    Mock implementation of get_file_info_with_ocr_and_document_parsing_tool

    Note: This is a sync handler (no async/await)

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
        "mock": True,
        "rpc_version": "v2"
    }


def handle_backend_info(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """
    Get backend info handler (sync - immediate response)

    This handler is marked as sync=True when registered,
    so it will return immediately without ACK mechanism.
    """
    return get_backend_info()


def start_rpc_server_thread(singleton_port: int) -> threading.Thread:
    """
    Start FastAPI RPC v2 server in background thread

    Args:
        singleton_port: Singleton port (for info display)

    Returns:
        Background thread running the RPC server
    """
    from pycore.pyfoundations.third_party import get_third_package_uvicorn
    from pycore.pyutils.rpc_v2.server import FastAPIRPCServer

    uvicorn = get_third_package_uvicorn()

    ColorPrint.blue("[Backend] Creating FastAPI RPC v2 server...")

    # Create RPC v2 server
    server = FastAPIRPCServer(options={
        "host": "0.0.0.0",
        "port": RPC_SERVICE_PORT,
        "debug": True
    })

    # ✅ Register routes with sync mode
    ColorPrint.blue("[Backend] Registering MCP tool routes...")

    # Sync route: backend_info (immediate response)
    server.route(
        'backend_info',
        handle_backend_info,
        sync=True,  # ⭐ Sync mode - no requires_ack
        description="Get backend information (immediate response)"
    )

    # Async route: get_file_info (ACK mechanism for future real implementation)
    server.route(
        'get_file_info',
        handle_get_file_info,
        sync=False,  # Async mode - uses ACK mechanism
        description="Get file info with OCR and document parsing"
    )

    ColorPrint.green("[Backend] Registered routes:")
    ColorPrint.green("  - backend_info (sync=True, immediate response)")
    ColorPrint.green("  - get_file_info (sync=False, ACK mechanism)")

    # Update backend info
    backend_info["singleton_port"] = singleton_port
    backend_info["status"] = "running"

    ColorPrint.green("=" * 70)
    ColorPrint.green(f"[SUCCESS] Backend {BACKEND_ID} is PRIMARY instance")
    ColorPrint.green(f"[SUCCESS] Singleton port: {singleton_port}")
    ColorPrint.green(f"[SUCCESS] RPC v2 port: {RPC_SERVICE_PORT}")
    ColorPrint.green("=" * 70)

    # Display route stats
    stats = server.routes_manager.get_route_stats()
    ColorPrint.blue(f"[Backend] Route Statistics:")
    ColorPrint.blue(f"  Total routes: {stats['total']}")
    ColorPrint.blue(f"  Sync routes: {stats['sync_routes']}")
    ColorPrint.blue(f"  Async routes: {stats['async_routes']}")

    ColorPrint.blue(f"[Backend] RPC HTTP: http://localhost:{RPC_SERVICE_PORT}/rpc/")
    ColorPrint.blue(f"[Backend] RPC WebSocket: ws://localhost:{RPC_SERVICE_PORT}/rpc/ws")
    ColorPrint.yellow("\n[Backend] Server running...")
    ColorPrint.yellow("Press Ctrl+C to stop\n")

    # Start server in background thread
    def run_server():
        """Run uvicorn server"""
        uvicorn.run(
            server.app,
            host="0.0.0.0",
            port=RPC_SERVICE_PORT,
            log_level="info"
        )

    server_thread = threading.Thread(
        target=run_server,
        name="FastAPIRPCServerThread",
        daemon=True
    )
    server_thread.start()

    ColorPrint.green(f"[Backend] RPC v2 server thread started (Thread: {server_thread.name})")

    return server_thread


def start_mcp_backend() -> bool:
    """
    Start MCP backend with RPC v2 service

    Returns:
        True if started successfully
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server (RPC v2 Mode)")
    ColorPrint.blue("=" * 70)
    ColorPrint.green(f"[Backend] Unique ID: {BACKEND_ID}")
    ColorPrint.blue(f"[Backend] Singleton Detection: port {SINGLETON_PORT_START}-{SINGLETON_PORT_START + SINGLETON_PORT_RANGE - 1}")
    ColorPrint.blue(f"[Backend] RPC v2 Service: port {RPC_SERVICE_PORT}")
    ColorPrint.blue("=" * 70)

    # Register shutdown handler
    shutdown_requested = threading.Event()

    def on_shutdown_request(event_data):
        ColorPrint.yellow(f"\n[Backend {BACKEND_ID}] Shutdown requested: {event_data}")
        ColorPrint.yellow("[Backend] Cleaning up...")
        shutdown_requested.set()

    THREAD_BUS.register_event_handler('global.shutdown.requested', on_shutdown_request, priority=10)

    # Perform singleton detection
    ColorPrint.blue("[Backend] Performing singleton detection...")

    # Message handler for SHUTDOWN requests
    def on_message(message: Dict):
        if message.get("type") == "SHUTDOWN":
            ColorPrint.yellow(f"[Backend] Received SHUTDOWN message, exiting...")
            THREAD_BUS.request_shutdown("Shutdown by new instance")

    detector = SingletonDetector(
        app_id="mcp_backend",
        port_start=SINGLETON_PORT_START,
        port_range=SINGLETON_PORT_RANGE,
        debug=True,
        on_message=on_message
    )

    # Detect existing instance
    result = detector.detect_and_bind()

    # Handle existing instance
    if result.existing_instance:
        ColorPrint.yellow(f"[Backend] Found existing instance at port {result.existing_port}")
        ColorPrint.yellow("[Backend] Sending SHUTDOWN to existing instance...")

        # Send SHUTDOWN message
        try:
            import socket
            import json
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect(("127.0.0.1", result.existing_port))

            message = {
                "protocol": "PYCORE_SINGLETON_V1",
                "type": "SHUTDOWN",
                "app_id": "mcp_backend",
                "data": {"reason": "New instance starting"}
            }
            sock.sendall((json.dumps(message) + "\n").encode())

            response = sock.recv(1024).decode()
            sock.close()

            ColorPrint.green("[Backend] SHUTDOWN sent successfully")
            time.sleep(2)  # Wait for old instance to exit

            # Try to bind again
            detector2 = SingletonDetector(
                app_id="mcp_backend",
                port_start=SINGLETON_PORT_START,
                port_range=SINGLETON_PORT_RANGE,
                debug=True,
                on_message=on_message
            )
            result = detector2.detect_and_bind()
            detector = detector2

        except Exception as e:
            ColorPrint.red(f"[Backend] Failed to shutdown existing instance: {e}")
            detector.stop()
            return False

    if result.is_primary:
        singleton_port = detector.get_port()

        # Start RPC v2 server in background thread
        server_thread = start_rpc_server_thread(singleton_port)

        # Wait for shutdown signal
        try:
            while not shutdown_requested.is_set():
                if THREAD_BUS.is_shutdown_requested():
                    reason = THREAD_BUS.get_shutdown_reason()
                    ColorPrint.yellow(f"\n[Backend] Shutdown signal: {reason}")
                    break
                time.sleep(1)
        except KeyboardInterrupt:
            ColorPrint.blue("\n[Backend] Shutting down (Ctrl+C)...")

        # Cleanup
        detector.stop()
        ColorPrint.green("[Backend] Singleton detector stopped")
        ColorPrint.green("[Backend] Stopped")

        return True
    else:
        ColorPrint.red("[FAILED] Could not become PRIMARY instance")
        ColorPrint.red(f"[FAILED] Existing instance on port: {result.existing_port}")
        detector.stop()
        return False


if __name__ == "__main__":
    start_mcp_backend()
