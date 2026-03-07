#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Grid Screenshot Collector
Captures grid-based screenshots from game window. Supports nine-grid and eighteen by eighteen grid modes.
Singleton via get_grid_screenshot_collector(); do not instantiate elsewhere.
"""

# Standard library imports
import os
import sys
from typing import Optional, Tuple


from pycore.pyfoundations.third_party import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Third-party imports
from pycore.pyfoundations.color_print import ColorPrint
from d3utils.screenshot_provider import get_window_screenshot

# Local imports
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from providor.constants.common import GRID_ROWS, GRID_COLS

class GridScreenshotCollector:
    """
    Grid Screenshot Collector

    Captures grid-based screenshots from game window.
    Uses WindowScreenshot from public library for actual screenshot capture.

    Supports:
    - Nine-grid mode (three by three grid, indices zero to eight)
    - Eighteen by eighteen grid mode (three hundred twenty-four cells)
    - Row/column range capture
    - Single cell capture
    """

    def __init__(self):
        """Initialize grid screenshot collector (uses shared singleton)"""
        self.screenshot_manager = get_window_screenshot()
        ColorPrint.green("[GridScreenshotCollector] Initialized")

    def capture_grid_region(
        self,
        grid_type: str = 'nine_grid',
        grid_index: Optional[int] = None,
        row_range: Optional[Tuple[int, int]] = None,
        col_range: Optional[Tuple[int, int]] = None,
        window_titles: Optional[list] = None,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a specific grid region from game window

        Args:
            grid_type: 'nine_grid' (three by three) or 'eighteen_grid' (eighteen by eighteen)
            grid_index: Grid index for nine_grid mode (zero to eight)
            row_range: Row range for eighteen_grid mode (start, end) inclusive
            col_range: Column range for eighteen_grid mode (start, end) inclusive
            window_titles: Window titles to search (default: Diablo III titles)
            use_cache: Use cached window list

        Returns:
            PIL Image of the grid region or None if failed
        """
        if window_titles is None:
            window_titles = DIABLO_III_WINDOW_TITLES

        ColorPrint.blue(f"[GridCollector] Capturing grid region: {grid_type}")

        # Map grid_type to internal format
        internal_grid_type = '9grid' if grid_type == 'nine_grid' else '18x18grid'

        return self.screenshot_manager.capture_window_grid_region(
            titles=window_titles,
            grid_type=internal_grid_type,
            grid_index=grid_index,
            row_range=row_range,
            col_range=col_range,
            use_cache=use_cache
        )

    def capture_grid_cell(
        self,
        cell_row: int,
        cell_col: int,
        grid_rows: int = None,
        grid_cols: int = None,
        window_titles: Optional[list] = None,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a single cell from multi-row multi-column grid

        Args:
            cell_row: Row index (zero-based)
            cell_col: Column index (zero-based)
            grid_rows: Total number of rows (default: from config)
            grid_cols: Total number of columns (default: from config)
            window_titles: Window titles to search (default: Diablo III titles)
            use_cache: Use cached window list

        Returns:
            PIL Image of the cell or None if failed
        """
        if window_titles is None:
            window_titles = DIABLO_III_WINDOW_TITLES

        # Use config defaults if not specified
        if grid_rows is None:
            grid_rows = GRID_ROWS
        if grid_cols is None:
            grid_cols = GRID_COLS

        return self.screenshot_manager.capture_window_grid_cell(
            cell_row=cell_row,
            cell_col=cell_col,
            titles=window_titles,
            grid_rows=grid_rows,
            grid_cols=grid_cols,
            use_cache=use_cache
        )

    def get_cell_center_position(
        self,
        cell_row: int,
        cell_col: int,
        grid_rows: int = None,
        grid_cols: int = None,
        window_titles: Optional[list] = None,
        use_cache: bool = True
    ) -> Optional[Tuple[int, int]]:
        """
        Get the center position (screen coordinates) of a grid cell

        Args:
            cell_row: Row index (zero-based)
            cell_col: Column index (zero-based)
            grid_rows: Total number of rows (default: from config)
            grid_cols: Total number of columns (default: from config)
            window_titles: Window titles to search (default: Diablo III titles)
            use_cache: Use cached window list

        Returns:
            Tuple of (x, y) screen coordinates or None if failed
        """
        if window_titles is None:
            window_titles = DIABLO_III_WINDOW_TITLES

        # Use config defaults if not specified
        if grid_rows is None:
            grid_rows = GRID_ROWS
        if grid_cols is None:
            grid_cols = GRID_COLS

        # Get window region first
        region_info = self.screenshot_manager._get_window_region(window_titles, use_cache)
        if not region_info:
            return None

        left, top, width, height, title = region_info

        # Calculate cell dimensions
        cell_width = width // grid_cols
        cell_height = height // grid_rows

        # Calculate cell center
        center_x = left + (cell_col * cell_width) + (cell_width // 2)
        center_y = top + (cell_row * cell_height) + (cell_height // 2)

        ColorPrint.gray(f"[GridCollector] Cell ({cell_row},{cell_col}) center: ({center_x},{center_y})")
        return (center_x, center_y)


_grid_screenshot_collector_instance: Optional[GridScreenshotCollector] = None


def get_grid_screenshot_collector() -> GridScreenshotCollector:
    """Return the global GridScreenshotCollector instance (singleton)."""
    global _grid_screenshot_collector_instance
    if _grid_screenshot_collector_instance is None:
        _grid_screenshot_collector_instance = GridScreenshotCollector()
    return _grid_screenshot_collector_instance

