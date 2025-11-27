#!/usr/bin/env python3
"""
OKX Price Monitor - Web Server
Web interface for monitoring cryptocurrency prices and statistics

Uses pycore.pyutils.rpc_v2 for routing and API endpoints
"""

import sys
import platform
import subprocess
import threading
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
from pyapps.okx_price_monitor.lib.coin_data_manager import CoinDataManager
from pyapps.okx_price_monitor.lib.config import config


class OKXWebServer:
    """OKX Price Monitor Web Server"""

    def __init__(self, coin_data_manager=None):
        self.coin_data_manager = coin_data_manager

        self.server = FastAPIRPCServer({
            "host": "0.0.0.0",
            "port": config.WEB_PORT if hasattr(config, 'WEB_PORT') else 58888,
            "debug": True
        })

        # Register API routes first
        self._register_routes()

        # Mount static files last (acts as fallback for unmatched routes)
        self._setup_static_files()

    def _setup_static_files(self):
        """Setup static file directories"""
        web_dir = Path(__file__).parent / "web"

        if not web_dir.exists():
            ColorPrint.yellow(f"[OKXWebServer] Web directory not found: {web_dir}")
            return

        # Mount static files using FastAPI StaticFiles with html=True
        from fastapi.staticfiles import StaticFiles

        # Mount web directory at root with html support
        self.server.app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
        ColorPrint.green(f"[OKXWebServer] Mounted web directory: {web_dir}")

    def _register_routes(self):
        """Register API routes"""

        # API: Get all coin statistics
        self.server.route(
            "api/coins/stats",
            self.get_coins_stats,
            sync=True,
            description="Get statistics for all tracked coins"
        )

        # API: Get specific coin summary
        self.server.route(
            "api/coins/summary",
            self.get_coin_summary,
            sync=True,
            description="Get detailed summary for a specific coin"
        )

        # API: Get all summaries
        self.server.route(
            "api/coins/summaries",
            self.get_all_summaries,
            sync=True,
            description="Get summaries for all coins"
        )

        # API: Get server status
        self.server.route(
            "api/status",
            self.get_server_status,
            sync=True,
            description="Get server status and configuration"
        )

        # API: Get price changes
        self.server.route(
            "api/coins/changes",
            self.get_price_changes,
            sync=True,
            description="Get price changes for all coins"
        )

        ColorPrint.green("[OKXWebServer] Registered API routes")

    # ===== Route Handlers =====

    def get_coins_stats(self, params: dict):
        """Get basic statistics about tracked coins"""
        if not self.coin_data_manager or not self.coin_data_manager.is_initialized():
            return {
                "success": False,
                "error": "Coin data manager not initialized",
                "data": None
            }

        return {
            "success": True,
            "data": {
                "total_coins": self.coin_data_manager.get_coin_count(),
                "database_name": self.coin_data_manager.database_name,
                "history_hours": self.coin_data_manager.history_hours,
                "initialized": self.coin_data_manager.is_initialized()
            }
        }

    def get_coin_summary(self, params: dict):
        """Get detailed summary for a specific coin"""
        coin_symbol = params.get("coin_symbol")

        if not coin_symbol:
            return {
                "success": False,
                "error": "coin_symbol parameter required",
                "data": None
            }

        if not self.coin_data_manager or not self.coin_data_manager.is_initialized():
            return {
                "success": False,
                "error": "Coin data manager not initialized",
                "data": None
            }

        summary = self.coin_data_manager.get_coin_summary(coin_symbol)

        if not summary:
            return {
                "success": False,
                "error": f"Coin {coin_symbol} not found",
                "data": None
            }

        return {
            "success": True,
            "data": summary
        }

    def get_all_summaries(self, params: dict):
        """Get summaries for all coins"""
        if not self.coin_data_manager or not self.coin_data_manager.is_initialized():
            return {
                "success": False,
                "error": "Coin data manager not initialized",
                "data": []
            }

        summaries = self.coin_data_manager.get_all_summaries()

        return {
            "success": True,
            "data": summaries
        }

    def get_server_status(self, params: dict):
        """Get server status and configuration"""
        return {
            "success": True,
            "data": {
                "service": "OKX Price Monitor Web Server",
                "version": "1.0.0",
                "host": self.server.host,
                "port": self.server.port,
                "routes": self.server.routes_manager.get_all_routes(),
                "coin_manager_initialized": self.coin_data_manager is not None and self.coin_data_manager.is_initialized()
            }
        }

    def get_price_changes(self, params: dict):
        """Get price changes for all coins"""
        if not self.coin_data_manager or not self.coin_data_manager.is_initialized():
            return {
                "success": False,
                "error": "Coin data manager not initialized",
                "data": {}
            }

        changes = self.coin_data_manager.get_all_price_changes()

        return {
            "success": True,
            "data": changes
        }

    def start(self):
        """Start the web server"""
        ColorPrint.green("=" * 70)
        ColorPrint.green("OKX Price Monitor - Web Server")
        ColorPrint.green("=" * 70)
        print()
        ColorPrint.blue(f"Web Interface:  http://localhost:{self.server.port}/")
        ColorPrint.blue(f"API Endpoint:   http://localhost:{self.server.port}/rpc/{{route}}")
        ColorPrint.blue(f"Available Routes:")
        for route in self.server.routes_manager.get_all_routes():
            ColorPrint.blue(f"  - {route}")
        print()
        ColorPrint.green("=" * 70)
        print()

        # Open browser after server starts
        self._open_browser_delayed()

        import uvicorn
        uvicorn.run(
            self.server.app,
            host=self.server.host,
            port=self.server.port,
            log_level="info"
        )

    def _open_browser_delayed(self):
        """Open browser after a short delay to ensure server is ready"""
        def open_browser():
            # Wait for server to start
            time.sleep(2)

            url = f"http://localhost:{self.server.port}/"
            system_name = platform.system()

            try:
                if system_name == "Windows":
                    # Windows: use explorer or default browser
                    ColorPrint.blue(f"[Browser] Opening {url} in default browser...")
                    subprocess.run(['cmd', '/c', 'start', url], check=False)

                elif system_name == "Linux":
                    # Linux: try xdg-open, otherwise show instructions
                    try:
                        ColorPrint.blue(f"[Browser] Opening {url} with xdg-open...")
                        subprocess.run(['xdg-open', url], check=False)
                    except FileNotFoundError:
                        ColorPrint.yellow("[Browser] xdg-open not found")
                        ColorPrint.yellow(f"[Browser] Please open manually: {url}")

                elif system_name == "Darwin":
                    # macOS: use open
                    ColorPrint.blue(f"[Browser] Opening {url} in default browser...")
                    subprocess.run(['open', url], check=False)

                else:
                    ColorPrint.yellow(f"[Browser] Unknown OS: {system_name}")
                    ColorPrint.yellow(f"[Browser] Please open manually: {url}")

            except Exception as e:
                ColorPrint.yellow(f"[Browser] Failed to open browser: {e}")
                ColorPrint.yellow(f"[Browser] Please open manually: {url}")

        # Start in background thread
        threading.Thread(target=open_browser, daemon=True).start()


def main():
    """Main entry point for standalone web server"""
    ColorPrint.yellow("[OKXWebServer] Starting standalone web server...")
    ColorPrint.yellow("[OKXWebServer] Note: Coin data manager not initialized in standalone mode")

    web_server = OKXWebServer(coin_data_manager=None)
    web_server.start()


if __name__ == "__main__":
    main()
