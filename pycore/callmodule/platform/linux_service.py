# -*- coding: utf-8 -*-
"""
Linux Service Mode Launcher

Runs RPC v2 server directly (systemd compatible).
"""

from pycore import ColorPrint
from .server_setup import start_rpc_server_blocking


def launch_linux_service(host='0.0.0.0', port=59000, debug=False, launcher=None, singleton_port=None):
    """
    Launch RPC v2 server in Linux service mode.

    IMPORTANT: This function does NOT perform singleton detection.
    Singleton detection is handled by ServiceLauncher in launch_platform_aware().

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
        launcher: ServiceLauncher instance (for singleton detector and lifecycle management)
        singleton_port: Singleton port (passed from launcher, for logging)
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Linux Service Mode (RPC v2)")
    ColorPrint.blue("=" * 70)

    if singleton_port is not None:
        ColorPrint.green(f"[Linux] Singleton port: {singleton_port}")

    # Start RPC v2 server (blocking)
    start_rpc_server_blocking(host=host, port=port, debug=debug)
