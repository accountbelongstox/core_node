# -*- coding: utf-8 -*-
"""
Pycore Callmodule Configuration

Single source of truth: all configuration in this file (no YAML/loader).
Used by: callmodule/config.py (build_launcher_config), callmodule_main.py.
"""

import os
import platform
from pathlib import Path

from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT


class Config:
    """Callmodule Configuration - all values in this class."""

    # ==================== Application Info ====================
    APP_NAME = "callmodule"
    APP_ID = "pycore_module_caller"
    APP_DISPLAY_NAME = "Pycore Module Caller"

    # ==================== Project Paths ====================
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pycore" / "callmodule"
    RESOURCES_DIR = APP_ROOT / "resources"

    # ==================== Backend ====================
    RPC_HOST = "0.0.0.0"
    RPC_PORT = 59000

    # ==================== Singleton (shared with pylauncher) ====================
    SINGLETON_PORT_START = 59100
    SINGLETON_PORT_RANGE = 100

    # ==================== Frontend Configuration ====================
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore-management"
    FRONTEND_PORT = 3100
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
    FRONTEND_MODE = "dev"
    FRONTEND_SKIP_BUILD = False
    FRONTEND_FORCE_REBUILD = False

    # ==================== UI Configuration ====================
    IS_WINDOWS = platform.system() == 'Windows'
    IS_LINUX = platform.system() == 'Linux'
    WINDOW_WIDTH = 1400
    WINDOW_HEIGHT = 900
    FRAMELESS = True
    SHOW_UI_ON_START = IS_WINDOWS
    ENABLE_TRAY = IS_WINDOWS

    # ==================== Debug Window ====================
    DEBUG_WINDOW_WIDTH = 650
    DEBUG_WINDOW_HEIGHT = 500
    MIN_DISPLAY_TIME = 2.0
    ENABLE_LANGUAGE_SELECTOR = True

    # ==================== Launcher (build_launcher_config) ====================
    LAUNCHER_APP_ID = "pycore_module_caller"
    LAUNCHER_APP_NAME = "Pycore Module Caller"

    # ==================== UI service (Voice Subtitle) ====================
    UI_APP_NAME = "Voice Subtitle"
    UI_APP_ID = "voice_subtitle_ui"
    UI_WINDOW_SIZE = (1000, 180)
    UI_SHOW_ON_START = True
    UI_FRAMELESS = False
    UI_ENABLE_TRAY = False
    UI_SHOW_STARTUP = True
    UI_AUTO_CLOSE_STARTUP = False

    # ==================== Tray service ====================
    TRAY_APP_NAME = "Pycore RPC Server"
    TRAY_ICON_PATH_REL = "pyutils/native_ui/step1_config/app_icon.png"
    TRAY_TRIGGER_SHUTDOWN_ON_EXIT = True

    # ==================== Runtime Mode ====================
    MODE = os.getenv("CALLMODULE_MODE", "dev")

    # ==================== CORS ====================
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{RPC_PORT}",
        f"http://127.0.0.1:{RPC_PORT}",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]

    @classmethod
    def is_dev_mode(cls) -> bool:
        """Check if running in development mode"""
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        """Check if running in production mode"""
        return cls.MODE == "production"


# Global configuration instance
config = Config()
