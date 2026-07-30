# -*- coding: utf-8 -*-
"""
Unified Main Entry Point - Device Sync with Unified HTTP Server

Architecture:
- global_config: Shared configuration object
- unified_http_server: Always-running HTTP server (mode-aware)
- network_scanner: Auto-discovery of PRIMARY servers (SECONDARY mode only)
- tray_menu: UI for mode switching (no restart needed)

HTTP server starts immediately and never stops.
Mode switching is handled via global_config flags.
"""

import sys
import traceback
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task

from pycore.pyutils.launcher.device_sync.core.config import (
    init_global_config,
    get_global_config,
    DEFAULT_HTTP_PORT,
    DEFAULT_ROOT_DIR
)
from pycore.pyutils.launcher.device_sync.server.unified import UnifiedHTTPServer
from pycore.pyutils.launcher.device_sync.core.scanner import get_network_scanner
from pycore.pyutils.launcher.device_sync.ui.tray import SimpleTrayMenu


def main():
    """Main entry point for device sync with unified HTTP server"""
    # Get root directory from default constant
    current_file = Path(__file__).resolve()
    device_sync_dir = current_file.parent.parent
    root_dir = (device_sync_dir / DEFAULT_ROOT_DIR).resolve()

    if not root_dir.exists():
        ColorPrint.plain(f"Error: Directory does not exist: {root_dir}")
        ColorPrint.plain(f"Note: Default root directory is {DEFAULT_ROOT_DIR} (relative to device_sync module)")
        sys.exit(1)

    ColorPrint.info("=" * 70)
    ColorPrint.info("Device Sync - Unified Architecture")
    ColorPrint.info("=" * 70)
    ColorPrint.info(f"Root directory: {root_dir}")
    ColorPrint.info(f"HTTP port: {DEFAULT_HTTP_PORT} (preset)")
    ColorPrint.info("")

    # Initialize global configuration
    config = init_global_config(str(root_dir), DEFAULT_HTTP_PORT)

    ColorPrint.info("Configuration initialized:")
    ColorPrint.info(f"  Device ID: {config.device_id}")
    ColorPrint.info(f"  Hostname: {config.hostname}")
    ColorPrint.info(f"  Port: {config.http_port}")
    ColorPrint.info(f"  Default mode: SECONDARY")
    ColorPrint.info("")

    # Create unified HTTP server
    server = UnifiedHTTPServer()

    # Start HTTP server in separate thread (this is the ONLY thread we create)
    # It runs for the entire app lifecycle
    ColorPrint.info("Starting unified HTTP server...")
    server.start()

    server_thread = start_bus_task(
        server.serve_forever,
        thread_name="UnifiedHTTPServerThread",
    )

    # Get network scanner
    scanner = get_network_scanner()

    # Do initial network scan (SECONDARY mode only)
    ColorPrint.info("Performing initial network scan...")
    scanner.scan_if_needed(force=True)

    # Start tray menu (blocking)
    try:
        ColorPrint.info("Creating SimpleTrayMenu instance...")
        tray = SimpleTrayMenu(server, scanner)
        ColorPrint.info("SimpleTrayMenu instance created, calling start()...")

        tray.start()

        ColorPrint.info("Tray menu start() returned (should not happen - blocking call)")

    except KeyboardInterrupt:
        ColorPrint.info("Interrupted by user (Ctrl+C)")

    except Exception as e:
        ColorPrint.error(f"FATAL ERROR in main: {e}")
        ColorPrint.error(traceback.format_exc())

    finally:
        # Cleanup
        ColorPrint.info("Cleanup: stopping server...")
        server.stop()
        ColorPrint.info("Exiting...")
        sys.exit(0)


if __name__ == '__main__':
    main()
