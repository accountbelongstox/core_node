#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrcpy Web Test - Application Entry Point

Entry point for pymain.py launcher system.
Launches the HTTP/WebSocket server for device management and video streaming.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import server module
from pyapps.scrcpy_web_test.server import create_app
from aiohttp import web


def main():
    """
    Main entry point for scrcpy_web_test application

    Starts the HTTP/WebSocket server on port 27880
    """
    print("=" * 70)
    print("Scrcpy Web Test Server")
    print("=" * 70)
    print(f"Server starting on http://localhost:27880")
    print(f"WebSocket endpoint: ws://localhost:27880/ws")
    print(f"API endpoint: http://localhost:27880/api/devices")
    print("=" * 70)

    app = create_app()
    web.run_app(app, host='0.0.0.0', port=27880)


def start():
    """Alias for main() - supports both entry point patterns"""
    main()


if __name__ == '__main__':
    main()
