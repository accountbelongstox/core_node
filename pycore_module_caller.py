#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Entry Point

Launches Pycore Module Caller with platform-aware configuration.

Architecture:
- callmodule/: Builds configuration and registers event handlers
- pylauncher/: Handles singleton detection and service launching
- pythreadpool/: Starts actual service threads

Usage:
    python pycore_module_caller.py                        # Default (0.0.0.0:59000)
    python pycore_module_caller.py --host 0.0.0.0 --port 8000
    python pycore_module_caller.py --debug
"""

import sys
import signal
import time
from pathlib import Path

PYCORE_ROOT = Path(__file__).parent
sys.path.insert(0, str(PYCORE_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import ServiceLauncher
from pycore.callmodule.config import build_launcher_config, update_tray_menu_with_singleton
from pycore.callmodule.event_handlers import register_event_handlers


def main(host='0.0.0.0', port=59000, debug=False):
    """
    Main entry point

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Starting")
    ColorPrint.blue("=" * 70)

    # 1. Build configuration (callmodule layer - only config, no threads)
    config = build_launcher_config(host=host, port=port, debug=debug)

    # 2. Start services (pylauncher layer - singleton + service launching)
    launcher = ServiceLauncher(config)
    if not launcher.start():
        ColorPrint.yellow("[Main] Failed to start (singleton conflict or error)")
        return

    # Get singleton port
    singleton_port = launcher.detection_result.port if launcher.detection_result else None

    ColorPrint.green(f"[Main] Services started successfully")
    if singleton_port:
        ColorPrint.blue(f"[Main] Singleton Port: {singleton_port}")

    # 3. Register event handlers (callmodule layer - event handlers via THREAD_BUS)
    register_event_handlers(launcher, port)

    # 4. Update tray menu with singleton port (callmodule layer - config update)
    if singleton_port:
        update_tray_menu_with_singleton(launcher, port, singleton_port)

    ColorPrint.green("=" * 70)
    ColorPrint.green(f"[Main] RPC v2: http://localhost:{port}/")
    if singleton_port:
        ColorPrint.green(f"[Main] Singleton: {singleton_port}")
    ColorPrint.green("=" * 70)

    # 6. Setup signal handler for Ctrl+C
    def signal_handler(signum, frame):
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow("\n[Main] Keyboard interrupt (Ctrl+C)")
            THREAD_BUS.request_shutdown(reason="Keyboard interrupt", execute_handlers=True)
        else:
            ColorPrint.yellow("\n[Main] Already shutting down, please wait...")

    signal.signal(signal.SIGINT, signal_handler)

    # 7. Wait for shutdown signal (THREAD_BUS is the event center)
    ColorPrint.blue("[Main] Running... (Press Ctrl+C or use tray to exit)")

    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(0.5)

    ColorPrint.blue("[Main] Shutdown signal received")
    ColorPrint.blue("[Main] Shutting down all services...")
    launcher.stop()
    ColorPrint.green("[Main] Shutdown complete")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Pycore Module Caller")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind (default: 59000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()
    main(host=args.host, port=args.port, debug=args.debug)
