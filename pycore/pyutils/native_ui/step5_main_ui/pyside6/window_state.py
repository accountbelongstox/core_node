#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Per-app window geometry persisted as JSON in the shared UI-state cache directory."""

from dataclasses import asdict, dataclass
from typing import Optional

from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_ui_state_cache_dir

DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 800


@dataclass
class WindowGeometry:
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    x: Optional[int] = None
    y: Optional[int] = None
    is_maximized: bool = False


class WindowStateManager:
    """Save and restore one app's window geometry ({app_id}_window.json)."""

    def __init__(self, app_id: str = "default"):
        self.app_id = app_id
        self._store = AtomicJsonStore(get_ui_state_cache_dir() / f"{app_id}_window.json", dict)

    def save_state(
        self,
        width: int,
        height: int,
        x: Optional[int] = None,
        y: Optional[int] = None,
        is_maximized: bool = False,
    ) -> bool:
        geometry = WindowGeometry(width=width, height=height, x=x, y=y, is_maximized=is_maximized)
        try:
            self._store.write(asdict(geometry))
        except OSError as exc:
            ColorPrint.yellow(f"[WindowStateManager] save failed path={self._store.path}: {exc}")
            return False
        return True

    def load_state(self) -> Optional[WindowGeometry]:
        if not self._store.exists():
            return None
        try:
            data = self._store.read()
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[WindowStateManager] load failed path={self._store.path}: {exc}")
            return None
        return WindowGeometry(
            width=data.get('width', DEFAULT_WIDTH),
            height=data.get('height', DEFAULT_HEIGHT),
            x=data.get('x'),
            y=data.get('y'),
            is_maximized=data.get('is_maximized', False),
        )

    def has_state(self) -> bool:
        return self._store.exists()
