# -*- coding: utf-8 -*-
"""
FastAPI Application Factory
"""

from pathlib import Path
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()

from .routers import (
    # Management routers
    status_router,
    config_router,
    control_router,
    logs_router,
    capabilities_router,
    local_config_router,
    local_stats_router,
    local_test_router,
    # Legacy routers
    module_call_router,
    mcp_router,
    code_sync_router,
    notebooklm_stt_router
)
# Import new layer routers
from .routers.local import (
    screenshot_router,
    image_router,
    audio_router,
    file_router,
    video_router,
)
from .routers.upload import router as upload_router
from .routers.client import router as client_router
from .global_config import get_global_config

FastAPI = fastapi.FastAPI

# Import CORS middleware and StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application.

    Returns:
        FastAPI: Configured application instance
    """
    config = get_global_config()

    app = FastAPI(
        title="Pycore Module Caller",
        description="Dynamic HTTP API for calling pycore modules",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount static files for desktop UI
    DESKTOP_UI_DIR = Path(__file__).parent.parent / "pyctl" / "desktop" / "ui"
    if DESKTOP_UI_DIR.exists():
        app.mount("/desktop", StaticFiles(directory=str(DESKTOP_UI_DIR), html=True), name="desktop")
        print(f"[App] Mounted desktop UI at /desktop -> {DESKTOP_UI_DIR}")

    # Register routers
    # Management layer routers (NEW)
    app.include_router(status_router)
    app.include_router(config_router)
    app.include_router(control_router)
    app.include_router(logs_router)
    app.include_router(capabilities_router)
    app.include_router(local_config_router)
    app.include_router(local_stats_router)
    app.include_router(local_test_router)

    # Local processing layer routers
    app.include_router(screenshot_router)
    app.include_router(image_router)
    app.include_router(audio_router)
    app.include_router(file_router)
    app.include_router(video_router)

    # Upload layer router
    app.include_router(upload_router)

    # Client layer router
    app.include_router(client_router)

    # Legacy routers (still active)
    app.include_router(module_call_router)
    app.include_router(mcp_router)  # MCP backend integrated routes
    app.include_router(code_sync_router)  # Code sync routes
    app.include_router(notebooklm_stt_router)  # NotebookLM STT auto-convert routes

    @app.on_event("startup")
    async def startup_event():
        """Startup event handler"""
        config.server_running = True
        config.update_network_info()
        print("=" * 60)
        print("Pycore Module Caller FastAPI Server Started")
        print("=" * 60)
        print(f"Dashboard:     http://{config.host}:{config.http_port}/docs")
        print(f"Health check:  http://{config.host}:{config.http_port}/health")
        print(f"API endpoint:  POST http://{config.host}:{config.http_port}/api/call")
        print(f"MCP Backend:   POST http://{config.host}:{config.http_port}/mcp/*")
        print(f"Singleton Ctl: POST http://{config.host}:{config.http_port}/singleton/*")
        print("=" * 60)

    @app.on_event("shutdown")
    async def shutdown_event():
        """Shutdown event handler"""
        config.server_running = False
        print("Shutting down server...")

    return app
