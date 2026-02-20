import json
import os
import queue
import sys
import threading
from datetime import datetime, time as dt_time
from typing import Optional, List, Tuple, Dict, Any
from pathlib import Path

# Config worker: single thread owns CONFIG read/write (main thread + D3 extension thread use queue)
CONFIG_QUEUE = queue.Queue()
# Save requests: actual file write runs in dedicated thread so config worker and main thread never block on I/O
SAVE_QUEUE = queue.Queue()

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw, get_third_package_PIL_ImageFont

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.common import (
    ROOT_DIR,
    TMP_DIR,
    TEMPLATE_DIR,
    SCALED_TEMPLATES_CACHE_DIR,
    DEBUG,
)
from providor.constants.d3 import (
    D3_KANAI_NEXT_PAGE_BUTTON_RIGHT_RATIO,
    D3_STANDARD_RESOLUTION_WIDTH,
    D3_STANDARD_RESOLUTION_HEIGHT,
    D3_BATTLENET_STANDARD_RESOLUTION_WIDTH,
    D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT,
    START_GAME_AUTOMATION_IDS,
    D3_TAB_AUTOMATION_IDS,
    D3_START_GAME_BUTTON_TEMPLATE_NAME,
    D3_GAME_TOOL_TEMPLATE_NAME,
    D3_BOUNTY_PROGRESS_TEMPLATE_NAME,
    D3_DISCONNECTED_TEMPLATE_NAME,
    D3_CONNECTING_TEMPLATE_NAME,
    D3_CONNECTING_ALT_TEMPLATE_NAME,
)
from providor.constants.d4 import D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT

# ============================================================================
# ASSISTANT EXECUTION STATE - Controls auto_use_interface_function execution
# ============================================================================
# Global state for assistant macro execution control
# States:
#   is_running: True if function is currently executing, False otherwise
#   should_stop: True if execution should stop, False otherwise
#   enabled: True if execution is allowed, False if disabled
ASSISTANT_EXECUTION_STATE = {
    "is_running": False,   # App running
    "should_stop": False,  # Request stop
    "enabled": True        # Allow start
}

def get_assistant_state():
    """Get current assistant execution state"""
    return ASSISTANT_EXECUTION_STATE

def set_assistant_running(value: bool):
    """Set is_running state"""
    global ASSISTANT_EXECUTION_STATE
    ASSISTANT_EXECUTION_STATE["is_running"] = value

def set_assistant_should_stop(value: bool):
    """Set should_stop state"""
    global ASSISTANT_EXECUTION_STATE
    ASSISTANT_EXECUTION_STATE["should_stop"] = value

def set_assistant_enabled(value: bool):
    """Set enabled state"""
    global ASSISTANT_EXECUTION_STATE
    ASSISTANT_EXECUTION_STATE["enabled"] = value

def should_stop_assistant() -> bool:
    """Check if assistant should stop execution"""
    return ASSISTANT_EXECUTION_STATE["should_stop"]

def can_start_assistant() -> bool:
    """Check if assistant can start (not running and enabled)"""
    return not ASSISTANT_EXECUTION_STATE["is_running"] and ASSISTANT_EXECUTION_STATE["enabled"]

def reset_assistant_state():
    """Reset assistant state to idle"""
    global ASSISTANT_EXECUTION_STATE
    ASSISTANT_EXECUTION_STATE["is_running"] = False
    ASSISTANT_EXECUTION_STATE["should_stop"] = False
    ASSISTANT_EXECUTION_STATE["enabled"] = True

# ============================================================================
# D3 TEMPLATE CONFIGURATIONS - D3 game template paths and thresholds
# ============================================================================
D3_TEMPLATE_CONFIGS = {
    # Bag templates
    "bag_opened_indicator": {
        "path": os.path.join(TEMPLATE_DIR, "bag_opened_indicator.png"),
        "threshold": 0.80,  # SIFT matching threshold for bag opened indicator
        "category": "bag",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "Bag opened indicator - detects if bag is open"
    },
    "bag_left": {
        "path": os.path.join(TEMPLATE_DIR, "bag_left.png"),
        "threshold": 0.7,  # Lower for scaling tolerance
        "category": "bag",
        "use_alpha": False,  # No alpha channel
        "match_method": "SIFT"
    },
    "bag_right": {
        "path": os.path.join(TEMPLATE_DIR, "bag_right.png"),
        "threshold": 0.7,
        "category": "bag",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "bag_buttom": {
        "path": os.path.join(TEMPLATE_DIR, "bag_buttom.png"),
        "threshold": 0.8,
        "category": "bag",
        "use_alpha": False,
        "match_method": "SIFT"
    },

    # Interface indicator templates
    "blacksmith_indicator_1": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_indicator_1.png"),
        "threshold": 0.85,  # Template matching threshold for TM_CCOEFF_NORMED
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "blacksmith_indicator_2": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_indicator_2.png"),
        "threshold": 0.85,  # Template matching threshold for TM_CCOEFF_NORMED
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "blacksmith_sidebar_tab_1": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_sidebar_tab_1.png"),
        "threshold": 0.81,  # SIFT matching threshold for sidebar tab
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT",  # Use SIFT for tab matching
        "note": "Blacksmith sidebar tab (unselected state variant 1)"
    },
    "blacksmith_sidebar_tab_2": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_sidebar_tab_2.png"),
        "threshold": 0.81,  # SIFT matching threshold for sidebar tab
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT",  # Use SIFT for tab matching
        "note": "Blacksmith sidebar tab (unselected state variant 2)"
    },
    "blacksmith_salvage_button": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_salvage_button.png"),
        "threshold": 0.81,  # SIFT matching threshold for salvage button
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT",  # Use SIFT for button matching
        "note": "Blacksmith salvage equipment button - click to salvage items"
    },
    "kanai_right_panel_opened_indicator": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_right_panel_opened_indicator.png"),
        "threshold": 0.80,  # TM_CCOEFF matching threshold for panel indicator
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",  # Use TM_CCOEFF for panel detection
        "note": "**CRITICAL** Detects if Kanai's Cube RIGHT PANEL is OPENED (skill list visible on right side). If NOT found = panel CLOSED."
    },

    # Button templates
    # DEPRECATED: kanai_right_page_indicator - Now using state management instead of template detection
    # State is initialized to False in bag_info_collector.py and managed by KanaiCubeHandler through toggle clicks
    "kanai_right_page_indicator": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_right_page_indicator.png"),
        "threshold": 0.8,  # DEPRECATED - No longer used for detection
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "DEPRECATED - Use state management in KanaiCubeHandler instead of template detection"
    },
    "kanai_cube_left_panel_indicator": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_cube_left_panel_indicator.png"),
        "threshold": 0.80,  # SIFT matching threshold for Kanai Cube indicator
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "Detects if Kanai's Cube left panel is opened - indicates kanai_cube interface is active"
    },
    # DEPRECATED: kanai_right_panel_toggle_icon - Now using (366, 613) in game_interface_data.py; was (514, 997) at 1826x1301
    # Use get_scaled_kanai_right_panel_toggle() instead of image detection
    "kanai_right_panel_toggle_icon": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_right_panel_toggle_icon.png"),
        "threshold": 0.75,  # SIFT matching threshold for icon
        "category": "icon",
        "use_alpha": False,
        "match_method": "SIFT",  # Use SIFT for accurate icon detection
        "note": "DEPRECATED - Use get_scaled_kanai_right_panel_toggle() from game_interface_data.py instead"
    },
    "kanai_next_page_icon": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_next_page_icon.png"),
        "threshold": 0.75,  # SIFT matching threshold for next page icon
        "category": "icon",
        "use_alpha": False,
        "match_method": "ORB"  # Use SIFT for accurate icon detection
    },

    # D3 in-game "Start Game" button (after Battle.net Play + D3 resize); poll then SIFT match, click, wait 2s then start ROSBOT
    D3_START_GAME_BUTTON_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_START_GAME_BUTTON_TEMPLATE_NAME + ".png"),
        "threshold": 0.75,
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "Start Game button inside D3 client; match every 2s after resize, click then wait 2s before starting ROSBOT"
    },

    # D3 in-game "Game tool" indicator (after Start Game); wait every 2s until found, then send M key and click (602,94) scaled
    D3_GAME_TOOL_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_GAME_TOOL_TEMPLATE_NAME + ".png"),
        "threshold": 0.75,
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "Game tool UI; after found send M key to D3 window then click D3_GAME_TOOL_CLICK_STANDARD (602,94) scaled by base 1300x800"
    },

    # D3 in-game bounty progress UI; Fragment2: after M twice, two screenshots; both missing = timeout.
    D3_BOUNTY_PROGRESS_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_BOUNTY_PROGRESS_TEMPLATE_NAME + ".png"),
        "threshold": 0.75,
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "Bounty progress UI (d3_bounty_progress.png); Fragment2 checks after press M twice; if both of two captures lack this, timeout"
    },

    # D3 status: disconnected overlay; SIFT match in D3 window; found => d3_disconnected (d3_status_provider)
    D3_DISCONNECTED_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_DISCONNECTED_TEMPLATE_NAME + ".png"),
        "threshold": 0.70,
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "D3 disconnected overlay; SIFT match in D3 window during refresh_d3_status; found => set d3_disconnected for status UI"
    },
    D3_CONNECTING_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_CONNECTING_TEMPLATE_NAME + ".png"),
        "threshold": 0.70,
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "[C3C4] one-step state: continue wait (C3C4w)"
    },
    D3_CONNECTING_ALT_TEMPLATE_NAME: {
        "path": os.path.join(TEMPLATE_DIR, D3_CONNECTING_ALT_TEMPLATE_NAME + ".png"),
        "threshold": 0.70,
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "[C3C4] one-step state: continue wait (C3C4w)"
    },

    # Item quality templates
    "item_primal_ancient": {
        "path": os.path.join(TEMPLATE_DIR, "item_primal_ancient.png"),
        "threshold": 0.8,
        "category": "item_quality",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "item_ancient_set": {
        "path": os.path.join(TEMPLATE_DIR, "item_ancient_set.png"),
        "threshold": 0.8,
        "category": "item_quality",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "item_legendary": {
        "path": os.path.join(TEMPLATE_DIR, "item_legendary.png"),
        "threshold": 0.8,
        "category": "item_quality",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "item_rare_yellow": {
        "path": os.path.join(TEMPLATE_DIR, "item_rare_yellow.png"),
        "threshold": 0.8,
        "category": "item_quality",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "item_rare_blue": {
        "path": os.path.join(TEMPLATE_DIR, "item_rare_blue.png"),
        "threshold": 0.8,
        "category": "item_quality",
        "use_alpha": False,
        "match_method": "ORB"
    },

    # Slot templates
    "slot_empty": {
        "path": os.path.join(TEMPLATE_DIR, "slot_empty.png"),
        "threshold": 0.8,
        "category": "slot",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "slot_interference_colors": {
        "path": os.path.join(TEMPLATE_DIR, "slot_interference_colors.png"),
        "category": "slot",
        "use_alpha": False,
        "match_method": "ORB"
    },
    "quality_yellow_colors": {
        "path": os.path.join(TEMPLATE_DIR, "quality_yellow_colors.jpg"),
        "category": "quality_colors",
        "use_alpha": False,
        "match_method": "ORB"
    },

    # Game window anchor points (for window detection without title)
    "game_anchor_bottom_left_1": {
        "path": os.path.join(TEMPLATE_DIR, "game_anchor_bottom_left_1.png"),
        "threshold": 0.8,
        "category": "game_anchor",
        "match_method": "ORB",
        "use_alpha": False
    },
    "game_anchor_bottom_left_2": {
        "path": os.path.join(TEMPLATE_DIR, "game_anchor_bottom_left_2.png"),
        "threshold": 0.8,
        "category": "game_anchor",
        "match_method": "ORB",
        "use_alpha": False
    },
    "game_anchor_bottom_left_3": {
        "path": os.path.join(TEMPLATE_DIR, "game_anchor_bottom_left_3.png"),
        "threshold": 0.8,
        "category": "game_anchor",
        "match_method": "ORB",
        "use_alpha": False
    },
    "game_anchor_bottom_right": {
        "path": os.path.join(TEMPLATE_DIR, "game_anchor_bottom_right.png"),
        "threshold": 0.85,
        "category": "game_anchor",
        "match_method": "ORB",
        "use_alpha": True  # ONLY this one uses alpha channel for transparency
    }
}

# Helper function to get templates by category
def get_templates_by_category(category: str) -> Dict[str, Dict]:
    """Get all templates in a specific category"""
    return {
        name: config for name, config in D3_TEMPLATE_CONFIGS.items()
        if config.get("category") == category
    }

# Helper function to get template path
def get_template_path(template_name: str) -> Optional[str]:
    """Get template file path by name"""
    config = D3_TEMPLATE_CONFIGS.get(template_name)
    return config["path"] if config else None

# Helper function to get template threshold
def get_template_threshold(template_name: str) -> float:
    """Get template matching threshold by name"""
    config = D3_TEMPLATE_CONFIGS.get(template_name)
    return config.get("threshold", 0.8) if config else 0.8

# Helper function to get template match method
def get_template_match_method(template_name: str) -> str:
    """
    Get template matching method by name

    Returns:
        'SIFT', 'ORB', or 'TEMPLATE' (default)
    """
    config = D3_TEMPLATE_CONFIGS.get(template_name)
    return config.get("match_method", "ORB") if config else "ORB"

# Helper function for intelligent threshold conversion
def get_adjusted_threshold(template_name: str, target_match_method: Optional[str] = None) -> float:
    """
    Get template matching threshold with intelligent conversion for different match methods

    This function handles threshold adjustment when a template's match method differs
    from the target method. Different matching algorithms have different threshold ranges
    and semantics:

    - Feature-based (SIFT, ORB, AKAZE): Use match ratio/distance thresholds (0.6-0.9 typical)
    - Template matching (TM_CCOEFF_NORMED, TM_CCORR_NORMED): Use correlation coefficients (0.7-0.95 typical)
    - TM_SQDIFF methods: Use distance thresholds (lower is better, inverted logic)

    Args:
        template_name: Template name from D3_TEMPLATE_CONFIGS
        target_match_method: Target matching method (if None, uses template's original method)

    Returns:
        Adjusted threshold value appropriate for the target method

    Examples:
        # Use original threshold for original method
        >>> get_adjusted_threshold("blacksmith_indicator_1")
        0.85

        # Convert threshold when switching methods
        >>> get_adjusted_threshold("blacksmith_indicator_1", "SIFT")
        0.75  # Adjusted for SIFT feature matching
    """
    config = D3_TEMPLATE_CONFIGS.get(template_name)
    if not config:
        ColorPrint.yellow(f"[ThresholdConvert] Template '{template_name}' not found, using default 0.8")
        return 0.8

    original_threshold = config.get("threshold", 0.8)
    original_method = config.get("match_method", "ORB")

    # If no target method specified, return original threshold
    if target_match_method is None:
        return original_threshold

    # If methods match, no conversion needed
    if original_method == target_match_method:
        return original_threshold

    # Categorize matching methods
    feature_methods = ["SIFT", "ORB", "AKAZE"]
    template_methods = ["TM_CCOEFF", "TM_CCOEFF_NORMED", "TM_CCORR", "TM_CCORR_NORMED"]
    sqdiff_methods = ["TM_SQDIFF", "TM_SQDIFF_NORMED"]

    original_is_feature = original_method in feature_methods
    original_is_template = original_method in template_methods
    original_is_sqdiff = original_method in sqdiff_methods

    target_is_feature = target_match_method in feature_methods
    target_is_template = target_match_method in template_methods
    target_is_sqdiff = target_match_method in sqdiff_methods

    # Conversion logic
    converted_threshold = original_threshold

    # Case 1: Feature method -> Feature method (similar thresholds)
    if original_is_feature and target_is_feature:
        converted_threshold = original_threshold
        ColorPrint.gray(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold}) [feature->feature, no change]")

    # Case 2: Template method -> Template method (similar thresholds)
    elif original_is_template and target_is_template:
        converted_threshold = original_threshold
        ColorPrint.gray(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold}) [template->template, no change]")

    # Case 3: Feature method -> Template method (slightly increase for stricter matching)
    elif original_is_feature and target_is_template:
        # Feature methods typically use 0.6-0.8, template methods use 0.7-0.95
        # Apply a slight increase to maintain matching quality
        converted_threshold = min(0.95, original_threshold + 0.05)
        ColorPrint.blue(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold:.2f}) [feature->template, +0.05]")

    # Case 4: Template method -> Feature method (slightly decrease for more lenient matching)
    elif original_is_template and target_is_feature:
        # Template methods typically use 0.7-0.95, feature methods use 0.6-0.8
        # Apply a slight decrease to maintain matching success rate
        converted_threshold = max(0.6, original_threshold - 0.05)
        ColorPrint.blue(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold:.2f}) [template->feature, -0.05]")

    # Case 5: SQDIFF methods (inverted logic - lower is better)
    elif original_is_sqdiff or target_is_sqdiff:
        # For SQDIFF, lower values indicate better matches
        # If converting to/from SQDIFF, invert the threshold
        if original_is_sqdiff and not target_is_sqdiff:
            # SQDIFF -> other: invert (1 - threshold)
            converted_threshold = 1.0 - original_threshold
            ColorPrint.blue(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold:.2f}) [sqdiff->other, invert]")
        elif not original_is_sqdiff and target_is_sqdiff:
            # other -> SQDIFF: invert (1 - threshold)
            converted_threshold = 1.0 - original_threshold
            ColorPrint.blue(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}({converted_threshold:.2f}) [other->sqdiff, invert]")

    else:
        # Unknown combination, keep original
        ColorPrint.yellow(f"[ThresholdConvert] {template_name}: {original_method}({original_threshold}) -> {target_match_method}(?) [unknown conversion, keeping original]")
        converted_threshold = original_threshold

    return converted_threshold

# Helper function to get use_alpha setting
def get_template_use_alpha(template_name: str) -> bool:
    """Get whether template should use alpha channel"""
    config = D3_TEMPLATE_CONFIGS.get(template_name)
    return config.get("use_alpha", False) if config else False

# Deprecated: PNG matcher has been removed, use image_matcher with use_alpha instead
# This function is kept for backwards compatibility only
def template_uses_png_matcher(template_name: str) -> bool:
    """Check if template should use alpha channel (deprecated, use get_template_use_alpha)"""
    return get_template_use_alpha(template_name)

# ============================================================================
# END OF TEMPLATE CONFIGURATIONS
# ============================================================================

# Configuration file path
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "template_config.json")

DATA_DIR = Path.home() / '.core_node' / '.d3check'

# User-specific configuration paths
CURRENT_USER_DATA_PATH = DATA_DIR
CONFIG_USER_PATH = os.path.join(CURRENT_USER_DATA_PATH, "d3check_config.json")

# Debug and cache directories
DEBUG_DIR = os.path.join(CURRENT_USER_DATA_PATH, ".debug")
CACHE_DIR = os.path.join(CURRENT_USER_DATA_PATH, ".cache")

# Global configuration object
CONFIG = {}
# Single control for first load: avoid dual "if not CONFIG" in load_config vs initialize_config
_config_initialized = False

# Dynamic path that needs DOCUMENTS_PATH
DOCUMENTS_PATH = os.path.expanduser("~/Documents")

# ============================================================================
# CLIENT TYPE CONSTANTS - Unified client type identifiers
# ============================================================================
# These constants define the standard client type identifiers used throughout the application
# to identify different game clients and launchers. Use these constants instead of hardcoded strings.
#
# Usage:
#   - UI components: Use these to identify which client window to capture/interact with
#   - Template matching: Use these to select appropriate template configurations
#   - Window detection: Use these to map to corresponding window title lists
#
# IMPORTANT: Always use these constants instead of hardcoded strings like 'battlenet', 'd3_game', etc.

CLIENT_TYPE_BATTLENET = 'battlenet'  # Battle.net launcher client
CLIENT_TYPE_D3_GAME = 'd3_game'      # Diablo III game client
CLIENT_TYPE_D4_GAME = 'd4_game'      # Diablo IV game client

# All valid client types (for validation)
VALID_CLIENT_TYPES = [
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME
]

# Game tab auto_id (single source: app_constants.D3_TAB_AUTOMATION_IDS)
DIABLO_III_TAB_AUTO_ID = D3_TAB_AUTOMATION_IDS[1]  # "game-nav-btn-D3"

# Battle.net Launcher window title constants
BATTLE_NET_WINDOW_TITLES = [
    "Battle.net",                    # EN standard
    "Battle.net Login",              # EN login window
    "Battle.net Launcher",           # EN with Launcher suffix
    "Blizzard Launcher",             # Alternative EN name
    "战网",                          # CN short form
    "戰網",                          # TW short form
    "战网启动器",                    # CN
    "戰網啟動器",                    # TW
    "Battle.net 启动器",             # CN with EN prefix
    "Battle.net 啟動器",             # TW with EN prefix
    "暴雪战网",                      # CN Blizzard Battle.net
    "暴雪戰網",                      # TW Blizzard Battle.net
    "Blizzard Battle.net",          # EN full name
    "Battle.net - Blizzard Entertainment",  # EN with company
]

# Diablo III window title constants
DIABLO_III_WINDOW_TITLES = [
    "Diablo III",                    # EN
    "暗黑破坏神III",                  # CN
    "暗黑破壞神III",                  # TW
    "Diablo III - Blizzard Entertainment",  # EN with company
    "暗黑破坏神III - 暴雪娱乐",        # CN with company
    "暗黑破壞神III - 暴雪娛樂",        # TW with company
    "Diablo III (32-bit)",          # EN 32-bit
    "Diablo III (64-bit)",          # EN 64-bit
    "暗黑破坏神III (32位)",          # CN 32-bit
    "暗黑破坏神III (64位)",          # CN 64-bit
    "暗黑破壞神III (32位)",          # TW 32-bit
    "暗黑破壞神III (64位)",           # TW 64-bit22
    "III"
]

# Diablo IV window title constants
DIABLO_IV_WINDOW_TITLES = [
    "暗黑破坏神IV",                   # CN
    "暗黑破壞神IV",                   # TW
    "《暗黑破坏神 IV》",              # CN with book title marks
    "《暗黑破壞神 IV》",              # TW with book title marks
    "《暗黑破坏神IV》",               # CN with book title marks (no space)
    "《暗黑破壞神IV》",               # TW with book title marks (no space)
    "Diablo IV - Blizzard Entertainment",  # EN with company
    "暗黑破坏神IV - 暴雪娱乐",         # CN with company
    "暗黑破壞神IV - 暴雪娛樂",         # TW with company
    "《暗黑破坏神 IV》- 暴雪娱乐",     # CN with book title marks and company
    "《暗黑破壞神 IV》- 暴雪娛樂",     # TW with book title marks and company
    "Diablo IV (32-bit)",           # EN 32-bit
    "Diablo IV (64-bit)",           # EN 64-bit
    "暗黑破坏神IV (32位)",           # CN 32-bit
    "暗黑破坏神IV (64位)",           # CN 64-bit
    "暗黑破壞神IV (32位)",           # TW 32-bit
    "暗黑破壞神IV (64位)",            # TW 64-bit
    "《暗黑破坏神 IV》(32位)",        # CN with book title marks 32-bit
    "《暗黑破坏神 IV》(64位)",        # CN with book title marks 64-bit
    "《暗黑破壞神 IV》(32位)",        # TW with book title marks 32-bit
    "《暗黑破壞神 IV》(64位)",        # TW with book title marks 64-bit
    "IV》",                          # Short form
    "暗黑破坏神4",                    # CN alternative
    "暗黑破壞神4",                    # TW alternative
    "《暗黑破坏神 IV》",               # CN alternative with book title marks
    "《暗黑破壞神 IV》"                # TW alternative with book title marks
]

# Battle.net server region constants
BATTLE_NET_SERVER_REGIONS = {
    "CN": {
        "LastLoginRegion": "CN",
        "LastLoginAddress": "cn.actual.battlenet.com.cn",
        "LastLoginTassadar": "account.battlenet.com.cn"
    },
    "US": {
        "LastLoginRegion": "US",
        "LastLoginAddress": "us.actual.battle.net",
        "LastLoginTassadar": "account.battle.net"
    },
    "EU": {
        "LastLoginRegion": "EU",
        "LastLoginAddress": "eu.actual.battle.net",
        "LastLoginTassadar": "account.battle.net"
    },
    "KR": {
        "LastLoginRegion": "KR",
        "LastLoginAddress": "kr.actual.battle.net",
        "LastLoginTassadar": "account.battle.net"
    },
    "TW": {
        "LastLoginRegion": "TW",
        "LastLoginAddress": "tw.actual.battle.net",
        "LastLoginTassadar": "account.battle.net"
    }
}

# Battle.net config file path
BATTLE_NET_CONFIG_PATH = os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "Battle.net", "Battle.net.config")

def merge_config_recursive(source_dict, user_dict, path=""):
    """Recursively merge source config into user config, preserving user values"""
    modified = False
    
    for key, source_value in source_dict.items():
        current_path = f"{path}.{key}" if path else key
        
        if key not in user_dict:
            # Key doesn't exist in user config, add it
            user_dict[key] = source_value
            modified = True
            ColorPrint.debug(f"[DEBUG] Added missing config key: '{current_path}' = {source_value}")
        elif isinstance(source_value, dict) and isinstance(user_dict[key], dict):
            # Both are dictionaries, recursively merge
            if merge_config_recursive(source_value, user_dict[key], current_path):
                modified = True
        # If key exists and values are not both dicts, keep user value unchanged
    
    return modified

def merge_template_to_config(template_dict, config_dict, path=""):
    """Merge template config into user config, only adding missing keys, preserving user values"""
    modified = False

    for key, template_value in template_dict.items():
        current_path = f"{path}.{key}" if path else key

        if key not in config_dict:
            # Key doesn't exist in config, add it from template
            config_dict[key] = template_value
            modified = True
            ColorPrint.debug(f"[DEBUG] Added missing config key: '{current_path}' = {template_value}")
        elif isinstance(template_value, dict) and isinstance(config_dict[key], dict):
            # Both are dictionaries, recursively merge
            if merge_template_to_config(template_value, config_dict[key], current_path):
                modified = True
        # If key exists and values are not both dicts, keep user value unchanged

    return modified

def sync_config():
    """Sync configuration from template to user config and save immediately"""
    try:
        ColorPrint.debug("[DEBUG] Starting config sync...")
        
        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            ColorPrint.debug(f"[DEBUG] Created user data directory: {CURRENT_USER_DATA_PATH}")
        
        # Load template config
        ColorPrint.debug(f"[DEBUG] Loading template config: {CONFIG_PATH}")
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            template_config = json.load(f)
        
        # Check if user config exists
        if not os.path.exists(CONFIG_USER_PATH):
            # Copy entire template config file
            ColorPrint.debug(f"[DEBUG] User config file does not exist, creating new file: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                json.dump(template_config, f, indent=2, ensure_ascii=False)
            ColorPrint.debug(f"[DEBUG] User config file created: {CONFIG_USER_PATH}")
        else:
            # Load existing user config
            ColorPrint.debug(f"[DEBUG] Loading existing user config: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
            
            # Recursively merge missing keys from template config
            ColorPrint.debug("[DEBUG] Starting recursive config merge...")
            modified = merge_config_recursive(template_config, user_config)
            
            # Only save if modifications were made
            if modified:
                ColorPrint.debug("[DEBUG] Saving config to file...")
                with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                    json.dump(user_config, f, indent=2, ensure_ascii=False)
                ColorPrint.debug(f"[DEBUG] User config file updated with missing keys: {CONFIG_USER_PATH}")
            else:
                ColorPrint.debug("[DEBUG] User config file is up to date")
                
    except (OSError, json.JSONDecodeError) as e:
        ColorPrint.debug(f"[DEBUG] Error syncing config: {e}")
        ColorPrint.red(f"Error syncing config: {e}")

def fix_config_with_template():
    """Fix current CONFIG with template before saving"""
    try:
        ColorPrint.gray("[DEBUG] Fixing CONFIG with template...")
        
        # Load template config
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            template_config = json.load(f)
        
        # Merge missing keys from template (template as source, CONFIG as target)
        # Only add missing keys, preserve existing user values
        modified = merge_template_to_config(template_config, CONFIG)
        
        if modified:
            ColorPrint.gray("[DEBUG] CONFIG fixed with missing keys from template")
        else:
            ColorPrint.gray("[DEBUG] CONFIG is already complete")
            
        return modified
        
    except (OSError, json.JSONDecodeError) as e:
        ColorPrint.debug(f"[DEBUG] Error fixing CONFIG with template: {e}")
        return False


def _config_get_by_path(key_path: str, default: Any = None) -> Any:
    """Get CONFIG value by dot path. Only called from config worker."""
    keys = key_path.split(".")
    value = CONFIG
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return default
    return value


def _config_set_by_path(key_path: str, value: Any) -> None:
    """Set CONFIG value by dot path. Only called from config worker."""
    keys = key_path.split(".")
    config_ref = CONFIG
    for key in keys[:-1]:
        if key not in config_ref:
            config_ref[key] = {}
        config_ref = config_ref[key]
    config_ref[keys[-1]] = value


def _save_worker() -> None:
    """Dedicated thread for writing CONFIG to file. Prevents main thread and config worker from blocking on I/O."""
    while True:
        SAVE_QUEUE.get()
        while not SAVE_QUEUE.empty():
            try:
                SAVE_QUEUE.get_nowait()
            except queue.Empty:
                break
        save_config()


def _config_worker() -> None:
    """Single thread that owns CONFIG read/write; get/set via queue. File save is delegated to save worker."""
    while True:
        item = CONFIG_QUEUE.get()
        if item is None:
            break
        op, key_path, val, result_q = item
        if op == "get":
            result_q.put(_config_get_by_path(key_path, val))
        elif op == "set":
            _config_set_by_path(key_path, val)
            if result_q is not None:
                result_q.put(True)
            try:
                SAVE_QUEUE.put_nowait(None)
            except queue.Full:
                pass


def set_config_value_async(key_path: str, value: Any) -> None:
    """Queue config update and save without blocking. Use from UI so main thread never waits on config worker or file I/O."""
    CONFIG_QUEUE.put(("set", key_path, value, None))


def queue_config_save() -> None:
    """Request one save in background. Use from UI after direct CONFIG update so main thread never blocks on file I/O."""
    try:
        SAVE_QUEUE.put_nowait(None)
    except queue.Full:
        pass


def get_config_value_safe(key_path: str, default: Any = None) -> Any:
    """Thread-safe get CONFIG value by dot path. Used by main thread and D3 extension thread."""
    result_q: queue.Queue = queue.Queue()
    CONFIG_QUEUE.put(("get", key_path, default, result_q))
    return result_q.get()


def set_config_value_safe(key_path: str, value: Any) -> bool:
    """Thread-safe set CONFIG value by dot path and save. Blocks until in-memory update is done. Prefer set_config_value_async from UI."""
    result_q: queue.Queue = queue.Queue()
    CONFIG_QUEUE.put(("set", key_path, value, result_q))
    return result_q.get()


def save_config():
    """Save current CONFIG to user config file after fixing with template"""
    try:
        ColorPrint.gray("[DEBUG] Saving current CONFIG to file...")

        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            ColorPrint.gray(f"[DEBUG] Created user data directory: {CURRENT_USER_DATA_PATH}")

        # Clean up incorrect skill_configs at root level (legacy bug fix)
        if "skill_configs" in CONFIG and "macro_configs" in CONFIG:
            ColorPrint.gray("[DEBUG] Removing incorrect root-level skill_configs")
            del CONFIG["skill_configs"]

        # Fix CONFIG with template before saving
        fix_config_with_template()

        # Save current CONFIG to user config file
        with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
            json.dump(CONFIG, f, indent=2, ensure_ascii=False)

        ColorPrint.gray(f"[DEBUG] Current CONFIG saved to file: {CONFIG_USER_PATH}")

    except (OSError, json.JSONDecodeError) as e:
        ColorPrint.debug(f"[DEBUG] Error saving config: {e}")
        ColorPrint.red(f"Error saving config: {e}")

def _do_initial_load():
    """Single implementation for first-time config load: sync template then load file. Called by load_config and initialize_config."""
    global CONFIG, _config_initialized
    if _config_initialized:
        return
    ColorPrint.debug("[DEBUG] Initializing configuration (single entry)...")
    sync_config()
    try:
        ColorPrint.debug(f"[DEBUG] Loading from user config file: {CONFIG_USER_PATH}")
        with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
            CONFIG.update(json.load(f))
        ColorPrint.debug(f"[DEBUG] Config file loaded successfully: {CONFIG_USER_PATH}")
        ColorPrint.green(f"Configuration loaded from: {CONFIG_USER_PATH}")
        _config_initialized = True
    except (OSError, json.JSONDecodeError) as e:
        ColorPrint.debug(f"[DEBUG] Failed to load config file: {e}")
        ColorPrint.red(f"Error loading config: {e}")
        CONFIG = {}


def initialize_config():
    """Initialize configuration with one-time fix on startup. Single entry: delegates to _do_initial_load."""
    _do_initial_load()


def load_config(force_sync: bool = False):
    """Load configuration: first load via _do_initial_load(); later force_sync only runs sync_config and reload from file."""
    global CONFIG, _config_initialized
    if not _config_initialized:
        _do_initial_load()
        return
    if force_sync:
        sync_config()
        try:
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                CONFIG.clear()
                CONFIG.update(json.load(f))
            ColorPrint.debug(f"[DEBUG] Config reloaded after sync: {CONFIG_USER_PATH}")
        except (OSError, json.JSONDecodeError) as e:
            ColorPrint.debug(f"[DEBUG] Failed to reload config: {e}")

# Fixed file paths under Documents (not configurable; log file vs history file are two distinct files)
LOGS_FILE_RELATIVE = "RoS-BoT/Logs/logs.txt"
HISTORY_FILE_RELATIVE = "RoS-BoT/Logs/history.txt"


def get_dynamic_paths():
    """Get paths that depend on DOCUMENTS_PATH."""
    return {
        'ROSBOT_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("rosbot_relative", "RoS-BoT")),
        'ROSBOT_LOGS_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("rosbot_logs_relative", "RoS-BoT/Logs")),
        'D3CHECK_TEMP_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("d3check_temp_relative", ".d3check")),
        'ANNOTATED_SCREENSHOTS_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("annotated_screenshots_relative", ".d3check/annotated_screenshots")),
        'LOGS_FILE_PATH': os.path.join(DOCUMENTS_PATH, LOGS_FILE_RELATIVE),
        'HISTORY_FILE_PATH': os.path.join(DOCUMENTS_PATH, HISTORY_FILE_RELATIVE),
    }

# Load configuration on import
load_config()

# Start config worker (single thread owns CONFIG; get/set via CONFIG_QUEUE)
_config_worker_thread = threading.Thread(target=_config_worker, daemon=True)
_config_worker_thread.start()
# Start save worker (file I/O off config worker so main thread never blocks on save)
_save_worker_thread = threading.Thread(target=_save_worker, daemon=True)
_save_worker_thread.start()

# Export dynamic paths
_dynamic_paths = get_dynamic_paths()
ROSBOT_PATH = _dynamic_paths['ROSBOT_PATH']
ROSBOT_LOGS_PATH = _dynamic_paths['ROSBOT_LOGS_PATH'] 
D3CHECK_TEMP_PATH = _dynamic_paths['D3CHECK_TEMP_PATH']
ANNOTATED_SCREENSHOTS_PATH = _dynamic_paths['ANNOTATED_SCREENSHOTS_PATH']
LOGS_FILE_PATH = _dynamic_paths['LOGS_FILE_PATH']
HISTORY_FILE_PATH = _dynamic_paths['HISTORY_FILE_PATH']

# Static values available through CONFIG object

# Play button automation IDs (single source: app_constants.START_GAME_AUTOMATION_IDS)
PLAY_BUTTON_AUTOMATION_IDS = list(START_GAME_AUTOMATION_IDS)
PLAY_BUTTON_MAIN_AUTO_ID = START_GAME_AUTOMATION_IDS[0]  # "play-btn-main"
PLAY_BUTTON_AUTO_ID = START_GAME_AUTOMATION_IDS[1]        # "play-btn"

# ============================================================================
# BATTLENET TEMPLATE CONFIGURATIONS - Battle.net client template paths and thresholds
# ============================================================================
# D3 small map: copy from images/logo.png (or login_try dir) to images/battlenet/d3_small_map.png when missing
BATTLENET_TEMPLATE_CONFIGS = {
    "battlenet_d3_small_map": {
        "path": os.path.join(TEMPLATE_DIR, "battlenet", "d3_small_map.png"),
        "threshold": 0.75,
        "category": "battlenet_login",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "D3 small map icon on Battle.net - SIFT feature match; found means login success"
    },
    "battlenet_play_button_zh": {
        "path": os.path.join(TEMPLATE_DIR, "battlenet", "play_button_zh.png"),
        "threshold": 0.75,
        "category": "battlenet_login",
        "use_alpha": False,
        "match_method": "TM_CCOEFF_NORMED",
        "note": "Play button (Chinese locale) on Battle.net - from ScreenShot_2026-01-29_231157_269.png"
    },
    "battlenet_play_button_en": {
        "path": os.path.join(TEMPLATE_DIR, "battlenet", "play_button_en.png"),
        "threshold": 0.75,
        "category": "battlenet_login",
        "use_alpha": False,
        "match_method": "TM_CCOEFF_NORMED",
        "note": "Play button (English) on Battle.net - from ScreenShot_2026-01-29_231236_887.png"
    },
}

# ============================================================================
# D4 TEMPLATE CONFIGURATIONS - D4-specific template paths and thresholds
# ============================================================================
D4_TEMPLATE_CONFIGS = {
    # D4 Small map templates
    "d4_small_map": {
        "path": os.path.join(TEMPLATE_DIR, "d4", "small_map.jpg"),
        "threshold": 0.6,  # Lower threshold for small map detection
        "category": "d4_map",
        "use_alpha": False,
        "match_method": "SIFT",
        "note": "D4 small map template - detects if player is in town (city) vs dungeon"
    },
    
    # Add more D4-specific templates here as needed
    # "d4_other_template": {
    #     "path": os.path.join(TEMPLATE_DIR, "d4", "other_template.png"),
    #     "threshold": 0.8,
    #     "category": "d4_ui",
    #     "use_alpha": False,
    #     "match_method": "SIFT",
    #     "note": "D4 other template description"
    # },
}