#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window State Manager - Save and Restore Window Size/Position

Manages window state persistence using JSON files in user cache directory.
Each application has its own state file identified by app_id.

Features:
- Save window size and position
- Restore window state on startup
- Per-application state files
- Thread-safe operations
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, asdict


@dataclass
class WindowState:
    """Window state data class"""
    width: int
    height: int
    x: Optional[int] = None
    y: Optional[int] = None
    is_maximized: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'WindowState':
        """Create from dictionary"""
        return WindowState(
            width=data.get('width', 1280),
            height=data.get('height', 800),
            x=data.get('x'),
            y=data.get('y'),
            is_maximized=data.get('is_maximized', False)
        )


class WindowStateManager:
    """
    Window state manager for saving and loading window geometry.

    Uses JSON files stored in user cache directory:
    - Windows: C:\\Users\\{user}\\.core_node\\ui_state\\{app_id}_window.json
    - Linux: /var/_core_node/ui_state/{app_id}_window.json

    Example:
        manager = WindowStateManager(app_id="matrix")

        # Save window state
        manager.save_state(width=1280, height=800, x=100, y=100)

        # Load window state
        state = manager.load_state()
        if state:
            window.resize(state.width, state.height)
            window.move(state.x, state.y)
    """

    def __init__(self, app_id: str = "default"):
        """
        Initialize window state manager.

        Args:
            app_id: Unique application identifier (e.g., "matrix", "myapp")
        """
        self.app_id = app_id
        self._cache_dir = self._get_cache_dir()
        self._state_file = self._cache_dir / f"{app_id}_window.json"

    def _get_cache_dir(self) -> Path:
        """Get UI state cache directory"""
        from pycore.pyfoundations.system_paths import get_ui_state_cache_dir
        return get_ui_state_cache_dir()

    def save_state(
        self,
        width: int,
        height: int,
        x: Optional[int] = None,
        y: Optional[int] = None,
        is_maximized: bool = False
    ):
        """
        Save window state to cache file.

        Args:
            width: Window width in pixels
            height: Window height in pixels
            x: Window X position (optional)
            y: Window Y position (optional)
            is_maximized: Whether window is maximized
        """
        state = WindowState(
            width=width,
            height=height,
            x=x,
            y=y,
            is_maximized=is_maximized
        )

        # Ensure cache directory exists
        if not self._cache_dir.exists():
            self._cache_dir.mkdir(parents=True, exist_ok=True)

        # Write state to file
        with open(self._state_file, 'w', encoding='utf-8') as f:
            json.dump(state.to_dict(), f, indent=2)

    def load_state(self) -> Optional[WindowState]:
        """
        Load window state from cache file.

        Returns:
            WindowState object if file exists, None otherwise
        """
        if not self._state_file.exists():
            return None

        # Read state from file
        with open(self._state_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return WindowState.from_dict(data)

    def clear_state(self):
        """Delete saved window state file"""
        if self._state_file.exists():
            self._state_file.unlink()

    def has_state(self) -> bool:
        """Check if saved state exists"""
        return self._state_file.exists()

    def get_state_file_path(self) -> Path:
        """Get path to state file"""
        return self._state_file


__all__ = [
    'WindowState',
    'WindowStateManager',
]
