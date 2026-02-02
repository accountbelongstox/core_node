#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot category constants and cleanup manager.
Classifies screenshot directories; cleans files older than a given age per category.
"""

import time
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import (
    TMP_DIR,
    SCALED_TEMPLATES_CACHE_DIR,
    LOGIN_TRY_SCREENSHOT_DIR,
    D4_SCREENSHOT_DIR,
    D4_ANNOTATED_DIR,
    MATCH_DEBUG_DIR,
    PATHFINDING_DIR,
    DEBUG_CAPTURE_DIR,
    UI_ANNOTATED_DIR,
    VALIDATION_DIR,
    DEFAULT_CLEANUP_MAX_AGE_SECONDS,
)

SCREENSHOT_CATEGORIES: Dict[str, Path] = {
    "login_try": LOGIN_TRY_SCREENSHOT_DIR,
    "d4_screenshots": D4_SCREENSHOT_DIR,
    "d4_annotated": D4_ANNOTATED_DIR,
    "match_debug": MATCH_DEBUG_DIR,
    "pathfinding": PATHFINDING_DIR,
    "debug_capture": DEBUG_CAPTURE_DIR,
    "ui_annotated": UI_ANNOTATED_DIR,
    "validation": VALIDATION_DIR,
    "scaled_templates": SCALED_TEMPLATES_CACHE_DIR,
}


class ScreenshotCategoryManager:
    """
    Manages screenshot category directories and cleans old files.
    After each screenshot save, call clean_older_than(category) to remove files older than 1 minute.
    """

    def __init__(self, categories: Optional[Dict[str, Path]] = None):
        self._categories = dict(categories or SCREENSHOT_CATEGORIES)

    def get_dir(self, category: str) -> Optional[Path]:
        """Return the directory path for a category, or None if unknown."""
        path = self._categories.get(category)
        if path is None:
            return None
        return Path(path)

    def register_category(self, name: str, path: Path) -> None:
        """Register an additional category (e.g. from another module)."""
        self._categories[name] = Path(path)

    def clean_older_than(
        self,
        category: str,
        max_age_seconds: float = DEFAULT_CLEANUP_MAX_AGE_SECONDS,
    ) -> int:
        """
        Delete files in the category directory that are older than max_age_seconds.
        Returns the number of files deleted. Does not recurse into subdirs.
        """
        dir_path = self.get_dir(category)
        if dir_path is None or not dir_path.exists():
            return 0
        now = time.time()
        cutoff = now - max_age_seconds
        deleted = 0
        try:
            for f in dir_path.iterdir():
                if not f.is_file():
                    continue
                try:
                    if f.stat().st_mtime < cutoff:
                        f.unlink()
                        deleted += 1
                except OSError as e:
                    ColorPrint.yellow(f"[ScreenshotCategoryManager] Failed to delete {f}: {e}")
        except OSError as e:
            ColorPrint.yellow(f"[ScreenshotCategoryManager] Failed to list {dir_path}: {e}")
        if deleted:
            ColorPrint.gray(f"[ScreenshotCategoryManager] {category}: removed {deleted} file(s) older than {max_age_seconds}s")
        return deleted

    def clean_all(
        self,
        max_age_seconds: float = DEFAULT_CLEANUP_MAX_AGE_SECONDS,
    ) -> Dict[str, int]:
        """
        Clean all registered category directories; remove files older than max_age_seconds.
        Returns dict category -> number of files deleted.
        """
        result = {}
        for name in self._categories:
            result[name] = self.clean_older_than(name, max_age_seconds)
        return result


_default_manager: Optional[ScreenshotCategoryManager] = None


def get_screenshot_category_manager() -> ScreenshotCategoryManager:
    """Return the global ScreenshotCategoryManager instance (singleton)."""
    global _default_manager
    if _default_manager is None:
        _default_manager = ScreenshotCategoryManager()
    return _default_manager
