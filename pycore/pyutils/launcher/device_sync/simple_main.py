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

from .global_config import (
    init_global_config,
    get_global_config,
    DEFAULT_HTTP_PORT,
    DEFAULT_ROOT_DIR
)
from .simple_tray_menu import SimpleTrayMenu
from .logging_config import setup_logging

logger = setup_logging(__name__)


def main():
    """Main entry point for simplified device sync"""
    # Get root directory from default constant
    # Resolve relative to this file's location
    current_file = Path(__file__).resolve()
    root_dir = (current_file.parent / DEFAULT_ROOT_DIR).resolve()

    if not root_dir.exists():
        print(f"Error: Directory does not exist: {root_dir}")
        print(f"Note: Default root directory is {DEFAULT_ROOT_DIR} (relative to device_sync module)")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("Device Sync - Simplified Architecture")
    logger.info("=" * 70)
    logger.info(f"Root directory: {root_dir}")
    logger.info(f"HTTP port: {DEFAULT_HTTP_PORT} (preset)")
    logger.info("")

    # Initialize global configuration with preset values
    config = init_global_config(str(root_dir), DEFAULT_HTTP_PORT)

    logger.info("Configuration initialized:")
    logger.info(f"  Device ID: {config.device_id}")
    logger.info(f"  Hostname: {config.hostname}")
    logger.info(f"  Port: {config.http_port}")
    logger.info("")

    # Start tray menu (blocking)
    try:
        tray = SimpleTrayMenu()
        tray.start()

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
