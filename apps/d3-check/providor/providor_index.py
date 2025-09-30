import json
import os
import sys
from datetime import datetime, time as dt_time
from typing import Optional, List, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)
from pytools.pyfoundations.color_print import ColorPrint

# Root directory (../../ from current file)
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))


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
            ColorPrint.green(f"[DEBUG] Added missing config key: '{current_path}' = {source_value}")
        elif isinstance(source_value, dict) and isinstance(user_dict[key], dict):
            # Both are dictionaries, recursively merge
            if merge_config_recursive(source_value, user_dict[key], current_path):
                modified = True
        # If key exists and values are not both dicts, keep user value unchanged
    
    return modified

def sync_config():
    """Sync configuration from template to user config and save immediately"""
    try:
        ColorPrint.blue("[DEBUG] Starting config sync...")
        
        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            ColorPrint.green(f"[DEBUG] Created user data directory: {CURRENT_USER_DATA_PATH}")
        
        # Load template config
        ColorPrint.blue(f"[DEBUG] Loading template config: {CONFIG_PATH}")
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            template_config = json.load(f)
        
        # Check if user config exists
        if not os.path.exists(CONFIG_USER_PATH):
            # Copy entire template config file
            ColorPrint.yellow(f"[DEBUG] User config file does not exist, creating new file: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                json.dump(template_config, f, indent=2, ensure_ascii=False)
            ColorPrint.green(f"[DEBUG] User config file created: {CONFIG_USER_PATH}")
        else:
            # Load existing user config
            ColorPrint.blue(f"[DEBUG] Loading existing user config: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
            
            # Recursively merge missing keys from template config
            ColorPrint.blue("[DEBUG] Starting recursive config merge...")
            modified = merge_config_recursive(template_config, user_config)
            
            # Always save to ensure consistency
            ColorPrint.blue("[DEBUG] Saving config to file...")
            with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                json.dump(user_config, f, indent=2, ensure_ascii=False)
            
            if modified:
                ColorPrint.green(f"[DEBUG] User config file updated with missing keys: {CONFIG_USER_PATH}")
            else:
                ColorPrint.blue("[DEBUG] User config file is up to date")
                
    except Exception as e:
        ColorPrint.red(f"[DEBUG] Error syncing config: {e}")
        print(f"Error syncing config: {e}")

def fix_config_with_template():
    """Fix current CONFIG with template before saving"""
    try:
        ColorPrint.blue("[DEBUG] Fixing CONFIG with template...")
        
        # Load template config
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            template_config = json.load(f)
        
        # Merge missing keys from template
        modified = merge_config_recursive(template_config, CONFIG)
        
        if modified:
            ColorPrint.green("[DEBUG] CONFIG fixed with missing keys from template")
        else:
            ColorPrint.blue("[DEBUG] CONFIG is already complete")
            
        return modified
        
    except Exception as e:
        ColorPrint.red(f"[DEBUG] Error fixing CONFIG with template: {e}")
        return False

def save_config():
    """Save current CONFIG to user config file after fixing with template"""
    try:
        ColorPrint.blue("[DEBUG] Saving current CONFIG to file...")
        
        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            ColorPrint.green(f"[DEBUG] Created user data directory: {CURRENT_USER_DATA_PATH}")
        
        # Fix CONFIG with template before saving
        fix_config_with_template()
        
        # Save current CONFIG to user config file
        with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
            json.dump(CONFIG, f, indent=2, ensure_ascii=False)
        
        ColorPrint.green(f"[DEBUG] Current CONFIG saved to file: {CONFIG_USER_PATH}")
        
    except Exception as e:
        ColorPrint.red(f"[DEBUG] Error saving config: {e}")
        print(f"Error saving config: {e}")

def load_config():
    """Load configuration from JSON file if CONFIG is empty."""
    global CONFIG
    if not CONFIG:
        ColorPrint.blue("[DEBUG] Starting config load...")
        # First sync the config to ensure template fixes are applied
        sync_config()
        
        try:
            # Always load from user config path
            ColorPrint.blue(f"[DEBUG] Loading from user config file: {CONFIG_USER_PATH}")
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                CONFIG.update(json.load(f))
            ColorPrint.green(f"[DEBUG] Config file loaded successfully: {CONFIG_USER_PATH}")
            print(f"Configuration loaded from: {CONFIG_USER_PATH}")
        except Exception as e:
            ColorPrint.red(f"[DEBUG] Failed to load config file: {e}")
            print(f"Error loading config: {e}")
            CONFIG = {}
    else:
        ColorPrint.blue("[DEBUG] Config file already loaded, skipping reload")

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
