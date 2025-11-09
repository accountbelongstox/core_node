"""
Matrix Application Configuration

Centralized configuration management following pycore standards
"""

import os
import platform
from pathlib import Path


class Config:
    """Matrix Application Configuration"""

    # ==================== Application Info ====================
    APP_NAME = "matrix"

    # ==================== Project Paths ====================
    PROJECT_ROOT = Path(__file__).parent
    RESOURCES_DIR = PROJECT_ROOT / "resources"

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
        system = platform.system()

        # 1. Check local ADB
        if system == 'Windows':
            adb_path = Config.RESOURCES_DIR / "adb" / "windows" / "adb.exe"
        elif system == 'Darwin':  # macOS
            adb_path = Config.RESOURCES_DIR / "adb" / "macos" / "adb"
        else:  # Linux
            adb_path = Config.RESOURCES_DIR / "adb" / "linux" / "adb"

        if adb_path.exists():
            return str(adb_path)

        # 2. Check system PATH
        import shutil
        adb_exe = "adb.exe" if system == 'Windows' else "adb"
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

    # Frontend configuration
    FRONTEND_DIR = PROJECT_ROOT.parent.parent / "poly_apps" / "nuxt_main"
    FRONTEND_PORT = 3007  # Matrix frontend port (from app-config.json)
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # Static files directory (production mode)
    STATIC_DIR = PROJECT_ROOT / "static"

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
    LOG_DIR = PROJECT_ROOT / "logs"

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
    # Matrix frontend runs on port 3007 (defined in app-config.json)
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",  # 3007
        f"http://127.0.0.1:{FRONTEND_PORT}",  # 3007
        "http://localhost:3000",  # Fallback for other Nuxt apps
        "http://127.0.0.1:3000",  # Fallback for other Nuxt apps
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]


# Global configuration instance
config = Config()
