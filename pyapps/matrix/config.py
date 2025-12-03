"""
Matrix Application Configuration

Centralized configuration management following pycore standards
"""

import os
import platform
from pathlib import Path

from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT, CACHE_DIR


class Config:
    """Matrix Application Configuration"""

    # ==================== Application Info ====================
    APP_NAME = "matrix"

    # ==================== Project Paths ====================
    # Use pycore PROJECT_ROOT for consistency
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pyapps" / "matrix"
    RESOURCES_DIR = APP_ROOT / "resources"

    # Use pycore CACHE_DIR for consistency
    CACHE_DIR_PATH = Path(CACHE_DIR)

    # ==================== ADB Configuration ====================
    @staticmethod
    def get_adb_path() -> str:
        """
        Get ADB executable path

        Priority:
        1. Local resources/adb/{platform}/adb
        2. System PATH adb
        3. Return "adb" (fallback)

        Returns:
            ADB executable path
        """
        import shutil

        system = platform.system()
        adb_exe = "adb.exe" if system == 'Windows' else "adb"

        # 1. Check local ADB
        if system == 'Windows':
            adb_path = Config.RESOURCES_DIR / "adb" / "windows" / adb_exe
        elif system == 'Darwin':  # macOS
            adb_path = Config.RESOURCES_DIR / "adb" / "macos" / adb_exe
        else:  # Linux
            adb_path = Config.RESOURCES_DIR / "adb" / "linux" / adb_exe

        if adb_path.exists():
            return str(adb_path)

        # 2. Check system PATH
        adb_in_path = shutil.which(adb_exe)
        if adb_in_path:
            return adb_in_path

        # 3. Fallback
        return "adb"

    # scrcpy-server configuration (must match scrcpy_source version)
    SCRCPY_SERVER_JAR = RESOURCES_DIR / "scrcpy-server.jar"
    SCRCPY_SERVER_VERSION = "3.3.3"

    # ==================== Web Service Configuration ====================
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 8000

    # Frontend configuration (HARDCODED - modify here to change settings)
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "nuxt_main"
    FRONTEND_PORT = 38007  # Matrix frontend port (from app-config.json) - 38007 to avoid common port conflicts
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # Frontend mode: 'dev' (separate ports) or 'production' (unified port with backend)
    FRONTEND_MODE = "production"  # Change to "dev" for development

    # Skip build: True to skip compilation (use existing .output), False to compile
    FRONTEND_SKIP_BUILD = True  # Change to False to force rebuild

    # Force rebuild: True to force rebuild even if .output exists, False for normal behavior
    FRONTEND_FORCE_REBUILD = False  # Change to True to force rebuild

    # Static files directory (production mode)
    STATIC_DIR = APP_ROOT / "static"

    # ==================== Video Stream Configuration ====================
    DEFAULT_MAX_SIZE = 720          # Max resolution (short side)
    DEFAULT_BIT_RATE = 8000000      # 8 Mbps
    DEFAULT_MAX_FPS = 60            # Max frame rate
    DEFAULT_CODEC = "h264"          # Video codec

    # ==================== WebSocket Configuration ====================
    WS_BASE_PATH = "/ws"
    WS_VIDEO_PATH = "/ws/video/{serial}"      # Video stream
    WS_CONTROL_PATH = "/ws/control/{serial}"  # Device control
    WS_GROUP_PATH = "/ws/group"               # Group control

    # ==================== API Configuration ====================
    API_PREFIX = "/api"
    API_VERSION = "v1"

    # ==================== Logging Configuration ====================
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    # Use pycore CACHE_DIR for logs (following pycore standards)
    LOG_DIR = CACHE_DIR_PATH / "matrix" / "logs"

    # ==================== Runtime Mode ====================
    MODE = os.getenv("MATRIX_MODE", "dev")  # dev | production

    @classmethod
    def is_dev_mode(cls) -> bool:
        """Check if running in development mode"""
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        """Check if running in production mode"""
        return cls.MODE == "production"

    # ==================== Default Device Parameters ====================
    DEFAULT_DEVICE_PARAMS = {
        "max_size": DEFAULT_MAX_SIZE,
        "bit_rate": DEFAULT_BIT_RATE,
        "max_fps": DEFAULT_MAX_FPS,
        "codec": DEFAULT_CODEC,
        "control": True,
        "locked_video_orientation": -1,  # -1 = auto
    }

    # ==================== CORS Configuration ====================
    # Matrix frontend runs on port 38007 (defined in app-config.json)
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]


# Global configuration instance
config = Config()
