# -*- coding: utf-8 -*-
"""
Web UI Routes

Serves static HTML pages and assets for UI components.
"""

from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from pycore import ColorPrint

router = APIRouter(prefix="/web", tags=["web"])

# Mount static directory for desktop UI assets (CSS, JS)
DESKTOP_UI_DIR = Path(__file__).parent.parent.parent / "pyctl" / "desktop" / "ui"
if DESKTOP_UI_DIR.exists():
    # This will be mounted by the server setup
    pass


@router.get("/")
async def get_desktop_ui():
    """
    Redirect to desktop manager

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


@router.get("/subtitle")
async def get_subtitle_ui():
    """
    Redirect to desktop manager (backward compatibility)

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


