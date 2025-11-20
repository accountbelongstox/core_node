"""Matrix Service

Custom service for pylauncher integration
Manages both frontend and backend for Matrix application
"""

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint
from pyapps.matrix.controller.frontend_controller import FrontendController
from pyapps.matrix.controller.backend_controller import BackendController


@dataclass
class MatrixServiceConfig:
    """
    Matrix Service Configuration

    Combines frontend and backend configuration
    """
    # Project paths
    project_root: Optional[Path] = None

    # Frontend configuration
    frontend_port: int = 3007
    frontend_timeout: int = 120

    # Backend configuration
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_mode: str = "dev"

    # UI configuration (for webview)
    enable_ui: bool = True
    enable_tray: bool = True

    # Service control
    enabled: bool = True


class MatrixService:
    """
    Matrix Service

    Integrates Matrix application with pylauncher:
    - Manages frontend (Nuxt) lifecycle
    - Manages backend (FastAPI) lifecycle
    - Provides unified service interface
    - Integrates with native UI and system tray
    """

    def __init__(self, config: MatrixServiceConfig):
        """
        Initialize Matrix service

        Args:
            config: Matrix service configuration
        """
        self.config = config
        self.running = False

        # Controllers
        self.frontend = FrontendController(
            project_root=config.project_root,
            frontend_port=config.frontend_port
        )

        self.backend = BackendController(
            host=config.backend_host,
            port=config.backend_port,
            mode=config.backend_mode
        )

        ColorPrint.green("[MatrixService] Service initialized")

    def start(self):
        """
        Start Matrix service

        Starts frontend and backend in sequence:
        1. Start frontend (Nuxt dev server)
        2. Wait for frontend to be ready
        3. Start backend (FastAPI server)
        """
        if self.running:
            ColorPrint.yellow("[MatrixService] Already running")
            return

        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" MATRIX APPLICATION - STARTING")
        ColorPrint.blue("=" * 70)
        ColorPrint.white("")

        # Phase 1: Start Frontend
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" PHASE 1: STARTING FRONTEND")
        ColorPrint.blue("=" * 70)
        ColorPrint.white("")

        if not self.frontend.start_and_wait(timeout=self.config.frontend_timeout):
            ColorPrint.red("[MatrixService] Frontend startup failed")
            return

        ColorPrint.white("")

        # Phase 2: Start Backend
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" PHASE 2: STARTING BACKEND")
        ColorPrint.blue("=" * 70)
        ColorPrint.white("")

        self.backend.start()

        # Wait a moment for backend to initialize
        time.sleep(2)

        ColorPrint.white("")

        # Application Ready
        ColorPrint.green("=" * 70)
        ColorPrint.green(" MATRIX APPLICATION READY")
        ColorPrint.green("=" * 70)
        ColorPrint.green("")
        ColorPrint.green("Services running:")
        ColorPrint.green(f"  [FRONTEND] Nuxt Dev Server    -> {self.frontend.get_url()}")
        ColorPrint.green(f"  [BACKEND]  FastAPI Server     -> {self.backend.get_api_url()}")
        ColorPrint.green(f"  [DOCS]     API Documentation  -> {self.backend.get_docs_url()}")
        ColorPrint.green("")
        ColorPrint.green("=" * 70)
        ColorPrint.white("")

        self.running = True

    def stop(self):
        """Stop Matrix service"""
        if not self.running:
            return

        ColorPrint.yellow("[MatrixService] Stopping Matrix service...")

        # Stop backend first
        self.backend.stop()

        # Stop frontend
        self.frontend.stop()

        self.running = False
        ColorPrint.green("[MatrixService] Matrix service stopped")

    def is_running(self) -> bool:
        """Check if service is running"""
        return self.running

    def get_frontend_url(self) -> str:
        """Get frontend URL for webview"""
        return self.frontend.get_url()

    def get_status(self) -> dict:
        """Get service status"""
        return {
            'running': self.running,
            'frontend': {
                'running': self.frontend.is_running(),
                'ready': self.frontend.is_ready(),
                'url': self.frontend.get_url()
            },
            'backend': {
                'running': self.backend.is_running(),
                'api_url': self.backend.get_api_url(),
                'docs_url': self.backend.get_docs_url()
            }
        }


def matrix_service_entry(config: MatrixServiceConfig):
    """
    Matrix service entry point for pylauncher

    Args:
        config: Matrix service configuration

    Returns:
        MatrixService instance
    """
    ColorPrint.green("[MatrixServiceEntry] Starting Matrix service...")

    # Create service
    service = MatrixService(config)

    # Start service (this is blocking for the service thread)
    service.start()

    # Keep service thread alive
    try:
        while service.is_running():
            time.sleep(1)
    except Exception as e:
        ColorPrint.red(f"[MatrixServiceEntry] Service error: {e}")
    finally:
        service.stop()

    return service
