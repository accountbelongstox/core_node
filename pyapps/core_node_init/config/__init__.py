"""
Configuration module for Core Node Init application
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from pycore.pygvar import (
    APP_LARGE_FILES_CACHE_DIR,
    APP_LARGE_FILES_TMP_DIR,
    APP_RUNTIME_CACHE_DIR,
    APP_RUNTIME_TMP_DIR
)


@dataclass
class BrowserConfig:
    """Browser configuration"""
    browser_type: str = 'chrome'
    headless: bool = True
    args: List[str] = None
    timeout: int = 30000
    devtools: bool = False
    ignore_https_errors: bool = True

    def __post_init__(self):
        if self.args is None:
            self.args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]


@dataclass
class DownloadConfig:
    """Download configuration"""
    cache_dir: str = APP_LARGE_FILES_CACHE_DIR
    temp_dir: str = APP_LARGE_FILES_TMP_DIR
    default_timeout: int = 300000
    retry_attempts: int = 3
    retry_delay: int = 5000


@dataclass
class LoggingConfig:
    """Logging configuration"""
    log_dir: str = APP_RUNTIME_CACHE_DIR
    log_level: str = 'INFO'
    max_log_size: int = 10485760  # 10MB
    backup_count: int = 5


@dataclass
class MCPServerConfig:
    """MCP Server configuration"""
    name: str = 'core_node_init_web_automation'
    version: str = '2.0.0'
    enable_browser: bool = True
    enable_frontend: bool = True
    enable_ittools: bool = True
    enable_electron: bool = False


@dataclass
class FrontendConfig:
    """Frontend development server configuration"""
    app_namespace: str = 'ittools'
    port: int = 7096
    timeout: int = 120000
    wait_for_ready: bool = True


@dataclass
class ITToolsConfig:
    """IT Tools integration configuration"""
    http_port: int = 19880
    ws_port: int = 19881
    host: str = 'localhost'
    enable_cors: bool = True
    enable_websocket: bool = True
    enable_http: bool = True


class Config:
    """Main application configuration"""

    def __init__(self):
        self.browser = BrowserConfig()
        self.download = DownloadConfig()
        self.logging = LoggingConfig()
        self.mcp_server = MCPServerConfig()
        self.frontend = FrontendConfig()
        self.ittools = ITToolsConfig()

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            'browser': self.browser.__dict__,
            'download': self.download.__dict__,
            'logging': self.logging.__dict__,
            'mcp_server': self.mcp_server.__dict__,
            'frontend': self.frontend.__dict__,
            'ittools': self.ittools.__dict__
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Config':
        """Create configuration from dictionary"""
        config = cls()
        if 'browser' in data:
            config.browser = BrowserConfig(**data['browser'])
        if 'download' in data:
            config.download = DownloadConfig(**data['download'])
        if 'logging' in data:
            config.logging = LoggingConfig(**data['logging'])
        if 'mcp_server' in data:
            config.mcp_server = MCPServerConfig(**data['mcp_server'])
        if 'frontend' in data:
            config.frontend = FrontendConfig(**data['frontend'])
        if 'ittools' in data:
            config.ittools = ITToolsConfig(**data['ittools'])
        return config


# Global configuration instance
config = Config()
