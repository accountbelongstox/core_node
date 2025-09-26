#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

class FlutterGlobalConfig:
    """Global configuration for Flutter development system"""

    def __init__(self):
        self.script_root_dir = Path(__file__).parent.parent.parent.parent
        self.dev_debug_dir = self.script_root_dir / "scripts" / "dev_debug"
        self.build_scripts_dir = self.script_root_dir / "scripts" / "build_scripts"
        self.build_dir = Path("D:/programing/.build_dir")
        self.flutter_project_dir = self.script_root_dir

        user_home = Path.home()
        self.core_node_user_cache = user_home / ".core_node" / ".flutter_build" / ".cache"
        self.ftemp_flutter_dir = self.core_node_user_cache / "flutter_bloom"
        self.cache_base_dir = user_home / ".flutter_bloom_cache"
        self.cache_flutter_dir = self.cache_base_dir / "settings"

        self.core_node_base_dir = user_home / ".core_node"
        self.flutter_build_base_dir = self.core_node_base_dir / ".flutter_build"
        self.gvar_exchange_dir = self.flutter_build_base_dir / "global_vars"

        # Port configuration
        self.flutter_default_web_port = 10000
        self.flutter_default_debug_port = 10080
        self.flutter_port_range_start = 10000
        self.flutter_port_range_end = 10099

        # Debug configuration
        self.debug_mode = False

        # Platform support
        self.supported_platforms = ["web", "android", "ios", "windows", "macos", "linux"]

        self._ensure_directories()

    def _ensure_directories(self):
        """Ensure all required directories exist"""
        directories = [
            self.core_node_base_dir,
            self.flutter_build_base_dir,
            self.gvar_exchange_dir,
            self.ftemp_flutter_dir,
            self.cache_flutter_dir
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

class GlobalKeys:
    """Global key constants for file variable storage"""

    # Selected app variables
    KEY_SELECTED_APP = "KEY_SELECTED_APP"
    KEY_SELECTED_ACTION = "KEY_SELECTED_ACTION"
    KEY_SELECTED_PLATFORM = "KEY_SELECTED_PLATFORM"
    KEY_SELECTED_ENTRY_FILE = "KEY_SELECTED_ENTRY_FILE"

    # App information
    KEY_APP_NAME = "KEY_APP_NAME"
    KEY_APP_INDEX = "KEY_APP_INDEX"
    KEY_DEBUG_PORT = "KEY_DEBUG_PORT"

    # Build configuration
    KEY_BUILD_ACTION = "KEY_BUILD_ACTION"
    KEY_BUILD_PLATFORM = "KEY_BUILD_PLATFORM"

    # Current active variables
    KEY_CURRENT_ACTIVE_APP = "KEY_CURRENT_ACTIVE_APP"
    KEY_CURRENT_ACTIVE_ACTION = "KEY_CURRENT_ACTIVE_ACTION"
    KEY_CURRENT_ACTIVE_PLATFORM = "KEY_CURRENT_ACTIVE_PLATFORM"

class DebugConfig:
    """Debug-specific configuration"""

    def __init__(self):
        self.default_action = "Debug"
        self.default_platform = "Web"
        self.supported_actions = ["Debug", "Build"]

        # Platform-specific configurations
        self.platform_configs = {
            "web": {
                "hostname": "0.0.0.0",
                "supports_hot_reload": True,
                "supports_debugging": True
            },
            "android": {
                "supports_hot_reload": True,
                "supports_debugging": True,
                "requires_device": True
            },
            "ios": {
                "supports_hot_reload": True,
                "supports_debugging": True,
                "requires_device": True,
                "requires_macos": True
            },
            "windows": {
                "supports_hot_reload": True,
                "supports_debugging": True,
                "requires_windows": True
            }
        }

# Global instances
global_config = FlutterGlobalConfig()
global_keys = GlobalKeys()
debug_config = DebugConfig()