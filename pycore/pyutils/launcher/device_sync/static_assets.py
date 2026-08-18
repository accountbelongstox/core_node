# -*- coding: utf-8 -*-
"""Static asset serving for the device-sync dashboard."""

from pathlib import Path
from typing import Any

import pycore.pyutils.launcher.device_sync.routes as routes


PUBLIC_DIR = Path(__file__).resolve().parent / "public"
INDEX_FILE = PUBLIC_DIR / "index.html"
ASSET_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


def serve_device_sync_asset(handler: Any, request_path: str) -> bool:
    path = str(request_path or "")
    if path == routes.ROOT_PATH:
        file_path = INDEX_FILE
        content_type = "text/html; charset=utf-8"
    elif path.startswith(routes.ASSETS_PATH_PREFIX):
        name = Path(path[len(routes.ASSETS_PATH_PREFIX):]).name
        file_path = PUBLIC_DIR / name
        content_type = ASSET_TYPES.get(file_path.suffix.lower(), "")
        if not name or not content_type:
            return False
    else:
        return False
    if not file_path.is_file():
        return False
    content = file_path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(content)))
    handler.end_headers()
    handler.wfile.write(content)
    return True


__all__ = ["serve_device_sync_asset"]
