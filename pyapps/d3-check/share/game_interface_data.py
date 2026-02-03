#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Interface Shared Data
Centralized data structure for D3 game interface recognition results
Shared across all controllers and UI components
"""

import os
import sys
import tkinter as tk
import threading
from typing import Optional, Dict, Tuple, List, Any, Set, Union, TYPE_CHECKING, Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image

numpy = get_third_package_numpy()
np = numpy
cv2 = get_third_package_cv2()
Image = get_third_package_PIL_Image()

# Add project path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, project_root)

# Import D3/D4 specific resolution constants (direct from app_constants; no re-export)
from providor.app_constants import (
    STANDARD_RESOLUTION_WIDTH,
    STANDARD_RESOLUTION_HEIGHT,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    TMP_DIR,
)
from providor.providor_index import get_template_path

D3_STANDARD_RESOLUTION_WIDTH = STANDARD_RESOLUTION_WIDTH
D3_STANDARD_RESOLUTION_HEIGHT = STANDARD_RESOLUTION_HEIGHT
from pycore.pyfoundations.color_print import ColorPrint

# Global scale variables (moved from providor_index.py to avoid circular imports)
GLOBAL_SCALE_X = 1.0  # Horizontal scale factor
GLOBAL_SCALE_Y = 1.0  # Vertical scale factor

# Screen resolution cache (get once, use many times)
_screen_resolution = None

def _get_screen_resolution_win32() -> tuple[int, int]:
    """Get primary monitor resolution on Windows without creating any Tk window."""
    import ctypes
    user32 = ctypes.windll.user32
    return (user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))  # SM_CXSCREEN, SM_CYSCREEN

def get_screen_resolution() -> tuple[int, int]:
    """Get screen resolution with caching. Does not create tk.Tk() to avoid extra blank window."""
    global _screen_resolution
    if _screen_resolution is None:
        if sys.platform == "win32":
            _screen_resolution = _get_screen_resolution_win32()
        else:
            try:
                from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
                ui = ENCYCLOPEDIA.get("ui")
                if ui is not None and hasattr(ui, "root") and ui.root.winfo_exists():
                    _screen_resolution = (ui.root.winfo_screenwidth(), ui.root.winfo_screenheight())
                else:
                    root = tk.Tk()
                    root.withdraw()
                    _screen_resolution = (root.winfo_screenwidth(), root.winfo_screenheight())
                    root.destroy()
            except Exception:
                _screen_resolution = (1920, 1080)
        ColorPrint.blue(f"[GameInterfaceData] Screen resolution cached: {_screen_resolution[0]}x{_screen_resolution[1]}")
    return _screen_resolution

# ============================================================================
# Window Border and Title Bar Constants
# ============================================================================
# These constants define the window frame dimensions for coordinate calculations.
# All coordinate conversion functions MUST use these constants.
#
# Relationship: D3 client area = 1300x800 (STANDARD_RESOLUTION). Screenshot/GetWindowRect
# returns OUTER window (includes title bar + left/right/bottom borders). When client is
# 1300x800, outer = 1316x839. Removing left blank (9) + right blank (7), title (31) and
# bottom (8) yields client 1300x800:
#   outer_width  = 1300 + 9 + 7 = 1316
#   outer_height = 800 + 31 + 8 = 839
#
# Measured from actual D4 window (same frame logic):
# - Window reported by GetWindowRect: offset (731, 17), size (example 1826x1031; D3 now 1316x839)
# - Actual title bar clickable range: (740, 16) to (2550, 47)
# - LEFT_BORDER: 9px, RIGHT_BORDER: 7px, TITLE_BAR_HEIGHT: 31px, BOTTOM: 8px
# ============================================================================

# Title bar dimensions
TITLE_BAR_HEIGHT = 31  # Title bar height in pixels (measured)
TITLE_BAR_TOP_OFFSET = -1  # Title bar starts 1px above window rect top

# Window border widths (left/right blanks + bottom)
WINDOW_BORDER_LEFT = 9  # Left border width in pixels
WINDOW_BORDER_RIGHT = 7  # Right border width in pixels
WINDOW_BORDER_BOTTOM = 8  # Bottom border width in pixels

# Legacy constant for backward compatibility (uses left border as standard)
WINDOW_BORDER_WIDTH = 8  # DEPRECATED: Use specific border constants instead

# D3 standard OUTER window size when client is 1300x800 (screenshot returns this)
D3_STANDARD_OUTER_WIDTH = D3_STANDARD_RESOLUTION_WIDTH + WINDOW_BORDER_LEFT + WINDOW_BORDER_RIGHT   # 1316
D3_STANDARD_OUTER_HEIGHT = D3_STANDARD_RESOLUTION_HEIGHT + TITLE_BAR_HEIGHT + WINDOW_BORDER_BOTTOM  # 839

# Click safety margins
CLICK_MARGIN_DEFAULT = 10  # Default safety margin for click operations (pixels)
CLICK_MARGIN_REGION = 5  # Margin for region-based clicks (pixels)

# D4 Directory constants (from app_constants; no re-export)
from providor.app_constants import D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR

# Optimized image processing constants (scaled from 800x600 at old base 1826x1301)
OPTIMIZED_IMAGE_WIDTH = 570   # was 800
OPTIMIZED_IMAGE_HEIGHT = 369  # was 600

# D4 Event State Keys
# These keys are used to trigger events when states change
# Shared between share data and events package
D4_EVENT_KEYS = {
    # EXP Farming Events
    'EXP_FARMING_STARTED': 'exp_farming_started',
    'EXP_FARMING_STOPPED': 'exp_farming_stopped', 
    'EXP_FARMING_TICK_COMPLETED': 'exp_farming_tick_completed',
    
    # Team Health Events
    'TEAM_HEALTH_DETECTED': 'team_health_detected',
    'TEAM_MEMBER_JOINED': 'team_member_joined',
    'TEAM_MEMBER_LEFT': 'team_member_left',
    'TEAM_HEALTH_CHANGED': 'team_health_changed',
    
    # Screen Events
    'SCREEN_SIZE_CHANGED': 'screen_size_changed',
    'SCREEN_COORDINATES_CHANGED': 'screen_coordinates_changed',
    'DISPLAY_MODE_CHANGED': 'display_mode_changed',
    
    # Game State Events
    'GAME_STATE_CHANGED': 'game_state_changed',
    'CURRENT_MAP_CHANGED': 'current_map_changed',
    'DUNGEON_PROGRESS_CHANGED': 'dungeon_progress_changed',
}


# ============================================================================
# Unified Coordinate Calculation Functions
# ============================================================================

def calculate_unified_scaled_coordinate(
    standard_coord: Union[Tuple[int, int], Tuple[int, None], Tuple[None, int]],
    game_window_size: Tuple[int, int],
    standard_resolution: Tuple[int, int],
    is_windowed: bool = True
) -> Union[Tuple[int, int], Tuple[int, None], Tuple[None, int]]:
    """
    Unified coordinate calculation for both D3 and D4
    
    Algorithm Description:
    1. Percentage calculation:
       - Window mode: subtract title+bottom (31+8) from height, left+right (8+8) from width.
       - When actual window is 1316x839 (D3_STANDARD_OUTER_*), effective content is 1300x800.
       - All values use constants (TITLE_BAR_HEIGHT, WINDOW_BORDER_WIDTH)
    
    2. Offset calculation:
       - For each coordinate[0]: subtract 8, calculate percentage, then add back 8
       - For each coordinate[1]: subtract 31, calculate percentage, then add back 31
       - Use (a,b) coordinate system when possible
       - Single points use (x,Null) for horizontal or (Null,y) for vertical
    
    Args:
        standard_coord: Standard coordinate (x, y) at base resolution
        game_window_size: Actual game window size (width, height)
        standard_resolution: Standard resolution (width, height)
        is_windowed: True if running in windowed mode, False for fullscreen

    Returns:
        Scaled coordinate (x, y) for actual window size
    """
    actual_width, actual_height = game_window_size
    standard_width, standard_height = standard_resolution

    # DEBUG: Print for Team Count region
    debug_this_coord = (standard_coord == (146, 310) or standard_coord == (228, 624))

    # Handle different coordinate formats: (x, y), (x, None), (None, y)
    return_vertical_only = False
    return_horizontal_only = False

    if standard_coord[0] is None:
        # (None, y) - vertical offset only
        std_x, std_y = 0, standard_coord[1]
        return_vertical_only = True
    elif standard_coord[1] is None:
        # (x, None) - horizontal offset only
        std_x, std_y = standard_coord[0], 0
        return_horizontal_only = True
    else:
        # (x, y) - full coordinate
        std_x, std_y = standard_coord

    if debug_this_coord:
        ColorPrint.blue(f"[CoordCalc] 🔍 Input: std={standard_coord}, actual_size={game_window_size}, std_size={standard_resolution}, windowed={is_windowed}")

    if is_windowed:
        # Windowed mode: account for title bar and borders
        # Standard coordinates include border offsets, so we need to handle them properly
        
        # Calculate effective dimensions (excluding fixed borders)
        # Window mode percentage calculation: subtract 31+8 from height, 8+8 from width
        # All values use constants: TITLE_BAR_HEIGHT=31, WINDOW_BORDER_WIDTH=8
        effective_actual_width = actual_width - (WINDOW_BORDER_WIDTH + WINDOW_BORDER_WIDTH)  # 8+8
        effective_standard_width = standard_width - (WINDOW_BORDER_WIDTH + WINDOW_BORDER_WIDTH)  # 8+8
        effective_actual_height = actual_height - (TITLE_BAR_HEIGHT + WINDOW_BORDER_WIDTH)  # 31+8
        effective_standard_height = standard_height - (TITLE_BAR_HEIGHT + WINDOW_BORDER_WIDTH)  # 31+8
        
        # Calculate scale factors for effective dimensions
        scale_x = effective_actual_width / effective_standard_width
        scale_y = effective_actual_height / effective_standard_height
        
        # Apply scaling: subtract fixed offsets, scale, then add back fixed offsets
        # Offset calculation algorithm:
        # - For each coordinate[0]: subtract 8, calculate percentage, then add back 8
        # - For each coordinate[1]: subtract 31, calculate percentage, then add back 31
        # - Use (a,b) coordinate system when possible
        scaled_x = int((std_x - WINDOW_BORDER_WIDTH) * scale_x + WINDOW_BORDER_WIDTH)  # [0] -8, 计算后 +8
        scaled_y = int((std_y - TITLE_BAR_HEIGHT) * scale_y + TITLE_BAR_HEIGHT)  # [1] -31, 计算后 +31

        if debug_this_coord:
            ColorPrint.blue(f"[CoordCalc] 🔍 Windowed mode:")
            ColorPrint.blue(f"  effective_actual: {effective_actual_width}x{effective_actual_height}")
            ColorPrint.blue(f"  effective_std: {effective_standard_width}x{effective_standard_height}")
            ColorPrint.blue(f"  scale: {scale_x:.4f}, {scale_y:.4f}")
            ColorPrint.blue(f"  ({std_x}, {std_y}) -> ({scaled_x}, {scaled_y})")

    else:
        # Fullscreen mode: no title bar or borders
        # Standard coordinates were measured in windowed mode, so we need to subtract the fixed offsets
        # before scaling, but don't add them back since fullscreen has no such offsets
        
        # Calculate scale factors for full dimensions
        scale_x = actual_width / standard_width
        scale_y = actual_height / standard_height
        
        # Apply scaling: subtract fixed offsets from standard coordinates before scaling
        # Fullscreen mode: no title bar or borders, so don't add back fixed offsets
        # - For coordinate[0]: subtract 8, calculate percentage, don't add back (no borders)
        # - For coordinate[1]: subtract 31, calculate percentage, don't add back (no title bar)
        scaled_x = int((std_x - WINDOW_BORDER_WIDTH) * scale_x)  # [0] -8, 计算后不加回
        scaled_y = int((std_y - TITLE_BAR_HEIGHT) * scale_y)  # [1] -31, 计算后不加回

        if debug_this_coord:
            ColorPrint.blue(f"[CoordCalc] 🔍 Fullscreen mode:")
            ColorPrint.blue(f"  scale: {scale_x:.4f}, {scale_y:.4f}")
            ColorPrint.blue(f"  ({std_x}, {std_y}) -> ({scaled_x}, {scaled_y})")

    # Return in the same format as input
    if return_vertical_only:
        return (None, scaled_y)
    elif return_horizontal_only:
        return (scaled_x, None)
    else:
        return (scaled_x, scaled_y)


# ============================================================================
# Standard Resolution Coordinate Mapping
# ============================================================================

@dataclass
class StandardCoordinates:
    """
    Standard coordinates for UI elements at base resolution (1300x800).
    Scaled from old base 1826x1301 by (1300/1826, 800/1301).

    All coordinates are relative to game window top-left corner.
    When actual window size differs, coordinates are scaled proportionally.
    """

    # Blacksmith interface (was (202, 368) at 1826x1301)
    blacksmith_salvage_button: Tuple[int, int] = (144, 226)

    # Kanai's Cube interface (was (848,1012), (514,997), (290,1005), (1005,1015))
    kanai_put_material_button: Tuple[int, int] = (604, 622)
    kanai_right_panel_toggle: Tuple[int, int] = (366, 613)
    kanai_conversion_button: Tuple[int, int] = (207, 618)
    kanai_next_page_button: Tuple[int, int] = (716, 624)

    # Reforge region (was (368,470), (368,723))
    reforge_region_start: Tuple[int, int] = (262, 289)  # (x, y) - vertical line start
    reforge_region_end: Tuple[int, int] = (262, 445)    # (x, y) - vertical line end

    # Bag region (was (1213,686), (1805,1036))
    bag_top_left: Tuple[int, int] = (864, 422)
    bag_bottom_right: Tuple[int, int] = (1286, 637)


# Global standard coordinates instance
STANDARD_COORDS = StandardCoordinates()


# ============================================================================
# D4 Region and Point Data Classes
# ============================================================================

@dataclass
class D4RegionInfo:
    """D4 region detection information"""
    name: str
    standard_start: Tuple[int, int]
    standard_end: Tuple[int, int]
    scaled_start: Tuple[int, int]
    scaled_end: Tuple[int, int]
    width: int
    height: int
    center: Tuple[int, int]


@dataclass
class D4PointInfo:
    """D4 point detection information"""
    name: str
    standard_coord: Tuple[int, int]
    scaled_coord: Tuple[int, int]


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
    bag_top_left: Tuple[int, int] = (1093, 756)
    bag_bottom_right: Tuple[int, int] = (1710, 1004)

    # Blacksmith menu area
    blacksmith_menu_start: Tuple[int, int] = (392, 172)
    blacksmith_menu_end: Tuple[int, int] = (682, 212)

    # Currency recognition region (Whispering Obols)
    whisper_obols_region_start: Tuple[int, int] = (1291, 1025)
    whisper_obols_region_end: Tuple[int, int] = (1353, 1048)

    # Equipment recognition regions
    equipment_left_region_start: Tuple[int, int] = (1294, 108)
    equipment_left_region_end: Tuple[int, int] = (1359, 695)
    equipment_right_region_start: Tuple[int, int] = (1660, 206)
    equipment_right_region_end: Tuple[int, int] = (1724, 695)

    # Blacksmith function recognition region
    blacksmith_function_region_start: Tuple[int, int] = (198, 467)
    blacksmith_function_region_end: Tuple[int, int] = (536, 776)

    # Experience bar region
    exp_bar_region_start: Tuple[int, int] = (733, 993)
    exp_bar_region_end: Tuple[int, int] = (1041, 1000)

    # Health orb point
    health_orb_point: Tuple[int, int] = (531, 1030)

    # Minimap region
    minimap_region_start: Tuple[int, int] = (1439, 78)
    minimap_region_end: Tuple[int, int] = (1731, 290)

    # Map name region
    map_name_region_start: Tuple[int, int] = (1440, 40)
    map_name_region_end: Tuple[int, int] = (1626, 68)

    # Quest text region
    quest_text_region_start: Tuple[int, int] = (1439, 315)
    quest_text_region_end: Tuple[int, int] = (1720, 1006)

    # Team member count region
    team_count_region_start: Tuple[int, int] = (146, 310)
    team_count_region_end: Tuple[int, int] = (228, 624)

    # Team health bar relative positions (horizontal offsets)
    team_health_bar_start_offset: Tuple[int, None] = (114, None)  # (x, Null) - horizontal start offset
    team_health_bar_end_offset: Tuple[int, None] = (178, None)   # (x, Null) - horizontal end offset

    # Team voting region
    team_vote_region_start: Tuple[int, int] = (127, 219)
    team_vote_region_end: Tuple[int, int] = (523, 500)
    team_vote_confirm_point: Tuple[int, int] = (225, 418)  # Accept team vote button (corrected)

    # Team menu relative dimensions
    team_menu_relative_height: Tuple[None, int] = (None, 230)  # (Null, y) - vertical height offset for team menu
    mouse_hover_display_height_offset_1: Tuple[None, int] = (None, 104)  # (Null, y) - vertical height offset 1
    mouse_hover_display_width_offset_1: Tuple[int, None] = (133, None)   # (x, Null) - horizontal width offset 1

    # Game start button
    start_game_button: Tuple[int, int] = (1505, 972)

    # Team right-click menu offsets (relative to team member position)
    team_right_menu_left_offset: Tuple[int, None] = (324, None)   # (x, Null) - horizontal left offset from team member
    team_right_menu_right_offset: Tuple[int, None] = (633, None)  # (x, Null) - horizontal right offset from team member
    team_right_menu_down_offset: Tuple[None, int] = (None, 760)   # (Null, y) - vertical down offset from team member

    # Dungeon progress bar (horizontal line with height for visibility)
    dungeon_progress_start: Tuple[int, int] = (1460, 355)  # Progress bar region top-left
    dungeon_progress_end: Tuple[int, int] = (1700, 370)    # Progress bar region bottom-right (height ~15px)

    # Red portal detection region (based on color_region_detector.py scan boundaries)
    red_portal_scan_left_margin: Tuple[int, None] = (150, None)    # (x, Null) - horizontal left edge margin
    red_portal_scan_right_margin: Tuple[int, None] = (328, None)   # (x, Null) - horizontal right edge margin
    red_portal_scan_bottom_margin: Tuple[None, int] = (None, 200)  # (Null, y) - vertical bottom edge margin
    red_portal_max_width: Tuple[int, None] = (310, None)           # (x, Null) - maximum portal width
    red_portal_max_height: Tuple[None, int] = (None, 600)          # (Null, y) - maximum portal height
    red_portal_min_area: int = 10             # (area) - minimum matched pixels to consider as portal

    # Team search and formation interface regions
    find_team_region_start: Tuple[int, int] = (155, 94)    # Find team button region top-left
    find_team_region_end: Tuple[int, int] = (275, 129)     # Find team button region bottom-right

    form_team_region_start: Tuple[int, int] = (292, 73)    # Form team button region top-left
    form_team_region_end: Tuple[int, int] = (406, 126)     # Form team button region bottom-right

    activity_selection_region_start: Tuple[int, int] = (360, 414)  # Activity selection region top-left
    activity_selection_region_end: Tuple[int, int] = (591, 426)    # Activity selection region bottom-right

    # Great Rift tier input regions
    min_tier_input_point: Tuple[int, int] = (568, 525)     # Minimum tier input click point
    min_tier_input_region_start: Tuple[int, int] = (375, 494)      # Minimum tier input region top-left
    min_tier_input_region_end: Tuple[int, int] = (757, 503)        # Minimum tier input region bottom-right

    max_tier_input_region_start: Tuple[int, int] = (757, 503)      # Maximum tier input region top-left (shares boundary with min)
    max_tier_input_region_end: Tuple[int, int] = (942, 525)        # Maximum tier input region bottom-right

    # Panel close button region (changed from single point to region for better visibility)
    panel_close_button_start: Tuple[int, int] = (1387, 50)  # Panel close button region top-left
    panel_close_button_end: Tuple[int, int] = (1806, 76)    # Panel close button region bottom-right

    # Team submission buttons
    confirm_team_button_start: Tuple[int, int] = (728, 861)  # Confirm submit team button region top-left
    confirm_team_button_end: Tuple[int, int] = (831, 879)    # Confirm submit team button region bottom-right


# Global D4 standard coordinates instance
D4_STANDARD_COORDS = D4StandardCoordinates()


# ============================================================================
# D3 Coordinate Scaling - Unified helper functions
# ============================================================================

def d3_scale_single_coord(coord: Tuple[int, int]) -> Tuple[int, int]:
    """
    Scale D3 single coordinate using shared D3InterfaceData.
    Direct property access to shared_data fields.
    Uses D3-specific standard resolution (1300x800; was 1826x1301).
    """
    shared_data = get_game_interface_data()
    return calculate_unified_scaled_coordinate(
        coord,
        shared_data.game_window_size,  # Direct property access
        (D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT),  # D3: 1826x1301
        shared_data.is_windowed_mode()  # Direct method (has logic)
    )


def d3_scale_region(start_coord: Tuple[int, int], end_coord: Tuple[int, int]) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Scale D3 region (start, end) using shared D3InterfaceData.
    Reuses d3_scale_single_coord to avoid duplication.
    """
    return (d3_scale_single_coord(start_coord), d3_scale_single_coord(end_coord))


# Backward compatibility wrappers (minimal - all use d3_scale_* helpers)
def get_scaled_bag_region() -> Tuple[Tuple[int, int], Tuple[int, int]]:
    return d3_scale_region(STANDARD_COORDS.bag_top_left, STANDARD_COORDS.bag_bottom_right)

def get_scaled_blacksmith_salvage_button() -> Tuple[int, int]:
    return d3_scale_single_coord(STANDARD_COORDS.blacksmith_salvage_button)

def get_scaled_reforge_region() -> Tuple[Tuple[int, int], Tuple[int, int]]:
    return d3_scale_region(STANDARD_COORDS.reforge_region_start, STANDARD_COORDS.reforge_region_end)

def get_scaled_kanai_put_material_button() -> Tuple[int, int]:
    return d3_scale_single_coord(STANDARD_COORDS.kanai_put_material_button)

def get_scaled_conversion_button() -> Tuple[int, int]:
    return d3_scale_single_coord(STANDARD_COORDS.kanai_conversion_button)

def get_scaled_kanai_right_panel_toggle() -> Tuple[int, int]:
    return d3_scale_single_coord(STANDARD_COORDS.kanai_right_panel_toggle)

def get_scaled_kanai_next_page_button() -> Tuple[int, int]:
    return d3_scale_single_coord(STANDARD_COORDS.kanai_next_page_button)


# ============================================================================
# D4 Coordinate Scaling - Use calculate_unified_scaled_coordinate directly
# Removed unnecessary wrapper functions to reduce code length
# ============================================================================


# ============================================================================
# Base Interface Data Class (Common functionality)
# ============================================================================

@dataclass
class InterfaceDataBase:
    """Base class for interface data with common functionality"""

    # Window height constant for windowed mode detection
    # NOTE: Use module-level TITLE_BAR_HEIGHT constant (defined at line 76)
    WINDOW_HEIGHT_THRESHOLD = TITLE_BAR_HEIGHT  # Reference to module constant, not redefinition

    # Recognition metadata
    timestamp: Optional[str] = None
    error: Optional[str] = None

    # Screenshot data (IN MEMORY)
    fullscreen_image: Optional[Image.Image] = None
    game_window_image: Optional[Image.Image] = None
    window_offset: Tuple[int, int] = (0, 0)
    fullscreen_size: Tuple[int, int] = (0, 0)
    game_window_size: Tuple[int, int] = (0, 0)
    screenshot_history: List[str] = field(default_factory=list)

    def add_screenshot_history(self, path: str, max_history: int = 10):
        """Add screenshot path to history"""
        self.screenshot_history.append(path)
        if len(self.screenshot_history) > max_history:
            self.screenshot_history = self.screenshot_history[-max_history:]

    def is_windowed_mode(self) -> bool:
        """Check if the game is running in windowed mode"""
        if not self.game_window_size or not self.fullscreen_size:
            return False
        window_width, window_height = self.game_window_size
        fullscreen_width, fullscreen_height = self.fullscreen_size
        width_diff = fullscreen_width - window_width
        height_diff = fullscreen_height - window_height
        return (width_diff >= self.WINDOW_HEIGHT_THRESHOLD and
                height_diff >= self.WINDOW_HEIGHT_THRESHOLD)


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
class D3InterfaceData(InterfaceDataBase):
    """
    D3 game interface shared data + GameState (ROSBOT/D3 game state)

    This is the SINGLE SOURCE OF TRUTH for D3 interface and game state data.
    Merged GameState functionality for ROSBOT and D3 game management.

    Data flow:
    1. screenshot_provider fills: fullscreen_image, game_window_image, window_offset, screenshot_history
    2. ui_region_collector fills: ui_region, timestamp
    3. bag_info_collector fills: bag_coordinates, bag_layout
    4. d3_running / battlenet_window_found set by window detection (d3_status_provider / battlenet_status_provider / timer), independent of rosbot_running
    5. D3 dynamic: on_login_screen, disconnected (highest priority), in_game (normal) - set by d3_status_provider or TODO
    6. Battle.net dynamic: on_login_screen, disconnected, normal_available - same as D3
    7. ROSBOT/controllers fill: rosbot_running, map_type, game_stage
    """

    # UI region (filled by ui_region_collector)
    ui_region: Optional[UIRegion] = None

    # Bag information (filled by bag_info_collector)
    bag_coordinates: Optional[BagCoordinates] = None
    bag_layout: Optional[BagLayout] = None

    # Interface states (filled by bag_info_collector)
    interface_type: Optional[str] = None  # "blacksmith", "kanai_cube"
    functional_interface: Optional[str] = None  # "reforge" or "upgrade"
    kanai_right_page_opened: Optional[bool] = None

    # Detection match results (filled by bag_info_collector, for visualization)
    bag_buttom_match: Optional[Dict] = None
    bag_left_match: Optional[Dict] = None
    button_detections: Optional[Dict[str, DetectionResult]] = None

    # Game state management (merged from GameState for D3/ROSBOT)
    battlenet_window_found: bool = False  # Set by window detection (battlenet_status_provider), independent of rosbot
    rosbot_window_found: bool = False  # True when extended_status is paused (has window)
    rosbot_extended_status: str = "not_found"  # not_found | running (process, no window) | paused (has window)
    rosbot_running: bool = False
    rosbot_flow_master_enabled: bool = False  # 总状态：用户点击「启动 ROSBOT」为 True，点击「停止」为 False（ROSBOT_FLOW_MERMAID A1）
    ensure_battlenet_only_master_enabled: bool = False  # 用户点击「确保战网」为 True，tick 只跑战网段，不掉 D3/ROSBOT；确认后每 tick 再轮询，掉线则重登
    d3_running: bool = False  # Set by window detection (d3_status_provider/controller), independent of rosbot
    map_type: str = "unknown"  # town, greater_rift, rift, unknown
    game_stage: str = "unknown"  # gem_upgrade, kill_boss, back_town, in_greater_rift, in_rift, unknown

    # D3 dynamic state (display priority: disconnected > on_login_screen > in_game)
    d3_on_login_screen: bool = False
    d3_disconnected: bool = False  # Highest priority
    d3_in_game: bool = False  # Normal state

    # Battle.net dynamic state (same priority: disconnected > on_login_screen > normal_available)
    battlenet_on_login_screen: bool = False
    battlenet_disconnected: bool = False
    battlenet_normal_available: bool = False

    # State change callbacks (merged from GameState)
    _callbacks: List[Callable] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def clear(self):
        """Clear all data"""
        self.timestamp = None
        self.error = None
        self.fullscreen_image = None
        self.game_window_image = None
        self.window_offset = (0, 0)
        self.fullscreen_size = (0, 0)
        self.game_window_size = (0, 0)
        self.screenshot_history.clear()
        self.ui_region = None
        self.bag_coordinates = None
        self.bag_layout = None
        self.interface_type = None
        self.functional_interface = None
        self.kanai_right_page_opened = None
        self.bag_buttom_match = None
        self.bag_left_match = None
        self.button_detections = None
        self.battlenet_window_found = False
        self.rosbot_window_found = False
        self.rosbot_extended_status = "not_found"
        self.rosbot_running = False
        self.rosbot_flow_master_enabled = False
        self.ensure_battlenet_only_master_enabled = False
        self.d3_running = False
        self.map_type = "unknown"
        self.game_stage = "unknown"
        self.d3_on_login_screen = False
        self.d3_disconnected = False
        self.d3_in_game = False
        self.battlenet_on_login_screen = False
        self.battlenet_disconnected = False
        self.battlenet_normal_available = False

    def has_ui_region(self) -> bool:
        """Check if UI region is available"""
        return self.ui_region is not None

    def has_bag_data(self) -> bool:
        """Check if bag data is available"""
        return self.bag_coordinates is not None

    def get_summary(self) -> Dict:
        """Get summary of current data"""
        return {
            "timestamp": self.timestamp,
            "error": self.error,
            "has_ui_region": self.ui_region is not None,
            "has_bag_coordinates": self.bag_coordinates is not None,
            "has_bag_layout": self.bag_layout is not None,
            "functional_interface": self.functional_interface,
            "battlenet_window_found": self.battlenet_window_found,
            "rosbot_window_found": self.rosbot_window_found,
            "rosbot_extended_status": self.rosbot_extended_status,
            "rosbot_running": self.rosbot_running,
            "rosbot_flow_master_enabled": self.rosbot_flow_master_enabled,
            "d3_running": self.d3_running,
            "map_type": self.map_type,
            "game_stage": self.game_stage,
            "d3_on_login_screen": self.d3_on_login_screen,
            "d3_disconnected": self.d3_disconnected,
            "d3_in_game": self.d3_in_game,
            "battlenet_on_login_screen": self.battlenet_on_login_screen,
            "battlenet_disconnected": self.battlenet_disconnected,
            "battlenet_normal_available": self.battlenet_normal_available,
        }

    # ==================== Game State Methods (with callback notification) ====================
    # These methods are kept because they trigger callbacks

    def set_battlenet_status(self, window_found: bool):
        """Set Battle.net window found status (from battlenet_status_provider). Notify callbacks."""
        should_notify = False
        with self._lock:
            if self.battlenet_window_found != window_found:
                self.battlenet_window_found = window_found
                should_notify = True
                ColorPrint.blue(f"[D3State] Battle.net: {'found' if window_found else 'not found'}")
        if should_notify:
            self._notify_callbacks()

    def set_rosbot_window_found(self, window_found: bool):
        """Set ROSBOT window found status (from rosbot_status_provider). Notify callbacks."""
        should_notify = False
        with self._lock:
            if self.rosbot_window_found != window_found:
                self.rosbot_window_found = window_found
                should_notify = True
                ColorPrint.blue(f"[D3State] ROSBOT window: {'found' if window_found else 'not found'}")
        if should_notify:
            self._notify_callbacks()

    def set_rosbot_extended_status(self, status: str):
        """Set ROSBOT extended status: not_found | running | paused. Notify callbacks."""
        if status not in ("not_found", "running", "paused"):
            return
        should_notify = False
        with self._lock:
            if self.rosbot_extended_status != status:
                self.rosbot_extended_status = status
                self.rosbot_window_found = status == "paused"
                should_notify = True
                ColorPrint.blue(f"[D3State] ROSBOT extended status: {status}")
        if should_notify:
            self._notify_callbacks()

    def set_rosbot_status(self, running: bool):
        """Set ROSBOT running status and notify callbacks"""
        should_notify = False
        with self._lock:
            if self.rosbot_running != running:
                self.rosbot_running = running
                should_notify = True
                ColorPrint.blue(f"[D3State] ROSBOT: {'Running' if running else 'Stopped'}")
        if should_notify:
            self._notify_callbacks()

    def set_rosbot_flow_master_enabled(self, enabled: bool):
        """Set 总状态 (ROSBOT flow master): True = 用户点击「启动 ROSBOT」，False = 点击「停止」。Notify callbacks."""
        should_notify = False
        with self._lock:
            if self.rosbot_flow_master_enabled != enabled:
                self.rosbot_flow_master_enabled = enabled
                should_notify = True
                ColorPrint.blue(f"[D3State] ROSBOT flow master: {'enabled' if enabled else 'disabled'}")
        if should_notify:
            self._notify_callbacks()

    def set_ensure_battlenet_only_master_enabled(self, enabled: bool):
        """Set 确保战网：True = 点击「确保战网」，tick 只跑战网段；False = 关闭。Notify callbacks."""
        should_notify = False
        with self._lock:
            if self.ensure_battlenet_only_master_enabled != enabled:
                self.ensure_battlenet_only_master_enabled = enabled
                should_notify = True
                ColorPrint.blue(f"[D3State] Ensure Battle.net only: {'enabled' if enabled else 'disabled'}")
        if should_notify:
            self._notify_callbacks()

    def set_d3_status(self, running: bool):
        """Set D3 running status and notify callbacks."""
        should_notify = False
        with self._lock:
            if self.d3_running != running:
                self.d3_running = running
                should_notify = True
                ColorPrint.blue(f"[D3State] D3: {'Running' if running else 'Stopped'}")
        if should_notify:
            self._notify_callbacks()

    def set_d3_dynamic_status(
        self,
        on_login_screen: bool = False,
        disconnected: bool = False,
        in_game: bool = False,
    ):
        """Set D3 dynamic state (priority: disconnected > on_login_screen > in_game). Notify callbacks."""
        should_notify = False
        with self._lock:
            if (
                self.d3_on_login_screen != on_login_screen
                or self.d3_disconnected != disconnected
                or self.d3_in_game != in_game
            ):
                self.d3_on_login_screen = on_login_screen
                self.d3_disconnected = disconnected
                self.d3_in_game = in_game
                should_notify = True
        if should_notify:
            self._notify_callbacks()

    def set_battlenet_dynamic_status(
        self,
        on_login_screen: bool = False,
        disconnected: bool = False,
        normal_available: bool = False,
    ):
        """Set Battle.net dynamic state (same priority as D3). Notify callbacks."""
        should_notify = False
        with self._lock:
            if (
                self.battlenet_on_login_screen != on_login_screen
                or self.battlenet_disconnected != disconnected
                or self.battlenet_normal_available != normal_available
            ):
                self.battlenet_on_login_screen = on_login_screen
                self.battlenet_disconnected = disconnected
                self.battlenet_normal_available = normal_available
                should_notify = True
        if should_notify:
            self._notify_callbacks()

    def set_map_type(self, map_type: str):
        """Set map type and notify callbacks"""
        should_notify = False
        with self._lock:
            if self.map_type != map_type:
                self.map_type = map_type
                should_notify = True
                ColorPrint.blue(f"[D3State] Map: {map_type}")
        if should_notify:
            self._notify_callbacks()

    def set_game_stage(self, stage: str):
        """Set game stage and notify callbacks"""
        should_notify = False
        with self._lock:
            if self.game_stage != stage:
                self.game_stage = stage
                should_notify = True
                ColorPrint.blue(f"[D3State] Stage: {stage}")
        if should_notify:
            self._notify_callbacks()

    def register_callback(self, callback: Callable):
        """Register state change callback"""
        with self._lock:
            self._callbacks.append(callback)
            ColorPrint.debug(f"[D3State] Callback registered: {callback.__name__}")

    def notify_state_sync(self):
        """Push current state to all registered callbacks (e.g. after timer refresh). Use when UI must reflect latest state even if no field changed (avoids race where first callback ran before status widgets existed)."""
        self._notify_callbacks()

    def _notify_callbacks(self):
        """Notify all registered callbacks"""
        try:
            callbacks = []
            with self._lock:
                callbacks = self._callbacks.copy()
                state = {
                    "battlenet_window_found": self.battlenet_window_found,
                    "rosbot_window_found": self.rosbot_window_found,
                    "rosbot_extended_status": self.rosbot_extended_status,
                    "rosbot_running": self.rosbot_running,
                    "d3_running": self.d3_running,
                    "map_type": self.map_type,
                    "game_stage": self.game_stage,
                    "d3_on_login_screen": self.d3_on_login_screen,
                    "d3_disconnected": self.d3_disconnected,
                    "d3_in_game": self.d3_in_game,
                    "battlenet_on_login_screen": self.battlenet_on_login_screen,
                    "battlenet_disconnected": self.battlenet_disconnected,
                    "battlenet_normal_available": self.battlenet_normal_available,
                }
            for callback in callbacks:
                try:
                    callback(state)
                except Exception as e:
                    ColorPrint.red(f"[D3State] Callback error: {e}")
        except Exception as e:
            ColorPrint.red(f"[D3State] Notify error: {e}")


# ============================================================================
# D4 Interface Data (Independent Shared Data Class)
# ============================================================================

@dataclass
class D4InterfaceData(InterfaceDataBase):
    """
    D4 game interface shared data (Independent)

    Simplified data structure focused on D4's specific needs.
    Uses D4-specific coordinate system and resolution (1763x1126).
    Does NOT include GameState - that belongs to D3InterfaceData.
    """

    # Screenshot history - File path list (only saved in DEBUG mode)
    last_annotated_screenshot_path: Optional[str] = None

    # Region detection data
    detected_regions: Optional[Dict[str, Any]] = None
    detected_points: Optional[Dict[str, Any]] = None
    region_detection_timestamp: Optional[str] = None

    # Screenshot data from screenshot provider
    screenshot_data: Optional[Any] = None

    # Team health information
    team_health_info: Optional[Dict[str, Any]] = None
    team_health_detection_timestamp: Optional[str] = None

    # Small map detection information
    small_map_detection: Optional[Dict[str, Any]] = None
    small_map_detection_timestamp: Optional[str] = None
    last_small_map_debug_path: Optional[str] = None

    # Optimized image data
    optimized_fullscreen_image: Optional['OptimizedImageData'] = None
    optimized_game_window_image: Optional['OptimizedImageData'] = None

    # D4 Game state management (D4-specific, not ROSBOT)
    game_running: bool = False
    exp_farming_running: bool = False

    # Game window information
    window_detected: bool = False
    window_hwnd: Optional[int] = None
    window_title: str = ""
    window_position: Tuple[int, int] = (0, 0)

    # Game progress
    current_act: int = 0
    current_chapter: int = 0
    current_quest: str = ""
    difficulty: str = ""
    world_tier: int = 0

    # Experience tracking
    current_level: int = 0
    current_exp: int = 0
    exp_to_next_level: int = 0
    exp_percent: float = 0.0
    paragon_level: int = 0

    # Screenshot state
    last_screenshot_path: Optional[str] = None
    last_screenshot_time: float = 0.0

    # Debug window state
    debug_window_open: bool = False
    debug_window_paused: bool = False

    # Map switching state
    is_switching_map: bool = False
    map_switch_count: int = 0
    is_post_switch_idle: bool = False

    # Team formation state
    has_team: Optional[bool] = None  # None=unknown, True=has team, False=no team
    team_check_timestamp: Optional[float] = None
    tick_interval: float = 0.1  # Controller tick interval in seconds

    def clear(self):
        """Clear all data"""
        self.timestamp = None
        self.error = None
        self.fullscreen_image = None
        self.game_window_image = None
        self.window_offset = (0, 0)
        self.fullscreen_size = (0, 0)
        self.game_window_size = (0, 0)
        self.screenshot_history.clear()
        self.last_annotated_screenshot_path = None
        self.detected_regions = None
        self.detected_points = None
        self.region_detection_timestamp = None
        self.screenshot_data = None
        self.team_health_info = None
        self.team_health_detection_timestamp = None
        self.small_map_detection = None
        self.small_map_detection_timestamp = None
        self.last_small_map_debug_path = None
        self.optimized_fullscreen_image = None
        self.optimized_game_window_image = None
        self.game_running = False
        self.exp_farming_running = False
        self.window_detected = False
        self.window_hwnd = None
        self.window_title = ""
        self.window_position = (0, 0)
        self.current_act = 0
        self.current_chapter = 0
        self.current_quest = ""
        self.difficulty = ""
        self.world_tier = 0
        self.current_level = 0
        self.current_exp = 0
        self.exp_to_next_level = 0
        self.exp_percent = 0.0
        self.paragon_level = 0
        self.last_screenshot_path = None
        self.last_screenshot_time = 0.0
        self.debug_window_open = False
        self.debug_window_paused = False
        self.is_switching_map = False
        self.map_switch_count = 0
        self.is_post_switch_idle = False
        self.has_team = None
        self.team_check_timestamp = None

    # Only keep widely-used convenience methods
    def is_exp_farming_running(self) -> bool:
        """Check if D4 EXP farming is running (widely used, kept for compatibility)"""
        return self.exp_farming_running


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
        effective_standard_width = D3_STANDARD_RESOLUTION_WIDTH   # D3: 1300 (was 1826)
        effective_standard_height = D3_STANDARD_RESOLUTION_HEIGHT # D3: 800 (was 1301)
    else:
        # Fullscreen mode: add threshold to both dimensions (no title bar)
        effective_actual_width = actual_width + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_actual_height = actual_height + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_width = D3_STANDARD_RESOLUTION_WIDTH + shared_data.WINDOW_HEIGHT_THRESHOLD
        effective_standard_height = D3_STANDARD_RESOLUTION_HEIGHT + shared_data.WINDOW_HEIGHT_THRESHOLD

    # Update global scale variables
    global GLOBAL_SCALE_X, GLOBAL_SCALE_Y
    GLOBAL_SCALE_X = effective_actual_width / effective_standard_width
    GLOBAL_SCALE_Y = effective_actual_height / effective_standard_height

    ColorPrint.blue(f"[GlobalScale] D3 Resolution: {actual_width}x{actual_height} / {D3_STANDARD_RESOLUTION_WIDTH}x{D3_STANDARD_RESOLUTION_HEIGHT}")
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


# ============================================================================
# Optimized Image Processing
# ============================================================================

@dataclass
class OptimizedImageData:
    """
    Data structure for optimized image processing
    
    Contains both the original and optimized images with scaling information
    """
    # Original image data
    original_image: Optional[Image.Image] = None
    original_width: int = 0
    original_height: int = 0
    
    # Optimized image data
    optimized_image: Optional[Image.Image] = None
    optimized_width: int = OPTIMIZED_IMAGE_WIDTH
    optimized_height: int = OPTIMIZED_IMAGE_HEIGHT
    
    # Scaling information
    scale_x: float = 1.0
    scale_y: float = 1.0
    
    # Offset information (for coordinate conversion)
    offset_x: float = 0.0
    offset_y: float = 0.0
    
    # Metadata
    timestamp: str = ""
    is_optimized: bool = False


def optimize_image_for_processing(image: Image.Image, target_width: int = OPTIMIZED_IMAGE_WIDTH, 
                                 target_height: int = OPTIMIZED_IMAGE_HEIGHT) -> OptimizedImageData:
    """
    Optimize image for processing by scaling to target resolution
    
    Args:
        image: Original PIL Image
        target_width: Target width for optimization (default 570; was 800 at 1826x1301)
        target_height: Target height for optimization (default 369; was 600 at 1826x1301)
        
    Returns:
        OptimizedImageData with both original and optimized images
    """
    try:
        # Get original dimensions
        original_width, original_height = image.size
        
        # Create optimized image data structure
        optimized_data = OptimizedImageData()
        optimized_data.original_image = image.copy()
        optimized_data.original_width = original_width
        optimized_data.original_height = original_height
        optimized_data.timestamp = datetime.now().isoformat()
        
        # Calculate scaling factors
        scale_x = target_width / original_width
        scale_y = target_height / original_height
        
        # Use uniform scaling to maintain aspect ratio
        scale = min(scale_x, scale_y)
        
        # Calculate new dimensions
        new_width = int(original_width * scale)
        new_height = int(original_height * scale)
        
        # Calculate offsets for centering
        offset_x = (target_width - new_width) / 2
        offset_y = (target_height - new_height) / 2
        
        # Resize image
        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create target canvas
        optimized_image = Image.new('RGB', (target_width, target_height), (0, 0, 0))
        
        # Paste resized image onto canvas (centered)
        optimized_image.paste(resized_image, (int(offset_x), int(offset_y)))
        
        # Update optimized data
        optimized_data.optimized_image = optimized_image
        optimized_data.optimized_width = target_width
        optimized_data.optimized_height = target_height
        optimized_data.scale_x = scale
        optimized_data.scale_y = scale
        optimized_data.offset_x = offset_x
        optimized_data.offset_y = offset_y
        optimized_data.is_optimized = True
        
        ColorPrint.blue(f"[OptimizedImage] Original: {original_width}x{original_height} -> Optimized: {target_width}x{target_height}")
        ColorPrint.blue(f"[OptimizedImage] Scale: {scale:.4f}, Offset: ({offset_x:.1f}, {offset_y:.1f})")
        
        return optimized_data
        
    except Exception as e:
        ColorPrint.red(f"[OptimizedImage] Error optimizing image: {e}")
        # Return original image data if optimization fails
        optimized_data = OptimizedImageData()
        optimized_data.original_image = image.copy()
        optimized_data.original_width, optimized_data.original_height = image.size
        optimized_data.optimized_image = image.copy()
        optimized_data.optimized_width, optimized_data.optimized_height = image.size
        optimized_data.scale_x = 1.0
        optimized_data.scale_y = 1.0
        optimized_data.is_optimized = False
        return optimized_data


def convert_optimized_coordinate_to_original(coord: Tuple[int, int], optimized_data: OptimizedImageData) -> Tuple[int, int]:
    """
    Convert coordinate from optimized image space to original image space
    
    Args:
        coord: Coordinate in optimized image space (x, y)
        optimized_data: OptimizedImageData containing scaling information
        
    Returns:
        Coordinate in original image space (x, y)
    """
    if not optimized_data.is_optimized:
        return coord
    
    x, y = coord
    
    # Remove offset and apply inverse scaling
    original_x = int((x - optimized_data.offset_x) / optimized_data.scale_x)
    original_y = int((y - optimized_data.offset_y) / optimized_data.scale_y)
    
    return (original_x, original_y)


def convert_original_coordinate_to_optimized(coord: Tuple[int, int], optimized_data: OptimizedImageData) -> Tuple[int, int]:
    """
    Convert coordinate from original image space to optimized image space
    
    Args:
        coord: Coordinate in original image space (x, y)
        optimized_data: OptimizedImageData containing scaling information
        
    Returns:
        Coordinate in optimized image space (x, y)
    """
    if not optimized_data.is_optimized:
        return coord
    
    x, y = coord
    
    # Apply scaling and add offset
    optimized_x = int(x * optimized_data.scale_x + optimized_data.offset_x)
    optimized_y = int(y * optimized_data.scale_y + optimized_data.offset_y)
    
    return (optimized_x, optimized_y)


def get_optimized_image_for_processing(optimized_data: OptimizedImageData) -> Image.Image:
    """
    Get the optimized image for processing
    
    Args:
        optimized_data: OptimizedImageData containing both images
        
    Returns:
        Optimized PIL Image for processing
    """
    if optimized_data.is_optimized and optimized_data.optimized_image is not None:
        return optimized_data.optimized_image
    else:
        return optimized_data.original_image

