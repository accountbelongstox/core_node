import json
import os
import sys
from datetime import datetime, time as dt_time
from typing import Optional, List, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint

# Root directory (../../ from current file)
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))

# Template directory
TEMPLATE_DIR = os.path.join(ROOT_DIR, "images")

# Temporary directory for screenshots and processing (pytools tmp)
TMP_DIR = Path.home() / ".core_node" / "pytools" / "tmp"

# Scaled templates cache directory
SCALED_TEMPLATES_CACHE_DIR = TMP_DIR / "scaled_templates"

# ============================================================================
# DEBUG MODE - Controls temporary file saving for debugging
# ============================================================================
# When DEBUG = True:
#   - All screenshots (fullscreen, game window, UI region) will be saved as temporary files
#   - Useful for debugging and verifying data flow
# When DEBUG = False:
#   - Only necessary files are saved (template matching input, final annotated results)
#   - All intermediate data is passed in memory (PIL Image objects)
DEBUG = True

# ============================================================================
# KANAI CUBE BUTTON OFFSET CONSTANTS
# ============================================================================
# Next page button position relative to material button
# The next page button is located at the right edge of the material button
# This ratio defines how far right from the button's right edge (0.0 = left edge, 1.0 = right edge)
KANAI_NEXT_PAGE_BUTTON_RIGHT_RATIO = 0.20  # 20% from right edge (adjustable)

# ============================================================================
# STANDARD RESOLUTION - Reference resolution for template matching
# ============================================================================
STANDARD_RESOLUTION_WIDTH = 1826
STANDARD_RESOLUTION_HEIGHT = 1301

# ============================================================================
# GLOBAL RESOLUTION SCALE - Moved to d3utils.share.game_interface_data
# ============================================================================
# These values are now managed in game_interface_data.py to avoid circular imports


# ============================================================================
# ASSISTANT EXECUTION STATE - Controls auto_use_interface_function execution
# ============================================================================
# Global state for assistant macro execution control
# States:
#   is_running: True if function is currently executing, False otherwise
#   should_stop: True if execution should stop, False otherwise
#   enabled: True if execution is allowed, False if disabled
ASSISTANT_EXECUTION_STATE = {
    "is_running": False,   # 程序运行中
    "should_stop": False,  # 请求中断
    "enabled": True        # 允许启动
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
# TEMPLATE CONFIGURATIONS - Global template paths and thresholds
# ============================================================================
TEMPLATE_CONFIGS = {
    # Bag templates
    "bag_opened_indicator": {
        "path": os.path.join(TEMPLATE_DIR, "bag_opened_indicator.png"),
        "threshold": 0.80,  # SIFT matching threshold for bag opened indicator
        "category": "bag",
        "use_alpha": False,
        "match_method": "ORB",
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
        "threshold": 0.85,  # SIFT matching threshold
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT"  # Use SIFT for icon matching
    },
    "blacksmith_indicator_2": {
        "path": os.path.join(TEMPLATE_DIR, "blacksmith_indicator_2.png"),
        "threshold": 0.85,  # SIFT matching threshold
        "category": "interface_indicator",
        "use_alpha": False,
        "match_method": "SIFT"  # Use SIFT for icon matching
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
    "button_put_material_alt": {
        "path": os.path.join(TEMPLATE_DIR, "button_put_material_alt.png"),
        "threshold": 0.65,  # Lowered threshold - button appears slightly different when panel opens
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT"
    },
    "button_convert_enabled": {
        "path": os.path.join(TEMPLATE_DIR, "button_convert_enabled.png"),
        "threshold": 0.8,  # Higher for button accuracy
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT"
    },
    "button_convert_disabled": {
        "path": os.path.join(TEMPLATE_DIR, "button_convert_disabled.png"),
        "threshold": 0.8,
        "category": "button",
        "use_alpha": False,
        "match_method": "SIFT"
    },
    "kanai_right_panel_toggle_icon": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_right_panel_toggle_icon.png"),
        "threshold": 0.75,  # SIFT matching threshold for icon
        "category": "icon",
        "use_alpha": False,
        "match_method": "SIFT"  # Use SIFT for accurate icon detection
    },
    "kanai_next_page_icon": {
        "path": os.path.join(TEMPLATE_DIR, "kanai_next_page_icon.png"),
        "threshold": 0.75,  # SIFT matching threshold for next page icon
        "category": "icon",
        "use_alpha": False,
        "match_method": "ORB"  # Use SIFT for accurate icon detection
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
        name: config for name, config in TEMPLATE_CONFIGS.items()
        if config.get("category") == category
    }

# Helper function to get template path
def get_template_path(template_name: str) -> Optional[str]:
    """Get template file path by name"""
    config = TEMPLATE_CONFIGS.get(template_name)
    return config["path"] if config else None

# Helper function to get template threshold
def get_template_threshold(template_name: str) -> float:
    """Get template matching threshold by name"""
    config = TEMPLATE_CONFIGS.get(template_name)
    return config.get("threshold", 0.8) if config else 0.8

# Helper function to get template match method
def get_template_match_method(template_name: str) -> str:
    """
    Get template matching method by name

    Returns:
        'SIFT', 'ORB', or 'TEMPLATE' (default)
    """
    config = TEMPLATE_CONFIGS.get(template_name)
    return config.get("match_method", "ORB") if config else "ORB"

# Helper function to get use_alpha setting
def get_template_use_alpha(template_name: str) -> bool:
    """Get whether template should use alpha channel"""
    config = TEMPLATE_CONFIGS.get(template_name)
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

# Dynamic path that needs DOCUMENTS_PATH
DOCUMENTS_PATH = os.path.expanduser("~/Documents")

# Game tab auto_id constants
DIABLO_III_TAB_AUTO_ID = "game-nav-btn-D3"

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
                
    except Exception as e:
        ColorPrint.debug(f"[DEBUG] Error syncing config: {e}")
        ColorPrint.red(f"Error syncing config: {e}")

def fix_config_with_template():
    """Fix current CONFIG with template before saving"""
    try:
        ColorPrint.debug("[DEBUG] Fixing CONFIG with template...")
        
        # Load template config
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            template_config = json.load(f)
        
        # Merge missing keys from template (template as source, CONFIG as target)
        # Only add missing keys, preserve existing user values
        modified = merge_template_to_config(template_config, CONFIG)
        
        if modified:
            ColorPrint.debug("[DEBUG] CONFIG fixed with missing keys from template")
        else:
            ColorPrint.debug("[DEBUG] CONFIG is already complete")
            
        return modified
        
    except Exception as e:
        ColorPrint.debug(f"[DEBUG] Error fixing CONFIG with template: {e}")
        return False

def save_config():
    """Save current CONFIG to user config file after fixing with template"""
    try:
        ColorPrint.debug("[DEBUG] Saving current CONFIG to file...")

        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            ColorPrint.debug(f"[DEBUG] Created user data directory: {CURRENT_USER_DATA_PATH}")

        # Clean up incorrect skill_configs at root level (legacy bug fix)
        if "skill_configs" in CONFIG and "macro_configs" in CONFIG:
            ColorPrint.debug("[DEBUG] Removing incorrect root-level skill_configs")
            del CONFIG["skill_configs"]

        # Fix CONFIG with template before saving
        fix_config_with_template()

        # Save current CONFIG to user config file
        with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
            json.dump(CONFIG, f, indent=2, ensure_ascii=False)

        ColorPrint.debug(f"[DEBUG] Current CONFIG saved to file: {CONFIG_USER_PATH}")

    except Exception as e:
        ColorPrint.debug(f"[DEBUG] Error saving config: {e}")
        ColorPrint.red(f"Error saving config: {e}")

def initialize_config():
    """Initialize configuration with one-time fix on startup"""
    global CONFIG
    if not CONFIG:
        ColorPrint.debug("[DEBUG] Initializing configuration...")
        
        # Force sync on first load to ensure template fixes are applied
        sync_config()
        
        try:
            # Load from user config path
            ColorPrint.debug(f"[DEBUG] Loading from user config file: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                CONFIG.update(json.load(f))
            ColorPrint.debug(f"[DEBUG] Config file loaded successfully: {CONFIG_USER_PATH}")
            ColorPrint.green(f"Configuration loaded from: {CONFIG_USER_PATH}")
        except Exception as e:
            ColorPrint.debug(f"[DEBUG] Failed to load config file: {e}")
            ColorPrint.red(f"Error loading config: {e}")
            CONFIG = {}

def load_config(force_sync: bool = False):
    """Load configuration from JSON file if CONFIG is empty."""
    global CONFIG
    if not CONFIG:
        ColorPrint.debug("[DEBUG] Starting config load...")
        
        # Only sync if explicitly requested or if user config doesn't exist
        if force_sync or not os.path.exists(CONFIG_USER_PATH):
            sync_config()
        
        try:
            # Always load from user config path
            ColorPrint.debug(f"[DEBUG] Loading from user config file: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                CONFIG.update(json.load(f))
            ColorPrint.debug(f"[DEBUG] Config file loaded successfully: {CONFIG_USER_PATH}")
            ColorPrint.green(f"Configuration loaded from: {CONFIG_USER_PATH}")
        except Exception as e:
            ColorPrint.debug(f"[DEBUG] Failed to load config file: {e}")
            ColorPrint.red(f"Error loading config: {e}")
            CONFIG = {}
    else:
        ColorPrint.debug("[DEBUG] Config file already loaded, skipping reload")

def get_dynamic_paths():
    """Get paths that depend on DOCUMENTS_PATH"""
    return {
        'ROSBOT_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("rosbot_relative", "RoS-BoT")),
        'ROSBOT_LOGS_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("rosbot_logs_relative", "RoS-BoT/Logs")),
        'D3CHECK_TEMP_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("d3check_temp_relative", ".d3check")),
        'ANNOTATED_SCREENSHOTS_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("annotated_screenshots_relative", ".d3check/annotated_screenshots")),
        'LOGS_FILE_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("logs_file_relative", "RoS-BoT/Logs/logs.txt")),
        'HISTORY_FILE_PATH': os.path.join(DOCUMENTS_PATH, CONFIG.get("paths", {}).get("history_file_relative", "RoS-BoT/Logs/history.txt"))
    }

# Load configuration on import
load_config()

# Export dynamic paths
_dynamic_paths = get_dynamic_paths()
ROSBOT_PATH = _dynamic_paths['ROSBOT_PATH']
ROSBOT_LOGS_PATH = _dynamic_paths['ROSBOT_LOGS_PATH'] 
D3CHECK_TEMP_PATH = _dynamic_paths['D3CHECK_TEMP_PATH']
ANNOTATED_SCREENSHOTS_PATH = _dynamic_paths['ANNOTATED_SCREENSHOTS_PATH']
LOGS_FILE_PATH = _dynamic_paths['LOGS_FILE_PATH']
HISTORY_FILE_PATH = _dynamic_paths['HISTORY_FILE_PATH']

# Static values available through CONFIG object

# Play button automation IDs
PLAY_BUTTON_AUTO_ID = "play-btn"
PLAY_BUTTON_MAIN_AUTO_ID = "play-btn-main"

# Play button automation IDs array for iteration
PLAY_BUTTON_AUTOMATION_IDS = [
    "play-btn",
    "play-btn-main",
    "play-button",
    "playButton",
    "start-game-btn",
    "launch-game-btn",
    "game-launch-btn"
]
