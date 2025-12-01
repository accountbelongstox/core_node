# -*- coding: utf-8 -*-
"""
Web UI Routes

Serves static HTML pages and assets for UI components.
"""

from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from pycore import ColorPrint

router = APIRouter(tags=["web"])

# Mount static directory for desktop UI assets (CSS, JS)
DESKTOP_UI_DIR = Path(__file__).parent.parent.parent / "pyctl" / "desktop" / "ui"
if DESKTOP_UI_DIR.exists():
    # This will be mounted by the server setup
    pass


@router.get("/")
async def homepage():
    """
    Homepage - Display API service information

    Returns:
        JSONResponse: Available API services and endpoints
    """
    return JSONResponse({
        "service": "Pycore RPC Server",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "api_info": {
                "method": "GET",
                "path": "/api/info",
                "description": "Get detailed API service information"
            },
            "desktop_ui": {
                "method": "GET",
                "path": "/desktop/index.html",
                "description": "Desktop Manager UI"
            },
            "rpc_call": {
                "method": "POST",
                "path": "/rpc/{route}",
                "description": "RPC method call"
            },
            "rpc_query": {
                "method": "GET",
                "path": "/rpc/query/{request_id}",
                "description": "Query RPC request result"
            },
            "rpc_routes": {
                "method": "GET",
                "path": "/rpc/routes",
                "description": "List all available RPC routes"
            },
            "websocket": {
                "method": "WS",
                "path": "/rpc/ws",
                "description": "WebSocket connection for real-time communication"
            }
        },
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc"
        }
    })


@router.get("/api/info")
async def get_api_info():
    """
    Get detailed API service information

    Returns:
        JSONResponse: Detailed service information
    """
    import platform
    import sys

    return JSONResponse({
        "service": {
            "name": "Pycore RPC Server",
            "version": "2.0.0",
            "status": "running"
        },
        "system": {
            "platform": platform.system(),
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "architecture": platform.machine()
        },
        "endpoints": {
            "rpc": {
                "POST /rpc/{route}": "Call RPC method",
                "GET /rpc/query/{request_id}": "Query request result",
                "GET /rpc/routes": "List all RPC routes",
                "WS /rpc/ws": "WebSocket connection"
            },
            "web": {
                "GET /": "API service information",
                "GET /api/info": "Detailed API info",
                "GET /desktop/index.html": "Desktop Manager UI",
                "GET /web/subtitle": "Voice subtitle UI (redirects to desktop)"
            }
        },
        "features": [
            "HTTP RPC calls",
            "WebSocket real-time communication",
            "Async/sync method support",
            "Request queuing and result caching",
            "Desktop UI manager"
        ]
    })


@router.get("/web")
async def get_desktop_ui():
    """
    Redirect to desktop manager

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


@router.get("/web/subtitle")
async def get_subtitle_ui():
    """
    Redirect to desktop manager (backward compatibility)

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


