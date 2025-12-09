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
        1. User data directory (from scrcpy_init.py)
        2. System PATH adb
        3. Return "adb" (fallback)

        Returns:
            ADB executable path
        """
        import shutil
        from pycore.pyutils.scrcpy_init import get_adb_path as get_init_adb_path

        # 1. Try to get from user data directory (auto-extracts if needed)
        try:
            adb_path = get_init_adb_path()
            if adb_path and adb_path.exists():
                return str(adb_path)
        except Exception as e:
            print(f"[Config] Warning: Failed to get ADB from scrcpy_init: {e}")

        # 2. Check system PATH
        system = platform.system()
        adb_exe = "adb.exe" if system == 'Windows' else "adb"
        adb_in_path = shutil.which(adb_exe)
        if adb_in_path:
            return adb_in_path

        # 3. Fallback
        return "adb"

    # scrcpy-server configuration (must match scrcpy_source version)
    SCRCPY_SERVER_VERSION = "3.3.3"

    @staticmethod
    def get_scrcpy_server_jar() -> Path:
        """
        Get scrcpy-server.jar path

        Returns:
            Path to scrcpy-server.jar in project resources
        """
        return Config.RESOURCES_DIR / "scrcpy-server.jar"

    # For backward compatibility
    SCRCPY_SERVER_JAR = RESOURCES_DIR / "scrcpy-server.jar"

    # ==================== Web Service Configuration ====================
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 48000  # High port number to avoid conflicts

    # ==================== Frontend Configuration ====================
    # Frontend framework: Vite + React (matrixui)
    # Previous: Nuxt multi-app (deprecated)

    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "matrixui"  # Vite + React frontend
    FRONTEND_PORT = 38007  # Matrix frontend port (from app-config.json)
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

    # Frontend modes:
    # - "dev": Hot reload development
    #   * Starts Vite dev server on port 38007
    #   * Frontend runs independently with hot reload
    #   * Backend (RPC v2) on port 48000 for API only
    #   * WebView points to http://localhost:38007
    #
    # - "production": Production build
    #   * Compiles frontend to dist/ folder
    #   * RPC v2 serves static files at /
    #   * Single port (48000) for both frontend and backend
    #   * WebView points to http://localhost:48000

    FRONTEND_MODE = "dev"  # Current mode: dev for hot reload debugging

    # Build control (production mode only)
    FRONTEND_SKIP_BUILD = False  # False: build when needed, True: use existing dist
    FRONTEND_FORCE_REBUILD = False  # True: always rebuild, False: normal behavior

    # Static files directory (production mode)
    STATIC_DIR = APP_ROOT / "static"

    # ==================== Video Stream Configuration ====================
    DEFAULT_MAX_SIZE = 720          # Max resolution (short side)
    DEFAULT_BIT_RATE = 8000000      # 8 Mbps
    DEFAULT_MAX_FPS = 60            # Max frame rate
    DEFAULT_CODEC = "h264"          # Video codec

    # Video Stream Mode:
    # - "h264": H.264 direct transmission (recommended, low bandwidth)
    # - "yuv": YUV420P decoded stream (experimental, high bandwidth)
    DEFAULT_VIDEO_STREAM_MODE = "h264"

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
        "video_stream_mode": DEFAULT_VIDEO_STREAM_MODE,  # "h264" or "yuv"
    }

    # ==================== Configuration File Storage ====================
    @staticmethod
    def get_config_dir() -> Path:
        """
        Get configuration directory based on platform

        Returns:
            Configuration directory path
            - Windows: %USERPROFILE%/.core_node/scrcpy/config
            - Linux: /var/_core_node/scrcpy/config
        """
        system = platform.system()

        if system == "Windows":
            # Windows: User data directory
            user_home = Path.home()
            config_dir = user_home / ".core_node" / "scrcpy" / "config"
        else:
            # Linux/Unix: System directory
            config_dir = Path("/var/_core_node/scrcpy/config")

        # Ensure directory exists
        config_dir.mkdir(parents=True, exist_ok=True)

        return config_dir

    @classmethod
    def get_config_file_path(cls) -> Path:
        """
        Get configuration file path

        Returns:
            Full path to settings.json
        """
        return cls.get_config_dir() / "settings.json"

    # ==================== CORS Configuration ====================
    # Matrix frontend runs on FRONTEND_PORT (dev: 38007 Vite, prod: 48000 RPC v2)
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
        f"http://localhost:{WEB_PORT}",  # Backend port (48000)
        f"http://127.0.0.1:{WEB_PORT}",  # Backend port (48000)
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]


# Global configuration instance
config = Config()
