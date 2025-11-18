#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Launcher - MCP Service Launcher with Heartbeat and Singleton Support

Purpose: Launch MCP service with heartbeat thread management
Uses pylauncher for singleton detection and heartbeat startup.

Architecture:
- Uses pycore.pylauncher for singleton detection (main thread responsibility)
- Launches heartbeat thread (default enabled in ServiceConfig)
- MCP service runs as singleton instance
- Shutdown existing instance mode supported via shutdown_existing parameter

Usage:
    from pycore.pyctl.mcpctl.mcp_launcher import launch_mcp_service

    # Launch MCP service (singleton mode with heartbeat)
    launch_mcp_service()

    # Launch with shutdown of existing instance
    launch_mcp_service(shutdown_existing=True)
"""

import os
import sys
from typing import Optional

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import launch_services, ServiceConfig


# ============================================================
# MCP Singleton Port Configuration (MCP-Specific)
# ============================================================
# Port ranges for MCP singleton detection
# Sub-applications can override by passing custom port ranges

MCP_SINGLETON_PORT_START = 58000       # MCP singleton port range
MCP_SINGLETON_PORT_RANGE = 100         # 58000-58099
MCP_SINGLETON_APP_ID = "pycore_mcp_proxy"  # App identifier

# MCP HTTP server port range (for FastMCP HTTP servers)
MCP_HTTP_SERVER_PORT_START = 58100    # FastMCP HTTP server port
MCP_HTTP_SERVER_PORT_RANGE = 100      # 58100-58199


def launch_mcp_service(
    shutdown_existing: bool = True,  # DEFAULT: Shutdown existing instance
    app_id: Optional[str] = None,
    port_start: Optional[int] = None,
    port_range: Optional[int] = None,
    heartbeat_enabled: bool = True  # Heartbeat enabled by default
) -> bool:
    """
    Launch MCP Service with Singleton Detection and Heartbeat

    IMPORTANT: Uses pycore.pylauncher for singleton and heartbeat management
    - launcher.py is the main thread
    - Heartbeat runs by default (ServiceConfig.enable_heartbeat=True)
    - Singleton detection happens at launcher layer
    - shutdown_existing=True means notify previous instance to exit

    Port Configuration:
    - Default uses MCP_SINGLETON_PORT_START (58000-58099)
    - Can override with custom port_start/port_range for independent instances

    Args:
        shutdown_existing: If True, send SHUTDOWN to existing instance (DEFAULT)
        app_id: Application ID (default: MCP_SINGLETON_APP_ID)
        port_start: Starting port (default: MCP_SINGLETON_PORT_START)
        port_range: Port range size (default: MCP_SINGLETON_PORT_RANGE)
        heartbeat_enabled: Enable heartbeat thread (default: True)

    Returns:
        True if launched successfully, False if existing instance found

    Example:
        # Launch with shutdown of existing (default)
        launch_mcp_service()

        # Launch without shutting down existing (will exit if found)
        launch_mcp_service(shutdown_existing=False)
    """
    ColorPrint.green("=" * 70)
    ColorPrint.green("MCP Service Launcher (with Heartbeat)")
    ColorPrint.green("=" * 70)

    # Use global defaults if not overridden
    _app_id = app_id or MCP_SINGLETON_APP_ID
    _port_start = port_start or MCP_SINGLETON_PORT_START
    _port_range = port_range or MCP_SINGLETON_PORT_RANGE

    # Create service configuration
    # NOTE: No MCP-specific config in ServiceConfig
    # MCP configuration is handled here in mcpctl layer
    config = ServiceConfig(
        app_id=_app_id,
        app_name=f"MCP Service ({_app_id})",
        enable_ui=False,              # No UI for MCP service
        enable_rpc=False,             # No RPC (MCP has its own protocol)
        enable_speech=False,          # No speech
        enable_heartbeat=heartbeat_enabled,  # Heartbeat enabled by default
        port_start=_port_start,
        port_range=_port_range,
        singleton_check=True,         # ENABLE singleton detection
        force_launch=False            # Respect existing instances
    )

    ColorPrint.blue(f"[MCP Launcher] Configuration:")
    ColorPrint.blue(f"  App ID: {config.app_id}")
    ColorPrint.blue(f"  Port Range: {config.port_start}-{config.port_start + config.port_range - 1}")
    ColorPrint.blue(f"  Singleton Check: {config.singleton_check}")
    ColorPrint.blue(f"  Shutdown Existing: {shutdown_existing}")
    ColorPrint.blue(f"  Heartbeat Enabled: {config.enable_heartbeat}")

    # Register shutdown handler for graceful exit
    def on_shutdown_request(event_data):
        """Handle shutdown request from THREAD_BUS"""
        ColorPrint.yellow(f"\n[MCP Service] Shutdown requested: {event_data}")
        ColorPrint.yellow("[MCP Service] Cleaning up...")
        # Future: Stop MCP HTTP server here
        # Future: Cleanup resources
        ColorPrint.green("[MCP Service] Shutdown complete")
        sys.exit(0)

    THREAD_BUS.register_event_handler('global.shutdown.requested', on_shutdown_request, priority=10)

    # Delegate to launcher.py (main thread)
    # launcher.py handles:
    # - Singleton detection
    # - Heartbeat thread startup
    # - Shutdown coordination
    instances = launch_services(
        config=config,
        shutdown_existing=shutdown_existing
    )

    # Check if we successfully became PRIMARY
    if instances.singleton_detector:
        port = instances.singleton_detector.get_port()
        ColorPrint.green("=" * 70)
        ColorPrint.green(f"[SUCCESS] MCP Service launched on port {port}")
        if instances.heartbeat_system:
            ColorPrint.green(f"[SUCCESS] Heartbeat system running")
        ColorPrint.green("=" * 70)

        # Keep service running and monitor shutdown signal
        ColorPrint.yellow("\nMCP Service running...")
        ColorPrint.yellow("Press Ctrl+C to stop\n")

        try:
            import time
            while True:
                # Check for shutdown request from THREAD_BUS
                if THREAD_BUS.is_shutdown_requested():
                    reason = THREAD_BUS.get_shutdown_reason()
                    ColorPrint.yellow(f"\n[MCP Service] Shutdown requested: {reason}")
                    break

                time.sleep(1)
        except KeyboardInterrupt:
            ColorPrint.blue("\n\n[MCP Service] Shutting down (Ctrl+C)...")

        # Cleanup
        from pycore.pylauncher import stop_services
        stop_services(instances)
        ColorPrint.green("[MCP Service] Stopped")

        return True
    else:
        ColorPrint.yellow("=" * 70)
        ColorPrint.yellow("MCP Service NOT launched")
        ColorPrint.yellow("Reason: Existing instance found or no available ports")
        ColorPrint.yellow("=" * 70)
        return False


# ============================================================
# CLI Entry Point (for testing)
# ============================================================

def main():
    """CLI entry point for testing MCP service launcher"""
    import argparse

    parser = argparse.ArgumentParser(description="MCP Service Launcher with Heartbeat")
    parser.add_argument(
        "--no-shutdown-existing",
        action="store_true",
        help="Do NOT shutdown existing instance (default: shutdown existing)"
    )
    parser.add_argument(
        "--no-heartbeat",
        action="store_true",
        help="Disable heartbeat system"
    )
    parser.add_argument(
        "--app-id",
        type=str,
        help="Custom application ID"
    )
    parser.add_argument(
        "--port-start",
        type=int,
        help="Custom starting port"
    )
    parser.add_argument(
        "--port-range",
        type=int,
        default=100,
        help="Custom port range (default: 100)"
    )

    args = parser.parse_args()

    # By default, shutdown_existing=True (opposite of the flag)
    shutdown_existing = not args.no_shutdown_existing

    success = launch_mcp_service(
        shutdown_existing=shutdown_existing,
        heartbeat_enabled=not args.no_heartbeat,
        app_id=args.app_id,
        port_start=args.port_start,
        port_range=args.port_range if args.port_start else None
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
