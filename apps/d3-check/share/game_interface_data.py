#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Interface Shared Data
Centralized data structure for D3 game interface recognition results
Shared across all controllers and UI components
"""

import os
import sys
from typing import Optional, Dict, Tuple, List, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

# Add project path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, project_root)

# Import standard resolution constants
from providor.providor_index import (
    STANDARD_RESOLUTION_WIDTH,
    STANDARD_RESOLUTION_HEIGHT,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    get_template_path
)
from providor.common_imports import ColorPrint

# Global scale variables (moved from providor_index.py to avoid circular imports)
GLOBAL_SCALE_X = 1.0  # Horizontal scale factor
GLOBAL_SCALE_Y = 1.0  # Vertical scale factor


# ============================================================================
# Standard Resolution Coordinate Mapping
# ============================================================================

@dataclass
class StandardCoordinates:
    """
    Standard coordinates for UI elements at base resolution (1826x1301)

    All coordinates are relative to game window top-left corner.
    When actual window size differs, coordinates are scaled proportionally.
    """

    # Blacksmith interface
    blacksmith_salvage_button: Tuple[int, int] = (202, 368)

    # Kanai's Cube interface
    kanai_put_material_button: Tuple[int, int] = (848, 1012)
    kanai_right_panel_toggle: Tuple[int, int] = (514, 997)
    kanai_conversion_button: Tuple[int, int] = (290, 1005)
    kanai_next_page_button: Tuple[int, int] = (1005, 1015)

    # Reforge region
    reforge_region_start: Tuple[int, int] = (368, 470)
    reforge_region_end: Tuple[int, int] = (368, 723)

    # Bag region
    bag_top_left: Tuple[int, int] = (1213, 686)
    bag_bottom_right: Tuple[int, int] = (1805, 1036)


# Global standard coordinates instance
STANDARD_COORDS = StandardCoordinates()


# ============================================================================
# D4 Standard Resolution Coordinate Mapping
# ============================================================================

@dataclass
class D4StandardCoordinates:
    """
    D4 standard coordinates for UI elements at base resolution (1763x1126)

    All coordinates are relative to game window top-left corner.
    When actual window size differs, coordinates are scaled proportionally.
    """

    # Team management
    edit_team_button: Tuple[int, int] = (950, 265)
    confirm_edit_team: Tuple[int, int] = (730, 950)
    idle_team_min_tier: Tuple[int, int] = (410, 550)
    idle_team_max_tier: Tuple[int, int] = (805, 550)
    idle_activity_selection: Tuple[int, int] = (375, 456)
    add_idle_team: Tuple[int, int] = (368, 118)

    # Bag region
    bag_top_left: Tuple[int, int] = (1093, 760)
    bag_bottom_right: Tuple[int, int] = (1708, 1106)

    # Blacksmith menu area
    blacksmith_menu_start: Tuple[int, int] = (392, 172)
    blacksmith_menu_end: Tuple[int, int] = (682, 212)

    # Currency recognition region (Whispering Obols)
    whisper_obols_region_start: Tuple[int, int] = (1291, 1025)
    whisper_obols_region_end: Tuple[int, int] = (1353, 1048)

    # Equipment recognition regions
    equipment_left_region_start: Tuple[int, int] = (1294, 108)
    equipment_left_region_end: Tuple[int, int] = (1368, 701)
    equipment_right_region_start: Tuple[int, int] = (1660, 206)
    equipment_right_region_end: Tuple[int, int] = (1724, 701)

    # Blacksmith function recognition region
    blacksmith_function_region_start: Tuple[int, int] = (198, 467)
    blacksmith_function_region_end: Tuple[int, int] = (536, 776)

    # Experience bar region
    exp_bar_region_start: Tuple[int, int] = (733, 993)
    exp_bar_region_end: Tuple[int, int] = (1041, 996)

    # Health orb point
    health_orb_point: Tuple[int, int] = (531, 1030)

    # Minimap region
    minimap_region_start: Tuple[int, int] = (1439, 78)
    minimap_region_end: Tuple[int, int] = (1731, 290)

    # Map name region
    map_name_region_start: Tuple[int, int] = (1440, 40)
    map_name_region_end: Tuple[int, int] = (1602, 68)

    # Quest text region
    quest_text_region_start: Tuple[int, int] = (1439, 315)
    quest_text_region_end: Tuple[int, int] = (1720, 1006)

    # Team member count region
    team_count_region_start: Tuple[int, int] = (32, 139)
    team_count_region_end: Tuple[int, int] = (193, 584)

    # Team health bar relative positions
    team_health_bar_start_offset: int = 114  # Relative start X offset
    team_health_bar_end_offset: int = 178   # Relative end X offset

    # Team voting region
    team_vote_region_start: Tuple[int, int] = (127, 119)
    team_vote_region_end: Tuple[int, int] = (523, 327)
    team_vote_confirm_point: Tuple[int, int] = (225, 418)  # Accept team vote button (corrected)

    # Team menu relative dimensions
    team_menu_relative_height: int = 230  # Relative height offset for team menu
    mouse_hover_display_height_offset_1: int = 104  # Mouse hover display height offset 1
    mouse_hover_display_width_offset_1: int = 133   # Mouse hover display width offset 1

    # Game start button
    start_game_button: Tuple[int, int] = (1505, 972)

    # Team right-click menu offsets (relative to team member position)
    team_right_menu_left_offset: int = 324   # Left offset from team member
    team_right_menu_right_offset: int = 633  # Right offset from team member
    team_right_menu_down_offset: int = 760   # Down offset from team member

    # Dungeon progress bar (horizontal line)
    dungeon_progress_start: Tuple[int, int] = (1460, 362)  # Progress bar start point
    dungeon_progress_end: Tuple[int, int] = (1700, 362)    # Progress bar end point

    # Red portal detection region (based on color_region_detector.py scan boundaries)
    red_portal_scan_left_margin: int = 150    # Skip left edge 150px
    red_portal_scan_right_margin: int = 328   # Skip right edge 328px
    red_portal_scan_bottom_margin: int = 200  # Skip bottom edge 200px
    red_portal_max_width: int = 310           # Maximum portal width
    red_portal_max_height: int = 600          # Maximum portal height
    red_portal_min_area: int = 10             # Minimum matched pixels to consider as portal


# Global D4 standard coordinates instance
D4_STANDARD_COORDS = D4StandardCoordinates()


def calculate_scaled_coordinate(
    standard_coord: Tuple[int, int],
    standard_width: int = STANDARD_RESOLUTION_WIDTH,
    standard_height: int = STANDARD_RESOLUTION_HEIGHT
) -> Tuple[int, int]:
    """
    Calculate scaled coordinate based on current game window size

    Args:
        standard_coord: Standard coordinate (x, y) at base resolution
        standard_width: Standard resolution width (default: 1826)
        standard_height: Standard resolution height (default: 1301)

    Returns:
        Scaled coordinate (x, y) for actual window size
    """
    # Get actual window size from shared data
    shared_data = get_game_interface_data()
    actual_width, actual_height = shared_data.game_window_size

    # Check if running in windowed mode
    is_windowed = shared_data.is_windowed_mode()
    
    if is_windowed:
        # Windowed mode: use actual dimensions (with title bar)
        effective_actual_width = actual_width
        effective_actual_height = actual_height
        effective_standard_width = standard_width
        effective_standard_height = standard_height
    else:
        # Fullscreen mode: add threshold to both dimensions (no title bar)
        effective_actual_width = actual_width + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_actual_height = actual_height + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_width = standard_width + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_height = standard_height + shared_data.WINDOW_HEIGHT_THRESHOLD

    std_x, std_y = standard_coord

    # Calculate scale factors
    scale_x = effective_actual_width / effective_standard_width
    scale_y = effective_actual_height / effective_standard_height

    # Apply scaling
    scaled_x = int(std_x * scale_x)
    scaled_y = int(std_y * scale_y)

    return (scaled_x, scaled_y)


def calculate_scaled_region(
    standard_start: Tuple[int, int],
    standard_end: Tuple[int, int],
    standard_width: int = STANDARD_RESOLUTION_WIDTH,
    standard_height: int = STANDARD_RESOLUTION_HEIGHT
) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Calculate scaled region based on current game window size

    Args:
        standard_start: Standard region start coordinate (x, y)
        standard_end: Standard region end coordinate (x, y)
        standard_width: Standard resolution width (default: 1826)
        standard_height: Standard resolution height (default: 1301)

    Returns:
        Tuple of (scaled_start, scaled_end) coordinates
    """
    scaled_start = calculate_scaled_coordinate(
        standard_start,
        standard_width,
        standard_height
    )
    scaled_end = calculate_scaled_coordinate(
        standard_end,
        standard_width,
        standard_height
    )

    return (scaled_start, scaled_end)


def get_scaled_blacksmith_salvage_button() -> Tuple[int, int]:
    """
    Get scaled blacksmith salvage button coordinate based on current game window size

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_scaled_coordinate(
        STANDARD_COORDS.blacksmith_salvage_button
    )


def get_scaled_kanai_put_material_button() -> Tuple[int, int]:
    """
    Get scaled Kanai's Cube put material button coordinate based on current game window size

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_scaled_coordinate(
        STANDARD_COORDS.kanai_put_material_button
    )


def get_scaled_kanai_right_panel_toggle() -> Tuple[int, int]:
    """
    Get scaled Kanai's Cube right panel toggle button coordinate based on current game window size

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_scaled_coordinate(
        STANDARD_COORDS.kanai_right_panel_toggle
    )


def get_scaled_conversion_button() -> Tuple[int, int]:
    """
    Get scaled Kanai's Cube conversion button coordinate based on current game window size

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_scaled_coordinate(
        STANDARD_COORDS.kanai_conversion_button
    )


def get_scaled_kanai_next_page_button() -> Tuple[int, int]:
    """
    Get scaled Kanai's Cube next page button coordinate based on current game window size

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_scaled_coordinate(
        STANDARD_COORDS.kanai_next_page_button
    )


def get_scaled_bag_region() -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled bag region coordinates based on current game window size

    Returns:
        Tuple of (top_left, bottom_right) coordinates relative to game window
    """
    return calculate_scaled_region(
        STANDARD_COORDS.bag_top_left,
        STANDARD_COORDS.bag_bottom_right
    )


def get_scaled_reforge_region() -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled reforge region coordinates based on current game window size

    Returns:
        Tuple of (start_coord, end_coord) for reforge region
    """
    return calculate_scaled_region(
        STANDARD_COORDS.reforge_region_start,
        STANDARD_COORDS.reforge_region_end
    )


# ============================================================================
# D4 Coordinate Scaling Helper Functions
# ============================================================================

def calculate_d4_scaled_coordinate(
    standard_coord: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
    window_height_threshold: int = 31
) -> Tuple[int, int]:
    """
    Calculate scaled D4 coordinate based on actual game window size

    Args:
        standard_coord: Standard coordinate (x, y) at D4 base resolution (1763x1126)
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode, False for fullscreen
        window_height_threshold: Height threshold for windowed mode detection (default: 31)

    Returns:
        Scaled coordinate (x, y) for actual window size
    """
    actual_width, actual_height = game_window_size

    if is_windowed:
        # Windowed mode: use actual dimensions (with title bar)
        effective_actual_width = actual_width
        effective_actual_height = actual_height
        effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH
        effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT
    else:
        # Fullscreen mode: add threshold to both dimensions (no title bar)
        effective_actual_width = actual_width + window_height_threshold
        effective_actual_height = actual_height + window_height_threshold
        effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH + window_height_threshold
        effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT + window_height_threshold

    std_x, std_y = standard_coord

    # Calculate scale factors
    scale_x = effective_actual_width / effective_standard_width
    scale_y = effective_actual_height / effective_standard_height

    # Apply scaling
    scaled_x = int(std_x * scale_x)
    scaled_y = int(std_y * scale_y)

    return (scaled_x, scaled_y)


def calculate_d4_scaled_region(
    standard_start: Tuple[int, int],
    standard_end: Tuple[int, int],
    game_window_size: Tuple[int, int],
    is_windowed: bool,
    window_height_threshold: int = 31
) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Calculate scaled D4 region based on actual game window size

    Args:
        standard_start: Standard region start coordinate (x, y)
        standard_end: Standard region end coordinate (x, y)
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode, False for fullscreen
        window_height_threshold: Height threshold for windowed mode detection (default: 31)

    Returns:
        Tuple of (scaled_start, scaled_end) coordinates
    """
    scaled_start = calculate_d4_scaled_coordinate(
        standard_start,
        game_window_size,
        is_windowed,
        window_height_threshold
    )
    scaled_end = calculate_d4_scaled_coordinate(
        standard_end,
        game_window_size,
        is_windowed,
        window_height_threshold
    )

    return (scaled_start, scaled_end)


def get_d4_scaled_edit_team_button(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 edit team button coordinate

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.edit_team_button,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_confirm_edit_team(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 confirm edit team button coordinate

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.confirm_edit_team,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_idle_team_tiers(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 idle team tier coordinates (min and max)

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (min_tier_coord, max_tier_coord)
    """
    min_tier = calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.idle_team_min_tier,
        game_window_size,
        is_windowed
    )
    max_tier = calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.idle_team_max_tier,
        game_window_size,
        is_windowed
    )
    return (min_tier, max_tier)


def get_d4_scaled_idle_activity_selection(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 idle activity selection coordinate

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.idle_activity_selection,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_add_idle_team(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 add idle team button coordinate

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) relative to game window
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.add_idle_team,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_bag_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 bag region coordinates

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (top_left, bottom_right) coordinates relative to game window
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.bag_top_left,
        D4_STANDARD_COORDS.bag_bottom_right,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_blacksmith_menu_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 blacksmith menu region coordinates

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for blacksmith menu region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.blacksmith_menu_start,
        D4_STANDARD_COORDS.blacksmith_menu_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_whisper_obols_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 whispering obols currency region coordinates

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for whisper obols region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.whisper_obols_region_start,
        D4_STANDARD_COORDS.whisper_obols_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_equipment_regions(game_window_size: Tuple[int, int], is_windowed: bool) -> Dict[str, Tuple[Tuple[int, int], Tuple[int, int]]]:
    """
    Get scaled D4 equipment recognition regions (left and right)

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Dictionary with 'left' and 'right' equipment regions
    """
    left_region = calculate_d4_scaled_region(
        D4_STANDARD_COORDS.equipment_left_region_start,
        D4_STANDARD_COORDS.equipment_left_region_end,
        game_window_size,
        is_windowed
    )
    right_region = calculate_d4_scaled_region(
        D4_STANDARD_COORDS.equipment_right_region_start,
        D4_STANDARD_COORDS.equipment_right_region_end,
        game_window_size,
        is_windowed
    )
    return {"left": left_region, "right": right_region}


def get_d4_scaled_blacksmith_function_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 blacksmith function recognition region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for blacksmith function region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.blacksmith_function_region_start,
        D4_STANDARD_COORDS.blacksmith_function_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_exp_bar_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 experience bar region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for exp bar region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.exp_bar_region_start,
        D4_STANDARD_COORDS.exp_bar_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_health_orb_point(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 health orb recognition point

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) for health orb point
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.health_orb_point,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_minimap_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 minimap region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for minimap region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.minimap_region_start,
        D4_STANDARD_COORDS.minimap_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_map_name_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 map name region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for map name region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.map_name_region_start,
        D4_STANDARD_COORDS.map_name_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_quest_text_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 quest text region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for quest text region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.quest_text_region_start,
        D4_STANDARD_COORDS.quest_text_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_team_count_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 team member count region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for team count region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.team_count_region_start,
        D4_STANDARD_COORDS.team_count_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_team_vote_region(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Get scaled D4 team voting region

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Tuple of (start_coord, end_coord) for team vote region
    """
    return calculate_d4_scaled_region(
        D4_STANDARD_COORDS.team_vote_region_start,
        D4_STANDARD_COORDS.team_vote_region_end,
        game_window_size,
        is_windowed
    )


def get_d4_scaled_team_vote_confirm_point(game_window_size: Tuple[int, int], is_windowed: bool) -> Tuple[int, int]:
    """
    Get scaled D4 team vote confirm button point

    Args:
        game_window_size: Actual game window size (width, height)
        is_windowed: True if running in windowed mode

    Returns:
        Scaled coordinate (x, y) for team vote confirm point
    """
    return calculate_d4_scaled_coordinate(
        D4_STANDARD_COORDS.team_vote_confirm_point,
        game_window_size,
        is_windowed
    )


# ============================================================================
# Original Data Classes and Functions
# ============================================================================


@dataclass
class UIRegion:
    """UI region data from ui_region_collector"""
    x: int
    y: int
    width: int
    height: int
    ui_offset_x: int  # Offset from screen to UI region
    ui_offset_y: int
    is_fullscreen: bool
    source: str  # "window_cache", "anchor_match", etc.


@dataclass
class BagCoordinates:
    """Bag coordinates data"""
    top_left: Tuple[int, int]
    bottom_right: Tuple[int, int]
    width: int
    height: int
    rows: int
    cols: int
    total_slots: int


@dataclass
class BagLayout:
    """Bag layout data with item information"""
    layout: List[List[int]]  # 2D array of slot usage
    items: Dict[Tuple[int, int], Dict]  # Mapping (row, col) to item info with quality


@dataclass
class DetectionResult:
    """
    Template detection result with reliability flag

    Attributes:
        match: Match result dict with 'center', 'polygon', 'match_score'
        reliable: True if detected under correct conditions (e.g., panel opened)
        state: Optional state info (e.g., 'enabled', 'disabled' for buttons)
    """
    match: Dict
    reliable: bool = False
    state: Optional[str] = None


@dataclass
class D3InterfaceData:
    """
    D3 game interface shared data

    This is the SINGLE SOURCE OF TRUTH for interface data.

    Data flow:
    1. screenshot_provider fills: fullscreen_image, game_window_image, window_offset, screenshot_history
    2. ui_region_collector fills: ui_region, timestamp
    3. bag_info_collector fills: bag_coordinates, bag_layout

    Note: Resolution scaling is now handled internally by image matchers
    """

    # Window height constant for windowed mode detection
    WINDOW_HEIGHT_THRESHOLD = 31

    # Recognition metadata
    timestamp: Optional[str] = None
    error: Optional[str] = None

    # Screenshot data (filled by screenshot_provider) - IN MEMORY
    fullscreen_image: Optional[Image.Image] = None  # Fullscreen or game window image (depends on capture mode)
    game_window_image: Optional[Image.Image] = None  # UI region image (for detection)
    window_offset: Tuple[int, int] = (0, 0)  # Game window offset from fullscreen (offset_x, offset_y)
    fullscreen_size: Tuple[int, int] = (0, 0)  # Fullscreen or game window size (width, height)
    game_window_size: Tuple[int, int] = (0, 0)  # Game window or UI region size (width, height)

    # Screenshot history - File path list (only saved in DEBUG mode)
    screenshot_history: List[str] = field(default_factory=list)  # Recent screenshot file paths

    # UI region (filled by ui_region_collector)
    ui_region: Optional[UIRegion] = None

    # Bag information (filled by bag_info_collector)
    bag_coordinates: Optional[BagCoordinates] = None
    bag_layout: Optional[BagLayout] = None

    # DEPRECATED: Button coordinates - Now using coordinate system in StandardCoordinates
    # Use get_scaled_kanai_put_material_button() and get_scaled_conversion_button() instead
    put_material_button: Optional[Tuple[int, int]] = None  # DEPRECATED
    conversion_button: Optional[Tuple[int, int]] = None  # DEPRECATED

    # Interface states (filled by bag_info_collector)
    conversion_clickable: Optional[bool] = None  # DEPRECATED - No longer used (only one indicator for kanai_cube)
    interface_type: Optional[str] = None  # "blacksmith", "kanai_cube"
    functional_interface: Optional[str] = None  # "reforge" or "upgrade" (for compatibility)
    kanai_right_page_opened: Optional[bool] = None  # True if Kanai Cube right page is opened, False if closed

    # Detection match results (filled by bag_info_collector, for visualization)
    bag_buttom_match: Optional[Dict] = None
    bag_left_match: Optional[Dict] = None
    button_detections: Optional[Dict[str, DetectionResult]] = None  # Template name -> DetectionResult
    # Example: {'conversion_button': DetectionResult(match={...}, reliable=True, state='enabled')}

    def clear(self):
        """Clear all data"""
        self.timestamp = None
        self.error = None
        # Clear screenshot data
        self.fullscreen_image = None
        self.game_window_image = None
        self.window_offset = (0, 0)
        self.fullscreen_size = (0, 0)
        self.game_window_size = (0, 0)
        self.screenshot_history.clear()
        # Clear detection results
        self.ui_region = None
        self.bag_coordinates = None
        self.bag_layout = None
        self.put_material_button = None
        self.conversion_button = None
        self.conversion_clickable = None
        self.interface_type = None
        self.functional_interface = None
        self.kanai_right_page_opened = None
        self.bag_buttom_match = None
        self.bag_left_match = None
        self.button_detections = None

    def add_screenshot_history(self, path: str, max_history: int = 10):
        """Add screenshot path to history"""
        self.screenshot_history.append(path)
        # Keep only max_history records
        if len(self.screenshot_history) > max_history:
            self.screenshot_history = self.screenshot_history[-max_history:]

    def has_ui_region(self) -> bool:
        """Check if UI region is available"""
        return self.ui_region is not None

    def has_bag_data(self) -> bool:
        """Check if bag data is available"""
        return self.bag_coordinates is not None

    def get_summary(self) -> Dict:
        """Get summary of current data"""
        summary = {
            "timestamp": self.timestamp,
            "error": self.error,
            "has_ui_region": self.has_ui_region(),
            "has_bag_coordinates": self.bag_coordinates is not None,
            "has_bag_layout": self.bag_layout is not None,
            "has_put_material_button": self.put_material_button is not None,
            "has_conversion_button": self.conversion_button is not None,
            "conversion_clickable": self.conversion_clickable,
            "functional_interface": self.functional_interface
        }

        return summary

    def is_windowed_mode(self) -> bool:
        """
        Check if the game is running in windowed mode
        
        Returns True if both game_window_size dimensions are smaller than 
        the corresponding fullscreen_size dimensions by at least WINDOW_HEIGHT_THRESHOLD pixels
        
        Returns:
            bool: True if running in windowed mode, False otherwise
        """
        if not self.game_window_size or not self.fullscreen_size:
            return False
            
        window_width, window_height = self.game_window_size
        fullscreen_width, fullscreen_height = self.fullscreen_size
        
        # Check if both dimensions are smaller by at least the threshold
        width_diff = fullscreen_width - window_width
        height_diff = fullscreen_height - window_height
        
        return (width_diff >= self.WINDOW_HEIGHT_THRESHOLD and
                height_diff >= self.WINDOW_HEIGHT_THRESHOLD)


# ============================================================================
# D4 Interface Data (Independent Shared Data Class)
# ============================================================================

@dataclass
class D4InterfaceData:
    """
    D4 game interface shared data (Independent)

    Simplified data structure focused on D4's specific needs.
    Uses D4-specific coordinate system and resolution (1763x1126).
    """

    # Window height constant for windowed mode detection
    WINDOW_HEIGHT_THRESHOLD = 31

    # Recognition metadata
    timestamp: Optional[str] = None
    error: Optional[str] = None

    # Screenshot data (IN MEMORY)
    fullscreen_image: Optional[Image.Image] = None  # Fullscreen or game window image
    game_window_image: Optional[Image.Image] = None  # Game window image (for detection)
    window_offset: Tuple[int, int] = (0, 0)  # Game window offset from fullscreen
    fullscreen_size: Tuple[int, int] = (0, 0)  # Fullscreen size (width, height)
    game_window_size: Tuple[int, int] = (0, 0)  # Game window size (width, height)

    # Screenshot history - File path list (only saved in DEBUG mode)
    screenshot_history: List[str] = field(default_factory=list)

    # Annotated screenshots for coordinate visualization
    last_annotated_screenshot_path: Optional[str] = None

    def clear(self):
        """Clear all data"""
        self.timestamp = None
        self.error = None
        # Clear screenshot data
        self.fullscreen_image = None
        self.game_window_image = None
        self.window_offset = (0, 0)
        self.fullscreen_size = (0, 0)
        self.game_window_size = (0, 0)
        self.screenshot_history.clear()
        self.last_annotated_screenshot_path = None

    def add_screenshot_history(self, path: str, max_history: int = 10):
        """Add screenshot path to history"""
        self.screenshot_history.append(path)
        # Keep only max_history records
        if len(self.screenshot_history) > max_history:
            self.screenshot_history = self.screenshot_history[-max_history:]

    def is_windowed_mode(self) -> bool:
        """
        Check if the game is running in windowed mode

        Returns True if both game_window_size dimensions are smaller than
        the corresponding fullscreen_size dimensions by at least WINDOW_HEIGHT_THRESHOLD pixels

        Returns:
            bool: True if running in windowed mode, False otherwise
        """
        if not self.game_window_size or not self.fullscreen_size:
            return False

        window_width, window_height = self.game_window_size
        fullscreen_width, fullscreen_height = self.fullscreen_size

        # Check if both dimensions are smaller by at least the threshold
        width_diff = fullscreen_width - window_width
        height_diff = fullscreen_height - window_height

        return (width_diff >= self.WINDOW_HEIGHT_THRESHOLD and
                height_diff >= self.WINDOW_HEIGHT_THRESHOLD)

    def get_summary(self) -> Dict:
        """Get summary of current data"""
        summary = {
            "timestamp": self.timestamp,
            "error": self.error,
            "has_fullscreen_image": self.fullscreen_image is not None,
            "has_game_window_image": self.game_window_image is not None,
            "game_window_size": self.game_window_size,
            "fullscreen_size": self.fullscreen_size,
            "is_windowed": self.is_windowed_mode(),
            "screenshot_history_count": len(self.screenshot_history),
            "last_annotated_screenshot": self.last_annotated_screenshot_path
        }
        return summary


# Global shared instances
_game_interface_data = None
_d4_interface_data = None

# Color sets cache (initialized once per color type)
_color_cache: Dict[str, Set[Tuple[int, int, int]]] = {}

# Separator line detection constants
SEPARATOR_COLOR_TOLERANCE = 0.02  # 2% tolerance for color similarity
SEPARATOR_SCAN_HEIGHT_PERCENT = 0.20  # 20% height range in the middle
SEPARATOR_SCAN_WIDTH_PERCENT = 0.80  # 80% width range in the middle

# Hardcoded interference colors (exact match, no tolerance)
HARDCODED_INTERFERENCE_COLORS = {
    (0x09, 0x10, 0x11),  # 111009
    (0x08, 0x0d, 0x0d),  # 0d0d08
    (0x01, 0x05, 0x09),  # 090501
    (0x00, 0x04, 0x08),  # 080400
    (0x00, 0x05, 0x09),  # 090500
    (0x04, 0x10, 0x1c),  # 1c1004
}


def _load_colors_from_image(template_name: str) -> Set[Tuple[int, int, int]]:
    """
    Generic function to load colors from an image file

    Args:
        template_name: Template name in providor_index.py

    Returns:
        Set of BGR color tuples
    """
    color_set = set()
    image_path = get_template_path(template_name)

    if image_path is None or not os.path.exists(image_path):
        return color_set

    try:
        # Load image using PIL (handles Chinese paths)
        pil_image = Image.open(image_path)
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        # Convert to BGR numpy array
        image_rgb = np.array(pil_image)
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        # Extract all unique colors
        pixels = image_bgr.reshape(-1, 3)
        total_pixels = len(pixels)

        # Get unique colors using numpy
        unique_colors = np.unique(pixels, axis=0)

        # Convert to set of tuples (ensures deduplication and int conversion)
        color_set = {tuple(int(c) for c in color) for color in unique_colors}

        # Debug print
        print(f"[ColorLoad] {template_name}: Total pixels={total_pixels}, Unique colors={len(unique_colors)}, After set dedup={len(color_set)}")

    except Exception as e:
        print(f"Warning: Failed to load colors from {template_name}: {e}")

    return color_set


def get_interference_colors() -> Set[Tuple[int, int, int]]:
    """
    Get interference colors (hardcoded)
    These colors are excluded from color analysis using exact match (no tolerance)

    Returns:
        Set of BGR color tuples to exclude from color analysis
    """
    return HARDCODED_INTERFERENCE_COLORS


def get_yellow_quality_colors() -> Set[Tuple[int, int, int]]:
    """
    Get yellow quality colors from quality_yellow_colors.jpg
    Colors are loaded once and cached for performance

    Returns:
        Set of BGR color tuples for yellow quality detection
    """
    if "yellow" not in _color_cache:
        _color_cache["yellow"] = _load_colors_from_image("quality_yellow_colors")
    return _color_cache["yellow"]


# Quality color image mapping (template_name -> color_key)
QUALITY_COLOR_IMAGES = {
    # 'quality_yellow_colors': 'yellow',  # Disabled: use hardcoded values instead
    # Add more quality color images here as needed
    # 'quality_blue_colors': 'blue',
    # 'quality_green_colors': 'green',
}

# Hardcoded color references (fallback when no image available)
HARDCODED_COLOR_REFS = {
    'blue': [
        (0x48, 0x29, 0x1d),  # 1d2948
        (0x65, 0x37, 0x25),  # 253765
        (0x3f, 0x22, 0x15),  # 15223f
    ],
    'yellow': [
        (0x13, 0x51, 0x63),  # 635113
        (0x10, 0xfd, 0xfa),  # fafd10
        (0x5f, 0x98, 0x9e),  # 9e985f
        (0x06, 0x32, 0x43),  # 433206
        (0x07, 0x6c, 0x75),  # 756c07
        (0x0a, 0x1b, 0x24),  # 241b0a
        (0x4b, 0x63, 0x6b),  # 6b634b
        (0x07, 0x76, 0x80),  # 807607
        (0x06, 0x56, 0x5d),  # 5d5606
        (0x0d, 0x7d, 0x83),  # 837d0d
        (0x03, 0x25, 0x2b),  # 2b2503
        (0x50, 0x7a, 0x8a),  # 8a7a50
        (0x09, 0x5f, 0x71),  # 715f09
        (0x56, 0x7c, 0x85),  # 857c56
        (0x0d, 0x2f, 0x3c),  # 3c2f0d
    ],
    'dark_gold_1slot': [
        (0x08, 0x1e, 0x31),  # 311e08
        (0x46, 0x4f, 0x5c),  # 5c4f46
        (0x1d, 0x44, 0x6c),  # 6c441d
        (0x0a, 0x26, 0x46),  # 46260a
        (0x17, 0x3b, 0x62),  # 623b17
        (0x2a, 0x67, 0x99),  # 99672a
        (0x0b, 0x27, 0x47),  # 47270b
        (0x35, 0x62, 0x9c),  # 9c6235
        (0x00, 0x71, 0xe2),  # e27100
        (0x03, 0x4b, 0x92),  # 924b03
        (0x0c, 0x46, 0x7b),  # 7b460c
    ],
    'dark_gold_2slot': [
        (0x08, 0x1e, 0x31),  # 311e08
        (0x46, 0x4f, 0x5c),  # 5c4f46
        (0x1d, 0x44, 0x6c),  # 6c441d
        (0x0a, 0x26, 0x46),  # 46260a
        (0x17, 0x3b, 0x62),  # 623b17
        (0x2a, 0x67, 0x99),  # 99672a
        (0x0b, 0x27, 0x47),  # 47270b
        (0x35, 0x62, 0x9c),  # 9c6235
        (0x00, 0x71, 0xe2),  # e27100
        (0x03, 0x4b, 0x92),  # 924b03
        (0x0c, 0x46, 0x7b),  # 7b460c
    ],
    'dark_gold_1slot_bak': [
        (0x0c, 0x29, 0x44),  # 44290c
        (0x12, 0x3d, 0x62),  # 623d12
        (0x11, 0x37, 0x5d),  # 5d3711
        (0x0d, 0x2b, 0x48),  # 482b0d
        (0x10, 0x34, 0x53),  # 533410
        (0x0e, 0x35, 0x52),  # 52350e
    ],
    'dark_gold_2slot_bak': [
        (0x08, 0x14, 0x1d),  # 1d1408
        (0x11, 0x2c, 0x5f),  # 5f2c11
        (0x07, 0x10, 0x1b),  # 1b1007
        (0x0e, 0x2d, 0x56),  # 562d0e
        (0x10, 0x34, 0x53),  # 533410
        (0x0e, 0x35, 0x52),  # 52350e
    ],
    'green': [
        (0x08, 0x24, 0x11),  # 112408
        (0x15, 0x65, 0x2c),  # 2c6515
        (0x09, 0x45, 0x21),  # 214509
        (0x17, 0x6c, 0x32),  # 326c17
        (0x00, 0xfa, 0x00),  # 00fa00
        (0x05, 0x5f, 0x10),  # 105f05
        (0x08, 0x22, 0x11),  # 112208
        (0x09, 0x3f, 0x1a),  # 1a3f09
        (0x30, 0x77, 0x49),  # 497730
        (0x0b, 0x63, 0x18),  # 18630b
        (0x08, 0x23, 0x10),  # 102308
        (0x08, 0x27, 0x13),  # 132708
        (0x19, 0x74, 0x32),  # 327419
        (0x00, 0x9c, 0x05),  # 059c00
        (0x01, 0xc6, 0x03),  # 03c601
        (0x15, 0x70, 0x2e),  # 2e7015
        (0x1d, 0xa7, 0x30),  # 30a71d
    ],
    'black': [
        (0x17, 0x6c, 0x32),  # 326c17 (also used as black reference)
    ],
}


def get_quality_color_set(color_key: str) -> Set[Tuple[int, int, int]]:
    """
    Get quality color set for a specific color key
    Try to load from image first, fallback to hardcoded references

    Args:
        color_key: Color key (e.g., 'yellow', 'blue', 'green')

    Returns:
        Set of BGR color tuples
    """
    cache_key = f"quality_{color_key}"

    # Return cached if available
    if cache_key in _color_cache:
        return _color_cache[cache_key]

    # Try to load from image
    for template_name, mapped_key in QUALITY_COLOR_IMAGES.items():
        if mapped_key == color_key:
            color_set = _load_colors_from_image(template_name)
            if color_set:
                _color_cache[cache_key] = color_set
                return color_set

    # Fallback to hardcoded references
    if color_key in HARDCODED_COLOR_REFS:
        color_set = set(HARDCODED_COLOR_REFS[color_key])
        _color_cache[cache_key] = color_set
        return color_set

    # Return empty set if not found
    _color_cache[cache_key] = set()
    return _color_cache[cache_key]


def get_color_references() -> Dict[str, Set[Tuple[int, int, int]]]:
    """
    Get all color references for quality detection
    All colors use the same loading logic with image priority

    Returns:
        Dictionary mapping color keys to color sets
    """
    return {
        'blue': get_quality_color_set('blue'),
        'yellow': get_quality_color_set('yellow'),
        'dark_gold_1slot': get_quality_color_set('dark_gold_1slot'),
        'dark_gold_2slot': get_quality_color_set('dark_gold_2slot'),
        'green': get_quality_color_set('green'),
        'black': get_quality_color_set('black'),
    }


def update_global_scale(actual_width: int, actual_height: int):
    """
    Update global resolution scale factors

    Called by ScreenshotProvider after each screenshot capture
    to calculate the scale ratio between actual resolution and standard resolution

    Args:
        actual_width: Actual screenshot width
        actual_height: Actual screenshot height
    """
    # Get shared data to check window mode
    shared_data = get_game_interface_data()
    is_windowed = shared_data.is_windowed_mode()
    
    if is_windowed:
        # Windowed mode: use actual dimensions (with title bar)
        effective_actual_width = actual_width
        effective_actual_height = actual_height
        effective_standard_width = STANDARD_RESOLUTION_WIDTH
        effective_standard_height = STANDARD_RESOLUTION_HEIGHT
    else:
        # Fullscreen mode: add threshold to both dimensions (no title bar)
        effective_actual_width = actual_width + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_actual_height = actual_height + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_width = STANDARD_RESOLUTION_WIDTH + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_height = STANDARD_RESOLUTION_HEIGHT + shared_data.WINDOW_HEIGHT_THRESHOLD

    # Update global scale variables
    global GLOBAL_SCALE_X, GLOBAL_SCALE_Y
    GLOBAL_SCALE_X = effective_actual_width / effective_standard_width
    GLOBAL_SCALE_Y = effective_actual_height / effective_standard_height

    ColorPrint.blue(f"[GlobalScale] Updated: {actual_width}x{actual_height} / {STANDARD_RESOLUTION_WIDTH}x{STANDARD_RESOLUTION_HEIGHT}")
    ColorPrint.blue(f"[GlobalScale] Window mode: {'Windowed' if is_windowed else 'Fullscreen'}")
    ColorPrint.blue(f"[GlobalScale] Effective: {effective_actual_width}x{effective_actual_height} / {effective_standard_width}x{effective_standard_height}")
    ColorPrint.blue(f"[GlobalScale] Scale factors: X={GLOBAL_SCALE_X:.4f}, Y={GLOBAL_SCALE_Y:.4f}")


def get_global_scale() -> tuple:
    """
    Get current global scale factors

    Returns:
        Tuple of (scale_x, scale_y)
    """
    return (GLOBAL_SCALE_X, GLOBAL_SCALE_Y)


def get_game_interface_data() -> D3InterfaceData:
    """
    Get global shared game interface data instance (singleton)

    Returns:
        Global D3InterfaceData instance
    """
    global _game_interface_data

    if _game_interface_data is None:
        _game_interface_data = D3InterfaceData()

    return _game_interface_data


def clear_game_interface_data():
    """Clear global shared data"""
    global _game_interface_data
    if _game_interface_data is not None:
        _game_interface_data.clear()


def get_d4_interface_data() -> D4InterfaceData:
    """
    Get global D4 interface data instance (singleton)

    Returns:
        Global D4InterfaceData instance
    """
    global _d4_interface_data

    if _d4_interface_data is None:
        _d4_interface_data = D4InterfaceData()
        ColorPrint.green("[Global] D4 interface data initialized")

    return _d4_interface_data


def clear_d4_interface_data():
    """Clear D4 global shared data"""
    global _d4_interface_data
    if _d4_interface_data is not None:
        _d4_interface_data.clear()

