# -*- coding: utf-8 -*-
"""
FastAPI Application Factory
"""

from pycore.pyfoundations.third_party import fastapi

from .routers import health_router, module_call_router, ocr_router
from .global_config import get_global_config

FastAPI = fastapi.FastAPI
CORSMiddleware = fastapi.middleware.cors.CORSMiddleware


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

    # Register routers
    app.include_router(health_router)
    app.include_router(module_call_router)
    app.include_router(ocr_router)

    @app.on_event("startup")
    async def startup_event():
        """Startup event handler"""
        config.server_running = True
        config.update_network_info()
        print("=" * 60)
        print("Pycore Module Caller FastAPI Server Started")
        print("=" * 60)
        print(f"Dashboard:    http://{config.host}:{config.http_port}/docs")
        print(f"Health check: http://{config.host}:{config.http_port}/health")
        print(f"API endpoint: POST http://{config.host}:{config.http_port}/api/call")
        print("=" * 60)

    @app.on_event("shutdown")
    async def shutdown_event():
        """Shutdown event handler"""
        config.server_running = False
        print("Shutting down server...")

    return app
