"""Backend Controller

Manages FastAPI backend lifecycle for Matrix application
"""

import threading
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint


class BackendController:
    """
    Backend Controller

    Manages FastAPI backend lifecycle:
    - Start uvicorn server
    - Device management (ADB)
    - API endpoints
    - WebSocket connections
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8000,
        mode: str = "dev"
    ):
        """
        Initialize backend controller

        Args:
            host: Server host
            port: Server port
            mode: Runtime mode (dev/production)
        """
        self.host = host
        self.port = port
        self.mode = mode

        # State
        self.running = False
        self.server_thread: Optional[threading.Thread] = None

    def _check_adb(self) -> bool:
        """Check ADB availability"""
        from pyapps.matrix.config import Config

        ColorPrint.blue("[BackendController] Checking ADB availability...")

        try:
            adb_path = Config.get_adb_path()
            ColorPrint.green(f"[SUCCESS] ADB ready: {adb_path}")
            return True
        except Exception as e:
            ColorPrint.yellow(f"[WARNING] ADB check failed: {e}")
            return False

    def _start_server(self):
        """Start FastAPI server (blocking)"""
        import uvicorn
        from pyapps.matrix.main import app

        ColorPrint.green(f"[BackendController] Starting FastAPI server...")
        ColorPrint.green(f"  Host: {self.host}:{self.port}")
        ColorPrint.green(f"  Mode: {self.mode}")

        try:
            # Check ADB before starting
            self._check_adb()

            # Start uvicorn
            uvicorn.run(
                app,
                host=self.host,
                port=self.port,
                log_level="info"
            )

        except Exception as e:
            ColorPrint.red(f"[BackendController] Server error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.running = False

    def start(self):
        """Start backend server"""
        if self.running:
            ColorPrint.yellow("[BackendController] Already running")
            return

        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" MATRIX BACKEND STARTUP")
        ColorPrint.blue("=" * 70)
        ColorPrint.green(f"  Host: {self.host}")
        ColorPrint.green(f"  Port: {self.port}")
        ColorPrint.green(f"  Mode: {self.mode}")
        ColorPrint.green(f"  API Docs: http://{self.host}:{self.port}/docs")
        ColorPrint.blue("=" * 70)
        ColorPrint.white("")

        self.running = True

        # Start server in thread
        self.server_thread = threading.Thread(
            target=self._start_server,
            name="Matrix-Backend",
            daemon=True
        )
        self.server_thread.start()

        ColorPrint.green("[BackendController] Backend started in thread")

    def stop(self):
        """Stop backend server"""
        if not self.running:
            return

        ColorPrint.yellow("[BackendController] Stopping backend...")
        self.running = False

        # Note: uvicorn doesn't stop gracefully from threads
        # Server will stop when main process exits
        ColorPrint.green("[BackendController] Backend stopped")

    def is_running(self) -> bool:
        """Check if backend is running"""
        return self.running

    def get_api_url(self) -> str:
        """Get API base URL"""
        return f"http://{self.host}:{self.port}"

    def get_docs_url(self) -> str:
        """Get API documentation URL"""
        return f"http://{self.host}:{self.port}/docs"
