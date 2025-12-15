#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Frontend Configuration

Frontend-specific configuration for the OKX Price Monitor application.
"""

from pathlib import Path


class OKXFrontendConfig:
    """
    OKX Frontend Configuration

    Manages frontend build and deployment settings.
    """

    # ==================== Frontend Configuration ====================
    # Frontend framework: Vite + React (okx_price_monitor)

    # Get project root (3 levels up from this file)
    PROJECT_ROOT = Path(__file__).parent.parent.parent

    # Frontend directory
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "okx_price_monitor"

    # Frontend port (different from backend)
    FRONTEND_PORT = 58889  # OKX frontend port

    # Frontend URL
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # Frontend modes:
    # - "dev": Hot reload development
    #   * Starts Vite dev server on port 58889
    #   * Frontend runs independently with hot reload
    #   * Backend (RPC v2) on port 58888 for API only
    #   * WebView points to http://localhost:58889
    #
    # - "production": Production build
    #   * Compiles frontend to dist/ folder
    #   * RPC v2 serves static files at /
    #   * Single port (58888) for both frontend and backend
    #   * WebView points to http://localhost:58888
    #
    # SWITCH HERE to change mode:
    FRONTEND_MODE = "dev"  # "dev" or "production"

    # Build control (production mode only)
    FRONTEND_SKIP_BUILD = False  # False: build when needed, True: use existing dist
    FRONTEND_FORCE_REBUILD = False  # True: always rebuild, False: normal behavior

    # Static files directory (production mode)
    STATIC_DIR = PROJECT_ROOT / "pyapps" / "okx_price_monitor" / "static"

    # Auto-install npm dependencies
    FRONTEND_AUTO_INSTALL = True

    @classmethod
    def get_window_url(cls):
        """
        Get the URL for the WebView window

        Returns:
            str: URL to load in WebView
        """
        if cls.FRONTEND_MODE == "dev":
            # Dev mode: point to Vite dev server
            return f"http://localhost:{cls.FRONTEND_PORT}"
        else:
            # Production mode: point to backend serving static files
            from pyapps.okx_price_monitor.core.monitor_config import monitor_config
            return f"http://localhost:{monitor_config.WEB_PORT}"

    @classmethod
    def print_info(cls):
        """Print frontend configuration info"""
        from pycore import ColorPrint

        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" OKX FRONTEND CONFIGURATION")
        ColorPrint.blue("=" * 70)
        ColorPrint.green(f"  Mode: {cls.FRONTEND_MODE}")
        ColorPrint.green(f"  Frontend Dir: {cls.FRONTEND_DIR}")

        if cls.FRONTEND_MODE == "dev":
            ColorPrint.green(f"  Frontend Port: {cls.FRONTEND_PORT}")
            ColorPrint.green(f"  Frontend URL: {cls.FRONTEND_URL}")
            ColorPrint.yellow("  Note: Vite dev server will start automatically")
        else:
            ColorPrint.green(f"  Build Mode: {'Skip' if cls.FRONTEND_SKIP_BUILD else 'Auto'}")
            ColorPrint.green(f"  Force Rebuild: {cls.FRONTEND_FORCE_REBUILD}")
            ColorPrint.yellow("  Note: Static files will be served from backend")

        ColorPrint.green(f"  Window URL: {cls.get_window_url()}")
        ColorPrint.blue("=" * 70)


# Global config instance
frontend_config = OKXFrontendConfig()
