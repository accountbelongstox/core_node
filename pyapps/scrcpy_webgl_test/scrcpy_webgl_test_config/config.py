"""
Scrcpy WebGL Test Configuration

Centralized configuration management following pycore standards
"""

from pathlib import Path
from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT


class Config:
    """Scrcpy WebGL Test Configuration"""

    # ==================== Application Info ====================
    APP_NAME = "scrcpy_webgl_test"
    APP_DISPLAY_NAME = "Scrcpy WebGL Test - YUV Streaming"

    # ==================== Project Paths ====================
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pyapps" / "scrcpy_webgl_test"

    # ==================== Web Service Configuration ====================
    WEB_HOST = "127.0.0.1"
    WEB_PORT = 27881  # Dedicated port for WebGL test

    # ==================== Scrcpy Configuration ====================
    SCRCPY_SERVER_JAR = PROJECT_ROOT / "pyapps" / "matrix" / "resources" / "scrcpy-server.jar"
    SCRCPY_REMOTE_PATH = "/data/local/tmp/scrcpy-server.jar"

    # ==================== Video Configuration ====================
    # Default video parameters
    VIDEO_MAX_SIZE = 720  # Max resolution (height for portrait, width for landscape)
    VIDEO_MAX_FPS = 60
    VIDEO_BIT_RATE = 8_000_000  # 8 Mbps

    # ==================== Frontend Configuration ====================
    FRONTEND_FILE = APP_ROOT / "index.html"
