#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Standard Entry Point

Entry point for pymain.py launcher system.
Launches the FastAPI backend server for Android device management and control.

Usage:
    python pymain.py app=matrix
    python pymain.py app=matrix --host=0.0.0.0 --port=8000
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import argparse
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pycore import ColorPrint

# Configuration
from pyapps.matrix.config import Config

# API Routes
from pyapps.matrix.api import (
    config_router,
    device_router,
    health_router,
    ws_router,
    recording_router,
    screen_router,
    group_router,
    file_router
)

# Middleware
from pyapps.matrix.middleware import APILoggingMiddleware, PerformanceMonitoringMiddleware


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application

    Returns:
        Configured FastAPI application instance
    """
    app = FastAPI(
        title="Matrix API",
        description="Android Device Mirroring and Group Control System",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=Config.CORS_ALLOW_ORIGINS,
        allow_credentials=Config.CORS_ALLOW_CREDENTIALS,
        allow_methods=Config.CORS_ALLOW_METHODS,
        allow_headers=Config.CORS_ALLOW_HEADERS,
    )

    # Add logging and performance monitoring middleware
    app.add_middleware(APILoggingMiddleware)
    app.add_middleware(PerformanceMonitoringMiddleware)

    # Register routes
    app.include_router(health_router, prefix=Config.API_PREFIX)
    app.include_router(config_router, prefix=Config.API_PREFIX)
    app.include_router(device_router, prefix=Config.API_PREFIX)
    app.include_router(recording_router, prefix=Config.API_PREFIX)
    app.include_router(screen_router, prefix=Config.API_PREFIX)
    app.include_router(group_router, prefix=Config.API_PREFIX)
    app.include_router(file_router, prefix=Config.API_PREFIX)
    app.include_router(ws_router)  # WebSocket routes (no prefix)

    @app.on_event("startup")
    async def startup_event():
        """Startup initialization"""
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(" Matrix API Server - Starting")
        ColorPrint.blue("=" * 70)
        ColorPrint.green(f"  Mode: {Config.MODE}")
        ColorPrint.green(f"  Host: {Config.WEB_HOST}:{Config.WEB_PORT}")
        ColorPrint.green(f"  API Docs: http://{Config.WEB_HOST}:{Config.WEB_PORT}/docs")
        ColorPrint.green(f"  Frontend: {Config.FRONTEND_URL}")
        ColorPrint.blue("=" * 70)

        # ADB Auto Setup
        ColorPrint.yellow("\nChecking ADB availability...")

        from pyapps.matrix.adb_manager import ADBManager

        # Try auto setup
        manager = ADBManager(Config.RESOURCES_DIR)
        success, message, adb_path = manager.auto_setup_adb()

        if success and adb_path:
            # ADB available, check for devices
            devices = ADBManager.list_devices(adb_path)
            ColorPrint.green(f"\n✓ ADB is ready: {adb_path}")
            ColorPrint.green(f"✓ Connected devices: {len(devices)}")
            if devices:
                for i, device in enumerate(devices, 1):
                    ColorPrint.white(f"  {i}. {device}")
        else:
            ColorPrint.red(f"\n✗ ADB is not available: {message}")
            ColorPrint.yellow("⚠ Matrix will start but device features will be unavailable")
            ColorPrint.yellow("⚠ Please install ADB manually and restart")

        ColorPrint.green("\n✓ Matrix API Server startup complete")
        ColorPrint.blue("=" * 70)

    @app.on_event("shutdown")
    async def shutdown_event():
        """Shutdown cleanup"""
        ColorPrint.yellow("\nShutting down Matrix API Server...")

    return app


def start():
    """
    Standard entry point for pymain.py launcher

    Starts both frontend (Nuxt) and backend (FastAPI) servers
    """
    import asyncio
    import platform
    import threading
    import time

    from pyapps.matrix.frontend_launcher import launch_frontend_with_wait

    # Filter out app=xxx arguments from sys.argv (added by pymain.py launcher)
    original_argv = sys.argv.copy()
    sys.argv = [arg for arg in sys.argv if not arg.startswith('app=')]

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" Matrix - Full Stack Launcher")
    ColorPrint.blue("=" * 70)

    parser = argparse.ArgumentParser(description="Matrix - Android Device Control")
    parser.add_argument(
        "--host",
        default=Config.WEB_HOST,
        help="Server host address"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=Config.WEB_PORT,
        help="Server port"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Development mode (auto-reload)"
    )
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Start backend only (no frontend)"
    )

    args = parser.parse_args()

    # Backend-only mode
    if args.backend_only:
        ColorPrint.green(f"\nStarting backend server on {args.host}:{args.port}")
        ColorPrint.white(f"API Documentation: http://{args.host}:{args.port}/docs")
        ColorPrint.blue("=" * 70)

        uvicorn.run(
            "pyapps.matrix.matrix_main:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=args.reload
        )
        return

    # Full stack mode: Start both frontend and backend
    if platform.system() == 'Windows':
        # Windows: Launch frontend in separate console, then run backend in main thread
        ColorPrint.yellow("\n[Windows Mode] Starting frontend in separate console window...")

        # Launch frontend first (in separate console via temp script)
        async def launch():
            frontend_url = "http://localhost:3007"
            await launch_frontend_with_wait(
                project_root=PROJECT_ROOT,
                frontend_url=frontend_url,
                timeout=120
            )

        asyncio.run(launch())

        # Now run backend in main thread (blocking)
        ColorPrint.green("\n[Windows Mode] Starting backend in main thread...")
        ColorPrint.white(f"Backend API: http://{args.host}:{args.port}")
        ColorPrint.white(f"API Docs: http://{args.host}:{args.port}/docs")
        ColorPrint.white("Frontend: http://localhost:3007")
        ColorPrint.blue("=" * 70)

        uvicorn.run(
            "pyapps.matrix.matrix_main:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=args.reload
        )

    else:
        # Linux/Other: Use threading (original behavior)
        ColorPrint.yellow("\n[Linux Mode] Using threading for backend and frontend...")

        # Start backend server in a separate thread
        def start_backend():
            uvicorn.run(
                "pyapps.matrix.matrix_main:create_app",
                factory=True,
                host=args.host,
                port=args.port,
                reload=args.reload
            )

        backend_thread = threading.Thread(target=start_backend, daemon=False)
        backend_thread.start()

        # Give backend a moment to start
        time.sleep(2)

        # Launch frontend and wait for connection
        async def launch():
            frontend_url = "http://localhost:3007"
            await launch_frontend_with_wait(
                project_root=PROJECT_ROOT,
                frontend_url=frontend_url,
                timeout=120
            )

        ColorPrint.green("\n[Linux Mode] Starting frontend...")
        ColorPrint.white(f"Backend API: http://{args.host}:{args.port}")
        ColorPrint.white(f"API Docs: http://{args.host}:{args.port}/docs")
        ColorPrint.white("Frontend: http://localhost:3007")
        ColorPrint.blue("=" * 70)

        asyncio.run(launch())

        # Keep backend running
        backend_thread.join()

    # Restore original argv
    sys.argv = original_argv


def main():
    """Alias for start() - supports both entry point patterns"""
    start()


if __name__ == '__main__':
    main()
