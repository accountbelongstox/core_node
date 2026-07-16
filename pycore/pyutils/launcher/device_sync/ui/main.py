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
import threading
from pathlib import Path

from ..core.config import (
    init_global_config,
    get_global_config,
    DEFAULT_HTTP_PORT,
    DEFAULT_ROOT_DIR
)
from ..server.unified import UnifiedHTTPServer
from ..core.scanner import get_network_scanner
from .tray import SimpleTrayMenu
from ..core.logging import setup_logging

import traceback


logger = setup_logging(__name__)


def main():
    """Main entry point for device sync with unified HTTP server"""
    # Get root directory from default constant
    current_file = Path(__file__).resolve()
    device_sync_dir = current_file.parent.parent
    root_dir = (device_sync_dir / DEFAULT_ROOT_DIR).resolve()

    if not root_dir.exists():
        print(f"Error: Directory does not exist: {root_dir}")
        print(f"Note: Default root directory is {DEFAULT_ROOT_DIR} (relative to device_sync module)")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("Device Sync - Unified Architecture")
    logger.info("=" * 70)
    logger.info(f"Root directory: {root_dir}")
    logger.info(f"HTTP port: {DEFAULT_HTTP_PORT} (preset)")
    logger.info("")

    # Initialize global configuration
    config = init_global_config(str(root_dir), DEFAULT_HTTP_PORT)

    logger.info("Configuration initialized:")
    logger.info(f"  Device ID: {config.device_id}")
    logger.info(f"  Hostname: {config.hostname}")
    logger.info(f"  Port: {config.http_port}")
    logger.info(f"  Default mode: SECONDARY")
    logger.info("")

    # Create unified HTTP server
    server = UnifiedHTTPServer()

    # Start HTTP server in separate thread (this is the ONLY thread we create)
    # It runs for the entire app lifecycle
    logger.info("Starting unified HTTP server...")
    server.start()

    server_thread = threading.Thread(
        target=server.serve_forever,
        name="UnifiedHTTPServer",
        daemon=True
    )
    server_thread.start()

    # Get network scanner
    scanner = get_network_scanner()

    # Do initial network scan (SECONDARY mode only)
    logger.info("Performing initial network scan...")
    scanner.scan_if_needed(force=True)

    # Start tray menu (blocking)
    try:
        logger.info("Creating SimpleTrayMenu instance...")
        tray = SimpleTrayMenu(server, scanner)
        logger.info("SimpleTrayMenu instance created, calling start()...")

        tray.start()

        logger.info("Tray menu start() returned (should not happen - blocking call)")

    except KeyboardInterrupt:
        logger.info("Interrupted by user (Ctrl+C)")

    except Exception as e:
        logger.error(f"FATAL ERROR in main: {e}", exc_info=True)
        traceback.print_exc()

    finally:
        # Cleanup
        logger.info("Cleanup: stopping server...")
        server.stop()
        logger.info("Exiting...")
        sys.exit(0)


if __name__ == '__main__':
    main()
