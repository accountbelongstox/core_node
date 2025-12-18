# -*- coding: utf-8 -*-
"""
Pycore Callmodule Configuration

Centralized configuration management following pycore standards.
"""

import os
import platform
from pathlib import Path

from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT


class Config:
    """Callmodule Configuration"""

    # ==================== Application Info ====================
    APP_NAME = "callmodule"
    APP_ID = "pycore_callmodule"
    APP_DISPLAY_NAME = "Pycore Module Caller"

    # ==================== Project Paths ====================
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pycore" / "callmodule"
    RESOURCES_DIR = APP_ROOT / "resources"

    # ==================== Frontend Configuration ====================
    # Frontend framework: Vite + React (pycore-management)
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore-management"
    FRONTEND_PORT = 3000  # Vite dev server port
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # Frontend modes:
    # - "dev": Hot reload development
    #   * Starts Vite dev server on port 3000
    #   * Frontend runs independently with hot reload
    #   * Backend (RPC v2) on port 59000 for API only
    #   * WebView (Windows) points to http://localhost:3000
    #
    # - "production": Production build
    #   * Compiles frontend to dist/ folder
    #   * RPC v2 serves static files at /
    #   * Single port (59000) for both frontend and backend
    #   * WebView (Windows) points to http://localhost:59000

    FRONTEND_MODE = "dev"  # Current mode: dev for hot reload debugging

    # Build control (production mode only)
    FRONTEND_SKIP_BUILD = False  # False: build when needed, True: use existing dist
    FRONTEND_FORCE_REBUILD = False  # True: always rebuild, False: normal behavior

    # ==================== Backend Configuration ====================
    RPC_HOST = "0.0.0.0"
    RPC_PORT = 59000  # RPC v2 HTTP API port

    # ==================== UI Configuration ====================
    # Platform detection
    IS_WINDOWS = platform.system() == 'Windows'
    IS_LINUX = platform.system() == 'Linux'

    # Window size (Windows only)
    WINDOW_WIDTH = 1400
    WINDOW_HEIGHT = 900

    # UI behavior
    SHOW_UI_ON_START = IS_WINDOWS  # Windows: show UI window, Linux: background mode
    ENABLE_TRAY = IS_WINDOWS  # Windows: system tray, Linux: no tray
    FRAMELESS = True  # Frameless window

    # ==================== Runtime Mode ====================
    MODE = os.getenv("CALLMODULE_MODE", "dev")  # dev | production

    @classmethod
    def is_dev_mode(cls) -> bool:
        """Check if running in development mode"""
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        """Check if running in production mode"""
        return cls.MODE == "production"

    # ==================== CORS Configuration ====================
    # Frontend runs on FRONTEND_PORT (dev: 3000 Vite, prod: 59000 RPC v2)
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{RPC_PORT}",
        f"http://127.0.0.1:{RPC_PORT}",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]


# Global configuration instance
config = Config()
