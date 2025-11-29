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

# Mount static directory for subtitle UI assets (CSS, JS)
SUBTITLE_UI_DIR = Path(__file__).parent.parent.parent / "pyctl" / "voice_subtitle" / "ui"
if SUBTITLE_UI_DIR.exists():
    # This will be mounted by the server setup
    pass


@router.get("/subtitle")
async def get_subtitle_ui():
    """
    Redirect to new voice subtitle framework

    Returns:
        RedirectResponse: Redirect to /voice-subtitle/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to new framework at /voice-subtitle/index.html")
    return RedirectResponse(url="/voice-subtitle/index.html", status_code=302)


