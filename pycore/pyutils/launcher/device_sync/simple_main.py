# -*- coding: utf-8 -*-
"""
Simple Main Entry Point - Simplified Device Sync

Architecture:
- global_config: Shared configuration object
- simple_primary_server: PRIMARY HTTP server (independent)
- simple_client: SECONDARY sync client (independent)
- simple_tray_menu: UI only (no business logic)

All components share global_config for state management.
"""

import sys
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.device_sync.core.config import (
    init_global_config,
    get_global_config,
    DEFAULT_HTTP_PORT,
    DEFAULT_ROOT_DIR
)
from pycore.pyutils.launcher.device_sync.simple_tray_menu import SimpleTrayMenu


def main():
    """Main entry point for simplified device sync"""
    # Get root directory from default constant
    # Resolve relative to this file's location
    current_file = Path(__file__).resolve()
    root_dir = (current_file.parent / DEFAULT_ROOT_DIR).resolve()

    if not root_dir.exists():
        ColorPrint.plain(f"Error: Directory does not exist: {root_dir}")
        ColorPrint.plain(f"Note: Default root directory is {DEFAULT_ROOT_DIR} (relative to device_sync module)")
        sys.exit(1)

    ColorPrint.info("=" * 70)
    ColorPrint.info("Device Sync - Simplified Architecture")
    ColorPrint.info("=" * 70)
    ColorPrint.info(f"Root directory: {root_dir}")
    ColorPrint.info(f"HTTP port: {DEFAULT_HTTP_PORT} (preset)")
    ColorPrint.info("")

    # Initialize global configuration with preset values
    config = init_global_config(str(root_dir), DEFAULT_HTTP_PORT)

    ColorPrint.info("Configuration initialized:")
    ColorPrint.info(f"  Device ID: {config.device_id}")
    ColorPrint.info(f"  Hostname: {config.hostname}")
    ColorPrint.info(f"  Port: {config.http_port}")
    ColorPrint.info("")

    # Start tray menu (blocking)
    try:
        tray = SimpleTrayMenu()
        tray.start()

    except KeyboardInterrupt:
        ColorPrint.info("Interrupted by user")
        sys.exit(0)

    except Exception as e:
        ColorPrint.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
