"""
pyMatrix 配置管理

统一管理所有配置项
"""

from pathlib import Path
import os
import platform


class Config:
    """pyMatrix 应用配置"""

    # ==================== 项目路径 ====================
    PROJECT_ROOT = Path(__file__).parent
    RESOURCES_DIR = PROJECT_ROOT / "resources"

    # ==================== ADB 配置 ====================
    @staticmethod
    def get_adb_path() -> str:
        """获取 ADB 可执行文件路径"""
        system = platform.system()

        if system == 'Windows':
            adb_path = Config.RESOURCES_DIR / "adb" / "windows" / "adb.exe"
        elif system == 'Darwin':  # macOS
            adb_path = Config.RESOURCES_DIR / "adb" / "macos" / "adb"
        else:  # Linux
            adb_path = Config.RESOURCES_DIR / "adb" / "linux" / "adb"

        if adb_path.exists():
            return str(adb_path)

        # 如果本地ADB不存在，尝试使用系统ADB
        return "adb"

    # scrcpy-server 配置
    SCRCPY_SERVER_JAR = RESOURCES_DIR / "scrcpy-server.jar"
    SCRCPY_SERVER_VERSION = "2.1"

    # ==================== Web 服务配置 ====================
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 8000

    # 前端配置
    FRONTEND_DIR = PROJECT_ROOT.parent.parent / "poly_apps" / "nuxt_main"
    FRONTEND_PORT = 3000  # Nuxt dev server 端口
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}/pymatrix"

    # 静态文件目录（生产模式）
    STATIC_DIR = PROJECT_ROOT / "static"

    # ==================== 视频流配置 ====================
    DEFAULT_MAX_SIZE = 720          # 最大分辨率（短边）
    DEFAULT_BIT_RATE = 8000000      # 8 Mbps
    DEFAULT_MAX_FPS = 60            # 最大帧率
    DEFAULT_CODEC = "h264"          # 视频编码格式

    # ==================== WebSocket 配置 ====================
    WS_BASE_PATH = "/ws"
    WS_VIDEO_PATH = "/ws/video/{serial}"      # 视频流
    WS_CONTROL_PATH = "/ws/control/{serial}"  # 设备控制
    WS_GROUP_PATH = "/ws/group"               # 群控

    # ==================== API 配置 ====================
    API_PREFIX = "/api"
    API_VERSION = "v1"

    # ==================== 日志配置 ====================
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR = PROJECT_ROOT / "logs"

    # ==================== 运行模式 ====================
    MODE = os.getenv("PYMATRIX_MODE", "dev")  # dev | production

    @classmethod
    def is_dev_mode(cls) -> bool:
        """是否为开发模式"""
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        """是否为生产模式"""
        return cls.MODE == "production"

    # ==================== 设备默认配置 ====================
    DEFAULT_DEVICE_PARAMS = {
        "max_size": DEFAULT_MAX_SIZE,
        "bit_rate": DEFAULT_BIT_RATE,
        "max_fps": DEFAULT_MAX_FPS,
        "codec": DEFAULT_CODEC,
        "control": True,
        "locked_video_orientation": -1,  # -1 = 自动
    }

    # ==================== CORS 配置 ====================
    CORS_ALLOW_ORIGINS = [
        f"http://localhost:{FRONTEND_PORT}",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]


# 全局配置实例
config = Config()
