#!/usr/bin/env python3
"""
Scrcpy WebGL Test - Main Entry Point

WebGL-based Android device screen streaming using YUV420P video format.

Usage:
    python pymain.py app=scrcpy_webgl_test          # Launch with PySide6 WebView
    python pymain.py app=scrcpy_webgl_test web      # Web-only mode (no WebView)
"""

import sys
import threading
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pyapps.scrcpy_webgl_test.scrcpy_webgl_test_config import Config


def main():
    """Main entry point for Scrcpy WebGL Test"""

    ColorPrint.green('=' * 70)
    ColorPrint.green(f'{Config.APP_DISPLAY_NAME}')
    ColorPrint.green('=' * 70)
    ColorPrint.blue(f'Server starting on http://{Config.WEB_HOST}:{Config.WEB_PORT}')
    ColorPrint.blue(f'WebSocket endpoint: ws://{Config.WEB_HOST}:{Config.WEB_PORT}/ws')
    ColorPrint.blue(f'API endpoint: http://{Config.WEB_HOST}:{Config.WEB_PORT}/api/devices')
    ColorPrint.green('=' * 70)
    ColorPrint.yellow('Features:')
    print('  - H.264 -> YUV420P decoding (PyAV/FFmpeg)')
    print('  - WebGL YUV rendering (BT.709 color space)')
    print('  - Touch control support')
    print('  - Multi-device streaming')
    print('  - PySide6 WebView integration')
    ColorPrint.green('=' * 70)
    print()

    # Check if running in web-only mode
    web_only = 'web' in sys.argv

    if web_only:
        # Web-only mode: just start the server
        ColorPrint.yellow('Running in web-only mode (no WebView)')
        print()
        from pyapps.scrcpy_webgl_test.server import start_server
        start_server()
    else:
        # Start server in background thread
        ColorPrint.yellow('Starting server in background...')
        from pyapps.scrcpy_webgl_test.server import start_server

        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        # Wait for server to start
        ColorPrint.yellow('Waiting for server to be ready...')
        time.sleep(2)

        # Launch PySide6 WebView
        ColorPrint.green('Launching PySide6 WebView...')
        print()
        from pyapps.scrcpy_webgl_test.webview_launcher import launch_webview

        sys.exit(launch_webview())


def start():
    """Alias for main() - used by pylauncher"""
    main()


if __name__ == '__main__':
    main()
