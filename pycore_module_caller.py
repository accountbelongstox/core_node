#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Legacy Entry Point

This is a compatibility wrapper for systemd service and existing scripts.

Platform-specific behavior:
- Windows: System tray + singleton detection
- Linux: Service mode (systemd compatible)

For direct usage, use: python -m pycore.callmodule

Usage:
    python pycore_module_caller.py              # Platform-aware mode
    python pycore_module_caller.py --host 0.0.0.0 --port 8000
"""

import sys
from pathlib import Path

PYCORE_ROOT = Path(__file__).parent
sys.path.insert(0, str(PYCORE_ROOT))


def run_server(host='0.0.0.0', port=59000):
    """
    Run server with platform-aware launcher.

    Args:
        host: Host to bind to
        port: Port to bind to
    """
    from pycore.callmodule import launch_platform_aware
    launch_platform_aware(
        host=host,
        port=port,
        debug=False
    )


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Pycore Module Caller (Legacy Entry)")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind to')

    args = parser.parse_args()
    run_server(
        host=args.host,
        port=args.port
    )
