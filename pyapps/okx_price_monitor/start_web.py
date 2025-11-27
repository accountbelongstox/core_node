#!/usr/bin/env python3
"""
OKX Price Monitor - Web Server Launcher
Quick start script for web interface
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pyapps.okx_price_monitor.web_server import OKXWebServer

def main():
    """Launch web server"""
    ColorPrint.green("=" * 70)
    ColorPrint.green("Starting OKX Price Monitor Web Interface")
    ColorPrint.green("=" * 70)
    print()

    ColorPrint.yellow("⚠️  Note: Coin data manager is not initialized in standalone mode")
    ColorPrint.yellow("⚠️  For full functionality, integrate with main application")
    print()

    ColorPrint.blue("Server will start on port 58888")
    ColorPrint.blue("Browser will open automatically in 2 seconds...")
    print()

    web_server = OKXWebServer(coin_data_manager=None)
    web_server.start()

if __name__ == "__main__":
    main()
