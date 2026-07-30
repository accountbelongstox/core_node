# -*- coding: utf-8 -*-
"""Static asset loader for the standalone Code Sync control panel."""

from pathlib import Path
from typing import Optional, Tuple


PUBLIC_DIR = Path(__file__).resolve().parent / "public" / "code_sync"
PANEL_INDEX_FILE = PUBLIC_DIR / "index.html"
PANEL_ASSET_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}


def load_panel_index() -> bytes:
    return PANEL_INDEX_FILE.read_bytes()


def load_panel_asset(name: str) -> Optional[Tuple[bytes, str]]:
    normalized = Path(str(name or "")).name
    path = PUBLIC_DIR / normalized
    content_type = PANEL_ASSET_TYPES.get(path.suffix.lower())
    if not normalized or content_type is None or not path.is_file():
        return None
    return path.read_bytes(), content_type


__all__ = ["load_panel_asset", "load_panel_index"]
