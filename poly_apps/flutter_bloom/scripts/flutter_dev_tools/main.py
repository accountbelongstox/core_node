#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flutter Design Documentation Tool - Main Server
Multi-file modular architecture with unified routing system
"""

from __future__ import annotations

import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Add project root to Python path for pycore imports
# Script location: poly_apps/flutter_bloom/scripts/flutter_dev_tools/main.py
# Project root: 4 levels up (flutter_dev_tools -> scripts -> flutter_bloom -> poly_apps -> core_node)
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Import from pycore following standards
from pycore.pyfoundations import ColorPrint

# Import project modules
from api import app_checker
from utils import path_utils, port_manager
from routes.router import Router

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5757

STATIC_DIR = Path(__file__).resolve().parent / "static"

# Global shutdown event
shutdown_event = threading.Event()

# Global router instance (initialized in run_server)
router = None

# Use ColorPrint static methods directly (no instance needed)


class DesignDocRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for design documentation tool"""

    def do_GET(self) -> None:  # noqa: N802
        """Handle GET requests via router"""
        global router
        if router:
            router.dispatch(self, 'GET')
        else:
            self.send_error(500, "Router not initialized")

    def do_POST(self) -> None:  # noqa: N802
        """Handle POST requests via router"""
        global router
        if router:
            router.dispatch(self, 'POST')
        else:
            self.send_error(500, "Router not initialized")

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        """Suppress default logging"""
        return


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Run the HTTP server"""
    global router

    apps_dir = path_utils.get_apps_dir()

    # Initialize router
    ColorPrint.blue("[Router] Initializing routing system...")
    router = Router(STATIC_DIR, shutdown_event)
    ColorPrint.green("[Router] Routing system initialized successfully")

    # Clean up old server instances on the same port
    if not port_manager.cleanup_old_server(port, auto_kill=True):
        ColorPrint.red(f"[ERROR] Port {port} is in use and could not be freed.")
        ColorPrint.red("[ERROR] Please manually stop the process or use a different port.")
        return

    # Wait a moment for port to be fully released
    if not port_manager.wait_for_port_release(port, timeout=3):
        ColorPrint.yellow(f"[WARNING] Port {port} may still be in use. Attempting to start anyway...")

    # Auto-expand design document structure for all apps
    ColorPrint.blue("[AutoExpand] Ensuring design document structure for all apps...")
    from utils.design_structure_auto_expand import ensure_all_apps_design_structure
    expand_results = ensure_all_apps_design_structure()
    expanded_count = sum(1 for success in expand_results.values() if success)
    ColorPrint.green(f"[AutoExpand] Processed {expanded_count}/{len(expand_results)} apps")

    # Auto-initialize all apps on startup
    init_summary = app_checker.auto_initialize_all_apps(apps_dir)

    # Start server
    try:
        server = ThreadingHTTPServer((host, port), DesignDocRequestHandler)
    except OSError as e:
        if "Address already in use" in str(e) or "Only one usage" in str(e):
            ColorPrint.red(f"[ERROR] Port {port} is still in use after cleanup attempt.")
            ColorPrint.red("[ERROR] Please wait a few seconds and try again.")
            return
        else:
            raise

    apps = app_checker.list_apps(apps_dir)

    ColorPrint.cyan("\n" + "=" * 60)
    ColorPrint.cyan("Flutter Design Documentation Tool - Refactored Architecture")
    ColorPrint.cyan("=" * 60)
    print(f"Found {len(apps)} apps in {apps_dir}")
    print(f"\nBrowse: http://{host}:{port}")
    print(f"Shutdown: POST to http://{host}:{port}/api/shutdown")
    print("Press Ctrl+C to stop the server")
    ColorPrint.cyan("=" * 60 + "\n")

    # Run server in a separate thread so we can monitor shutdown event
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        # Wait for shutdown event or keyboard interrupt
        while not shutdown_event.is_set():
            shutdown_event.wait(timeout=1.0)
    except KeyboardInterrupt:
        ColorPrint.yellow("\n\n[SHUTDOWN] Keyboard interrupt received")
    finally:
        ColorPrint.blue("[SHUTDOWN] Shutting down server...")
        server.shutdown()
        server.server_close()
        ColorPrint.green("[SHUTDOWN] Server stopped successfully")


if __name__ == "__main__":
    run_server()
