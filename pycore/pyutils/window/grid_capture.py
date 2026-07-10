#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Grid Capture

Window-region resolution + grid-based sub-region capture:
- get_window_region: resolve a window's (left, top, width, height, title) or full screen
- capture_grid_region: 9grid (3x3) and 18x18grid row/col band capture
- capture_grid_cell: arbitrary rows x cols single-cell capture
- is_rect_minimized_or_offscreen: off-screen rect detection (shared with facade)

One-directional dependency: imports screen_capture (native grab + monitor size),
window_finder (cache-backed search), and the WindowActivator instance passed in by
the facade. NEVER imports back into screenshot.py (avoids circular import).
"""

import time
from typing import List, Optional, Tuple

from pycore.pyfoundations.third_party import get_third_package_win32gui

win32gui = get_third_package_win32gui()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window.screen_capture import (
    capture_screen_region,
    get_primary_monitor_size,
)

# Off-screen rect threshold (Windows uses ~-32000 for minimized windows)
_OFFSCREEN_THRESHOLD = -30000


def is_rect_minimized_or_offscreen(rect: Tuple[int, int, int, int]) -> bool:
    """True if rect is off-screen (e.g. minimized window)."""
    if not rect or len(rect) < 4:
        return True
    left, top = rect[0], rect[1]
    return left < _OFFSCREEN_THRESHOLD or top < _OFFSCREEN_THRESHOLD


def get_window_region(
    titles: Optional[List[str]],
    match_mode: str,
    window_activator,
    use_cache: bool,
    skip_browser_if
) -> Optional[Tuple[int, int, int, int, Optional[str]]]:
    """
    Get window region coordinates (left, top, width, height, title).

    Args:
        titles: Window titles to search for (None for full screen)
        match_mode: Title matching mode forwarded to WindowFinder
        window_activator: WindowActivator instance (for restore/activate of minimized windows)
        use_cache: Use cached window list
        skip_browser_if: Browser-skip callable forwarded to WindowFinder

    Returns:
        Tuple of (left, top, width, height, title) or None if window not found.
        title is None in full-screen mode.
    """
    try:
        if titles:
            windows = WindowFinder.find_windows_by_titles(
                titles=titles,
                match_mode=match_mode,
                use_cache=use_cache,
                skip_browser_if=skip_browser_if
            )

            if not windows:
                ColorPrint.print_min_interval(f"[WindowRegion] No windows found matching: {titles}", "1min", "yellow")
                return None

            window_info = windows[0]
            hwnd = window_info["hwnd"]
            title = window_info["title"]
            rect = window_info["rect"]
            if win32gui.IsIconic(hwnd) or is_rect_minimized_or_offscreen(rect):
                ColorPrint.print_min_interval(f"[WindowRegion] Window minimized/off-screen, activating: '{title}'", "1min", "blue")
                if not window_activator.activate_window_by_handle(hwnd):
                    ColorPrint.print_min_interval(f"[WindowRegion] Proceeding after activation attempt", "1min", "yellow")
                time.sleep(1)
                try:
                    rect = win32gui.GetWindowRect(hwnd)
                    window_info["rect"] = rect
                except Exception as e:
                    ColorPrint.print_min_interval(f"[WindowRegion] Could not refresh rect: {e}", "1min", "yellow")
            left, top, right, bottom = rect
            width = right - left
            height = bottom - top
            ColorPrint.print_min_interval(f"[WindowRegion] Found window: '{title}' ({width}x{height})", "1min", "gray")
            return (left, top, width, height, title)
        else:
            # Full screen mode
            size = get_primary_monitor_size()
            if not size:
                return None
            width, height = size
            left, top = 0, 0
            ColorPrint.print_min_interval(f"[WindowRegion] Using full screen: {width}x{height}", "1min", "gray")
            return (left, top, width, height, None)

    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] Failed to get window region: {e}", "1min", "red")
        return None


def capture_grid_region(
    titles: Optional[List[str]],
    grid_type: str,
    grid_index: Optional[int],
    row_range: Optional[Tuple[int, int]],
    col_range: Optional[Tuple[int, int]],
    match_mode: str,
    window_activator,
    use_cache: bool,
    skip_browser_if
) -> Optional["object"]:
    """
    Capture a specific grid region of a window.

    Args:
        titles: Window titles to search for (None for full screen)
        grid_type: '9grid' (3x3) or '18x18grid' (18x18)
        grid_index: Grid index for 9grid mode (0-8)
        row_range: Row range for 18x18grid mode (start, end) inclusive
        col_range: Column range for 18x18grid mode (start, end) inclusive
        match_mode: Title matching mode forwarded to WindowFinder
        window_activator: WindowActivator instance
        use_cache: Use cached window list
        skip_browser_if: Browser-skip callable forwarded to WindowFinder

    Returns:
        PIL Image of the region or None if failed
    """
    try:
        # Step 1: Get window region using common method
        region_info = get_window_region(titles, match_mode, window_activator, use_cache, skip_browser_if)
        if not region_info:
            return None

        left, top, width, height, title = region_info
        ColorPrint.print_min_interval(f"[GridCapture] Capturing {grid_type} from window: '{title or 'fullscreen'}'", "1min", "blue")

        if grid_type == '9grid':
            if grid_index is None:
                ColorPrint.print_min_interval("[ERROR] grid_index required for 9grid mode", "1min", "red")
                return None

            if not 0 <= grid_index <= 8:
                ColorPrint.print_min_interval(f"[ERROR] grid_index must be 0-8, got {grid_index}", "1min", "red")
                return None

            # Calculate 3x3 grid
            grid_width = width // 3
            grid_height = height // 3

            grid_row = grid_index // 3
            grid_col = grid_index % 3

            region_left = left + grid_col * grid_width
            region_top = top + grid_row * grid_height
            region_right = region_left + grid_width
            region_bottom = region_top + grid_height

            ColorPrint.print_min_interval(f"[9Grid] Capturing grid {grid_index} at ({region_left},{region_top},{region_right},{region_bottom})", "1min", "blue")

        elif grid_type == '18x18grid':
            if row_range is None and col_range is None:
                ColorPrint.red("[ERROR] row_range or col_range required for 18x18grid mode")
                return None

            # Calculate 18x18 grid cell size
            cell_width = width // 18
            cell_height = height // 18

            if row_range:
                start_row, end_row = row_range
                region_top = top + start_row * cell_height
                region_bottom = top + (end_row + 1) * cell_height
                region_left = left
                region_right = left + width
                ColorPrint.print_min_interval(f"[18x18Grid] Capturing rows {start_row}-{end_row}", "1min", "blue")

            elif col_range:
                start_col, end_col = col_range
                region_left = left + start_col * cell_width
                region_right = left + (end_col + 1) * cell_width
                region_top = top
                region_bottom = top + height
                ColorPrint.print_min_interval(f"[18x18Grid] Capturing cols {start_col}-{end_col}", "1min", "blue")

        else:
            ColorPrint.print_min_interval(f"[ERROR] Unknown grid_type: {grid_type}", "1min", "red")
            return None

        # Capture the region (native rect grab via screen_capture)
        img = capture_screen_region(
            region_left,
            region_top,
            region_right - region_left,
            region_bottom - region_top
        )
        if img is None:
            return None

        ColorPrint.print_min_interval(f"[SUCCESS] Captured grid region: {img.size}", "1min", "green")
        return img

    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] Failed to capture grid region: {e}", "1min", "red")
        return None


def capture_grid_cell(
    cell_row: int,
    cell_col: int,
    titles: Optional[List[str]],
    grid_rows: int,
    grid_cols: int,
    match_mode: str,
    window_activator,
    use_cache: bool,
    skip_browser_if
) -> Optional["object"]:
    """
    Capture a single cell from multi-row multi-column grid.

    Args:
        cell_row: Row index (zero-based)
        cell_col: Column index (zero-based)
        titles: Window titles to search for (None for full screen)
        grid_rows: Total number of rows
        grid_cols: Total number of columns
        match_mode: Title matching mode forwarded to WindowFinder
        window_activator: WindowActivator instance
        use_cache: Use cached window list
        skip_browser_if: Browser-skip callable forwarded to WindowFinder

    Returns:
        PIL Image of the cell or None
    """
    try:
        max_row = grid_rows - 1
        max_col = grid_cols - 1

        if not (0 <= cell_row <= max_row and 0 <= cell_col <= max_col):
            ColorPrint.print_min_interval(f"[ERROR] Cell indices must be zero to {max_row}, got row={cell_row}, col={cell_col}", "1min", "red")
            return None

        # Get window region using common method
        region_info = get_window_region(titles, match_mode, window_activator, use_cache, skip_browser_if)
        if not region_info:
            return None

        left, top, width, height, title = region_info

        cell_width = width // grid_cols
        cell_height = height // grid_rows

        region_left = left + cell_col * cell_width
        region_top = top + cell_row * cell_height

        # Capture the cell (native rect grab via screen_capture)
        img = capture_screen_region(region_left, region_top, cell_width, cell_height)
        if img is None:
            return None

        ColorPrint.print_min_interval(f"[GridCell] Captured cell ({cell_row},{cell_col}) from {grid_rows}x{grid_cols} grid: {img.size}", "1min", "gray")
        return img

    except Exception as e:
        ColorPrint.print_min_interval(f"[ERROR] Failed to capture grid cell ({cell_row},{cell_col}): {e}", "1min", "red")
        return None
