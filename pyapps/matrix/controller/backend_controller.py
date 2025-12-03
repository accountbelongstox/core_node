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
        self.app = None  # Will be set when server starts
        self.static_mounted = False

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

        # Save app reference for later static mounting
        self.app = app

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

    def mount_static(self, static_dir: Path) -> bool:
        """
        Mount static files to FastAPI

        This allows the backend to serve frontend static files
        in production mode (unified port deployment)

        Args:
            static_dir: Directory containing static files

        Returns:
            True if mounted successfully
        """
        if self.static_mounted:
            ColorPrint.yellow("[BackendController] Static files already mounted")
            return True

        if not static_dir.exists():
            ColorPrint.red(f"[BackendController] Static directory not found: {static_dir}")
            return False

        try:
            from fastapi.staticfiles import StaticFiles

            # Get app reference
            if self.app is None:
                from pyapps.matrix.main import app
                self.app = app

            # Mount static files at root path with HTML fallback
            # This allows SPA routing to work correctly
            self.app.mount(
                "/",
                StaticFiles(directory=str(static_dir), html=True),
                name="frontend"
            )

            self.static_mounted = True

            ColorPrint.green("=" * 79)
            ColorPrint.green(" STATIC FILES MOUNTED")
            ColorPrint.green("=" * 79)
            ColorPrint.green(f"  Directory: {static_dir}")
            ColorPrint.green(f"  URL: http://{self.host}:{self.port}/")
            ColorPrint.green(f"  Mode: Unified Port (Backend + Frontend)")
            ColorPrint.green("=" * 79)
            ColorPrint.white("")

            return True

        except Exception as e:
            ColorPrint.red(f"[BackendController] Failed to mount static files: {e}")
            import traceback
            traceback.print_exc()
            return False
