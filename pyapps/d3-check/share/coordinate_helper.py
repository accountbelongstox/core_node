#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Helper
Unified coordinate calculation methods for D4 operations
"""

import random
from typing import Tuple, Optional
from share.game_interface_data import (
    get_d4_interface_data,
    calculate_unified_scaled_coordinate,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    # Window border and title bar constants
    TITLE_BAR_HEIGHT,
    TITLE_BAR_TOP_OFFSET,
    WINDOW_BORDER_LEFT,
    WINDOW_BORDER_RIGHT,
    WINDOW_BORDER_BOTTOM,
    CLICK_MARGIN_DEFAULT,
    CLICK_MARGIN_REGION
)


def calculate_screen_coordinate(
    game_coord: Tuple[int, int],
    use_standard_resolution: bool = True
) -> Tuple[int, int]:
    """
    Calculate screen coordinate from game coordinate

    Workflow:
    1. Get game window offset from shared data (window_offset)
    2. If coordinate is in standard resolution, scale it first
    3. Add window offset to get screen coordinate

    Args:
        game_coord: Coordinate in game window (standard or actual resolution)
        use_standard_resolution: True if coord is in standard resolution (1763x1126)

    Returns:
        Screen coordinate (absolute position on screen)
    """
    d4_data = get_d4_interface_data()

    # Get window offset and size from shared data
    window_offset_x, window_offset_y = d4_data.window_offset
    game_window_size = d4_data.game_window_size
    is_windowed = d4_data.is_windowed_mode()

    if not game_window_size:
        # No window size available, return coordinate as-is
        return game_coord

    # Step 1: Scale coordinate if needed
    if use_standard_resolution:
        # Convert from standard resolution to actual resolution
        scaled_coord = calculate_unified_scaled_coordinate(
            game_coord,
            game_window_size,
            (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
            is_windowed
        )
    else:
        # Already in actual resolution
        scaled_coord = game_coord

    # Step 2: Add window offset to get screen coordinate
    screen_x = scaled_coord[0] + window_offset_x
    screen_y = scaled_coord[1] + window_offset_y

    return (screen_x, screen_y)


def calculate_random_point_in_region(
    region_start: Tuple[int, int],
    region_end: Tuple[int, int],
    use_standard_resolution: bool = True,
    margin: Optional[int] = None
) -> Tuple[int, int]:
    """
    Calculate random screen coordinate within a region

    Args:
        region_start: Region top-left corner (game coordinate)
        region_end: Region bottom-right corner (game coordinate)
        use_standard_resolution: True if coords are in standard resolution
        margin: Margin from region edges in pixels (None = use CLICK_MARGIN_REGION constant)

    Returns:
        Random screen coordinate within region
    """
    # Use module-level constant if margin not specified
    if margin is None:
        margin = CLICK_MARGIN_REGION
    # Convert region to screen coordinates
    screen_start = calculate_screen_coordinate(region_start, use_standard_resolution)
    screen_end = calculate_screen_coordinate(region_end, use_standard_resolution)

    # Calculate random point with margin
    min_x = min(screen_start[0], screen_end[0]) + margin
    max_x = max(screen_start[0], screen_end[0]) - margin
    min_y = min(screen_start[1], screen_end[1]) + margin
    max_y = max(screen_start[1], screen_end[1]) - margin

    # Ensure valid range
    if min_x >= max_x:
        min_x, max_x = screen_start[0], screen_end[0]
    if min_y >= max_y:
        min_y, max_y = screen_start[1], screen_end[1]

    random_x = random.randint(min_x, max_x)
    random_y = random.randint(min_y, max_y)

    return (random_x, random_y)


def get_title_bar_random_point() -> Optional[Tuple[int, int]]:
    """
    Get random point in title bar for window activation

    Uses module-level constants from game_interface_data:
    - WINDOW_BORDER_LEFT, WINDOW_BORDER_RIGHT, WINDOW_BORDER_BOTTOM
    - TITLE_BAR_HEIGHT, TITLE_BAR_TOP_OFFSET
    - CLICK_MARGIN_DEFAULT

    NOTE: window_offset is the window OUTER frame position (includes borders)
    game_window_size is the OUTER window size (includes borders and title bar)

    Window structure (measured from actual D4 window):
    - Window GetWindowRect: offset (731, 17), size 1826x1031
    - Title bar clickable range: (740, 16) to (2550, 47)
    - Left border: 9px, Right border: 7px
    - Top offset: -1px (title bar starts above window rect)
    - Title bar height: 31px

    Returns:
        Random screen coordinate in title bar, or None if unavailable
    """
    d4_data = get_d4_interface_data()

    window_offset_x, window_offset_y = d4_data.window_offset
    game_window_size = d4_data.game_window_size

    if not game_window_size:
        return None

    window_width, window_height = game_window_size

    # Use module-level constants (no local redefinition)
    margin = CLICK_MARGIN_DEFAULT  # Use unified margin constant

    # Calculate title bar range in screen coordinates
    # Title bar starts at window_offset + TITLE_BAR_TOP_OFFSET
    title_left = window_offset_x + WINDOW_BORDER_LEFT + margin
    title_right = window_offset_x + window_width - WINDOW_BORDER_RIGHT - margin
    title_top = window_offset_y + TITLE_BAR_TOP_OFFSET + 5  # Small margin from top
    title_bottom = window_offset_y + TITLE_BAR_TOP_OFFSET + TITLE_BAR_HEIGHT - 5  # Small margin from bottom

    # Generate random point
    random_x = random.randint(title_left, title_right)
    random_y = random.randint(title_top, title_bottom)

    return (random_x, random_y)


def calculate_random_delay(min_ms: float = 100, max_ms: float = 500) -> float:
    """
    Calculate random delay in seconds

    Args:
        min_ms: Minimum delay in milliseconds
        max_ms: Maximum delay in milliseconds

    Returns:
        Random delay in seconds
    """
    return random.uniform(min_ms, max_ms) / 1000.0


def debug_show_title_bar_range():
    """
    Debug function to show title bar coordinate range
    Shows a message box with calculated title bar coordinates

    Uses module-level constants from game_interface_data
    """
    from tkinter import messagebox

    d4_data = get_d4_interface_data()

    window_offset_x, window_offset_y = d4_data.window_offset
    game_window_size = d4_data.game_window_size

    if not game_window_size:
        messagebox.showerror("Debug", "No game window size available!")
        return

    window_width, window_height = game_window_size

    # Use module-level constants (no local redefinition)
    margin = CLICK_MARGIN_DEFAULT

    # Calculate title bar range in screen coordinates
    title_left = window_offset_x + WINDOW_BORDER_LEFT + margin
    title_right = window_offset_x + window_width - WINDOW_BORDER_RIGHT - margin
    title_top = window_offset_y + TITLE_BAR_TOP_OFFSET + 5
    title_bottom = window_offset_y + TITLE_BAR_TOP_OFFSET + TITLE_BAR_HEIGHT - 5

    debug_info = f"""
=== Title Bar Coordinate Debug ===

Window Info:
  Offset: ({window_offset_x}, {window_offset_y})
  Size: {window_width} x {window_height}
  Windowed: {d4_data.is_windowed_mode()}

Module-Level Constants (from game_interface_data.py):
  WINDOW_BORDER_LEFT: {WINDOW_BORDER_LEFT}px
  WINDOW_BORDER_RIGHT: {WINDOW_BORDER_RIGHT}px
  WINDOW_BORDER_BOTTOM: {WINDOW_BORDER_BOTTOM}px
  TITLE_BAR_TOP_OFFSET: {TITLE_BAR_TOP_OFFSET}px
  TITLE_BAR_HEIGHT: {TITLE_BAR_HEIGHT}px
  CLICK_MARGIN_DEFAULT: {CLICK_MARGIN_DEFAULT}px

Calculated Title Bar Range (Screen Coordinates):
  Top-Left: ({title_left}, {title_top})
  Bottom-Right: ({title_right}, {title_bottom})
  Width: {title_right - title_left}px
  Height: {title_bottom - title_top}px

Expected Range (from measurement):
  Top-Left: (740, 16)
  Bottom-Right: (2550, 47)
  Width: 1810px
  Height: 31px

Measurement Source:
  Window GetWindowRect: offset (731, 17), size 1826x1031
  Actual clickable title bar: (740, 16) to (2550, 47)
"""

    messagebox.showinfo("Title Bar Debug", debug_info)
    print(debug_info)
