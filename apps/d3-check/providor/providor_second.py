import json
import os
from datetime import datetime, time as dt_time
from typing import Optional, List, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

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
            print(f"Added missing key '{current_path}' to user config")
        elif isinstance(source_value, dict) and isinstance(user_dict[key], dict):
            # Both are dictionaries, recursively merge
            if merge_config_recursive(source_value, user_dict[key], current_path):
                modified = True
        # If key exists and values are not both dicts, keep user value unchanged
    
    return modified

def sync_config():
    """Sync configuration from CONFIG_PATH to CONFIG_USER_PATH with recursive merging"""
    try:
        # Create user data directory if it doesn't exist
        if not os.path.exists(CURRENT_USER_DATA_PATH):
            os.makedirs(CURRENT_USER_DATA_PATH)
            print(f"Created user data directory: {CURRENT_USER_DATA_PATH}")
        
        # Load source config
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            source_config = json.load(f)
        
        # Check if user config exists
        if not os.path.exists(CONFIG_USER_PATH):
            # Copy entire config file
            with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                json.dump(source_config, f, indent=2, ensure_ascii=False)
            print(f"Created user config file: {CONFIG_USER_PATH}")
        else:
            # Load existing user config
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
            
            # Recursively merge missing keys from source config
            modified = merge_config_recursive(source_config, user_config)
            
            # Save updated user config if modified
            if modified:
                with open(CONFIG_USER_PATH, 'w', encoding='utf-8') as f:
                    json.dump(user_config, f, indent=2, ensure_ascii=False)
                print(f"Updated user config file: {CONFIG_USER_PATH}")
            else:
                print("User config is up to date")
                
    except Exception as e:
        print(f"Error syncing config: {e}")

def load_config():
    """Load configuration from JSON file if CONFIG is empty."""
    global CONFIG
    if not CONFIG:
        # First sync the config
        sync_config()
        
        try:
            # Always load from user config path
            with open(CONFIG_USER_PATH, 'r', encoding='utf-8') as f:
                CONFIG.update(json.load(f))
            print(f"Configuration loaded from: {CONFIG_USER_PATH}")
        except Exception as e:
            print(f"Error loading config: {e}")
            CONFIG = {}

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

# Game State Management
class GameState:
    def __init__(self):
        self.mapstatus = "normal"  # "normal", "rift", "gem_upgrade", "paused", "inactive", "loop"
        self.previous_status = "normal"  # Store previous status for resume
        self.pause_time = 0.0  # Time when pause was triggered
        self.pause_duration = 120.0  # Pause duration in seconds
        self.last_rift_timer = 0.0
        self.gem_upgrade_count = 0
        self.gem_upgrade_max = 0
        self.last_gem_action = 0.0
        self.last_activity_time = 0.0  # Last activity timestamp
        self.inactive_timeout = 600.0  # 10 minutes timeout for inactive state
        self.loop_start_time = 0.0  # Time when loop state was activated
        self.loop_timeout = CONFIG.get('global_timeout', {}).get('loop_timeout_seconds', 60.0)  # Loop timeout in seconds
    
    def reset_gem_upgrade(self):
        """Reset gem upgrade state"""
        self.gem_upgrade_count = 0
        self.gem_upgrade_max = CONFIG.get('map_status', {}).get('gem_upgrade_action_count', 3)
        self.last_gem_action = 0.0
    
    def is_gem_upgrade_complete(self) -> bool:
        """Check if gem upgrade is complete"""
        return self.gem_upgrade_count >= self.gem_upgrade_max
    
    def pause(self, current_time: float):
        """Pause current state with timestamp"""
        if self.mapstatus != "paused":
            self.previous_status = self.mapstatus
            self.mapstatus = "paused"
            self.pause_time = current_time
    
    def resume(self):
        """Resume to previous state"""
        if self.mapstatus == "paused":
            self.mapstatus = self.previous_status
            self.pause_time = 0.0
    
    def should_resume(self, current_time: float) -> bool:
        """Check if pause duration has elapsed"""
        return (self.mapstatus == "paused" and 
                self.pause_time > 0 and 
                current_time - self.pause_time >= self.pause_duration)
    
    def activate_loop_state(self, current_time: float):
        """Activate loop state with timestamp"""
        if self.mapstatus != "loop":
            self.previous_status = self.mapstatus
            self.mapstatus = "loop"
            self.loop_start_time = current_time
            print(f"[MAP STATUS] Activated LOOP state")
    
    def deactivate_loop_state(self):
        """Deactivate loop state and return to previous state"""
        if self.mapstatus == "loop":
            self.mapstatus = self.previous_status
            self.loop_start_time = 0.0
            print(f"[MAP STATUS] Deactivated LOOP state, returned to {self.mapstatus}")
    
    def is_loop_timeout(self, current_time: float) -> bool:
        """Check if loop state has timed out"""
        return (self.mapstatus == "loop" and 
                self.loop_start_time > 0 and 
                current_time - self.loop_start_time >= self.loop_timeout)
    
    def update_activity_time(self, current_time: float):
        """Update last activity time and reactivate if inactive"""
        self.last_activity_time = current_time
        if self.mapstatus == "inactive":
            self.mapstatus = "normal"
            print(f"[MAP STATUS] Reactivated from INACTIVE to NORMAL mode")
    
    def check_inactive_timeout(self, current_time: float) -> bool:
        """Check if should transition to inactive state"""
        if (self.last_activity_time > 0 and 
            current_time - self.last_activity_time >= self.inactive_timeout):
            if self.mapstatus != "inactive":
                self.previous_status = self.mapstatus
                self.mapstatus = "inactive"
                print(f"[MAP STATUS] Transitioned to INACTIVE mode after {self.inactive_timeout}s timeout")
            return True
        return False

# Global game state instance
GAME_STATE = GameState()

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
