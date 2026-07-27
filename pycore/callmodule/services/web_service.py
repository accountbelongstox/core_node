# -*- coding: utf-8 -*-
"""Web/static compatibility service for RPC."""

from __future__ import annotations

import base64
import platform
import sys
from pathlib import Path

FAVICON_PATH = Path(__file__).resolve().parents[2] / "static" / "favicon.ico"


def homepage() -> dict:
    return {
        "success": True,
        "service": "Pycore RPC Server",
        "version": "2.0.0",
        "status": "running",
    }


def get_api_info() -> dict:
    return {
        "success": True,
        "service": {"name": "Pycore RPC Server", "version": "2.0.0", "status": "running"},
        "system": {
            "platform": platform.system(),
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "architecture": platform.machine(),
        },
    }


def ping() -> dict:
    return {"success": True, "service": "Pycore RPC Server", "status": "running"}


def get_desktop_ui() -> dict:
    return {"success": True, "redirect": "/desktop/index.html"}


def get_subtitle_ui() -> dict:
    return {"success": True, "redirect": "/desktop/index.html"}


def get_favicon() -> dict:
    if not FAVICON_PATH.is_file():
        return {"success": False, "error": "Favicon not found"}
    data = FAVICON_PATH.read_bytes()
    return {
        "success": True,
        "mime": "image/x-icon",
        "content_base64": base64.b64encode(data).decode("ascii"),
        "bytes": len(data),
    }
