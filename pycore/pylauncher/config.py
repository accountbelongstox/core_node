#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Launcher Configuration
Defines parameters for all services
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from pathlib import Path
import json


@dataclass
class WebServiceConfig:
    """
    Web Service (WS/HTTPS) Configuration

    Configures FastAPI + WebSocket services
    """
    # Server configuration
    host: str = "localhost"
    http_port: int = 8000
    ws_port: int = 8001

    # SSL/HTTPS configuration
    enable_https: bool = False
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None

    # Server options
    workers: int = 1
    reload: bool = False
    log_level: str = "info"

    # CORS configuration
    enable_cors: bool = True
    cors_origins: List[str] = field(default_factory=lambda: ["*"])

    # Additional options
    extra_options: Dict[str, Any] = field(default_factory=dict)

    # Enable/disable service
    enabled: bool = True


@dataclass
class MCPServiceConfig:
    """
    MCP Service Configuration

    Configures Model Context Protocol server
    """
    # Singleton detection port
    singleton_port: int = 19997

    # RPC communication port
    rpc_port: int = 8767

    # Server host
    host: str = "localhost"

    # Debug mode
    debug: bool = True

    # Auto-load services
    auto_load_services: bool = True

    # Service directories
    service_dirs: List[str] = field(default_factory=list)

    # Enable/disable service
    enabled: bool = True


@dataclass
class UIServiceConfig:
    """
    Native UI Service Configuration

    Configures Tkinter-based native UI framework
    """
    # Application configuration
    app_name: str = "Unified Application"

    # Window configuration
    window_size: tuple = (1280, 800)
    min_window_size: tuple = (800, 600)

    # Window behavior
    frameless: bool = True
    show_on_start: bool = True
    resizable: bool = True

    # UI content source
    ui_source: Optional[str] = None  # URL or HTML file path

    # Theme
    theme: str = "default"

    # Debug mode
    debug: bool = False

    # System Tray configuration
    enable_tray: bool = False
    tray_icon_path: Optional[str] = None
    tray_tooltip: Optional[str] = None

    # Enable/disable service
    enabled: bool = True


@dataclass
class SeleniumServiceConfig:
    """
    Selenium Service Configuration

    Configures browser automation (pybrowser)
    """
    # Browser type
    browser_type: str = "chrome"  # chrome, edge, firefox

    # Browser options
    headless: bool = False
    disable_gpu: bool = True
    no_sandbox: bool = True

    # WebDriver configuration
    driver_path: Optional[str] = None
    binary_path: Optional[str] = None

    # Session configuration
    max_sessions: int = 5
    session_timeout: int = 3600  # seconds

    # Resource pool
    pool_size: int = 3
    pool_timeout: int = 30

    # Debug mode
    debug: bool = False

    # Enable/disable service
    enabled: bool = True


@dataclass
class LauncherConfig:
    """
    Unified Launcher Configuration

    Complete configuration for all services

    Parameters:
        web_service: Web/WebSocket service configuration
        mcp_service: MCP server configuration
        ui_service: Native UI configuration
        selenium_service: Selenium browser automation configuration

    Example:
        ```python
        config = LauncherConfig(
            web_service=WebServiceConfig(
                http_port=8000,
                ws_port=8001,
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                singleton_port=19997,
                rpc_port=8767,
                enabled=True
            ),
            ui_service=UIServiceConfig(
                app_name="My Application",
                window_size=(1280, 800),
                enabled=True
            ),
            selenium_service=SeleniumServiceConfig(
                browser_type="chrome",
                headless=False,
                enabled=True
            )
        )
        ```
    """
    # Service configurations
    web_service: WebServiceConfig = field(default_factory=WebServiceConfig)
    mcp_service: MCPServiceConfig = field(default_factory=MCPServiceConfig)
    ui_service: UIServiceConfig = field(default_factory=UIServiceConfig)
    selenium_service: SeleniumServiceConfig = field(default_factory=SeleniumServiceConfig)

    # Global configuration
    project_root: Optional[Path] = None
    log_dir: Optional[Path] = None

    # Startup behavior
    auto_start_all: bool = True
    startup_delay: float = 0.5  # Delay between service starts (seconds)

    # Shutdown behavior
    graceful_shutdown_timeout: int = 10  # seconds

    def __post_init__(self):
        """Post-initialization setup"""
        if self.project_root is None:
            self.project_root = Path(__file__).parent.parent.parent

        if self.log_dir is None:
            self.log_dir = self.project_root / "logs"

        # Ensure paths are Path objects
        self.project_root = Path(self.project_root)
        self.log_dir = Path(self.log_dir)

    def get_enabled_services(self) -> List[str]:
        """Get list of enabled service names"""
        enabled = []

        if self.web_service.enabled:
            enabled.append("web_service")
        if self.mcp_service.enabled:
            enabled.append("mcp_service")
        if self.ui_service.enabled:
            enabled.append("ui_service")
        if self.selenium_service.enabled:
            enabled.append("selenium_service")

        return enabled

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            'web_service': self.web_service.__dict__,
            'mcp_service': self.mcp_service.__dict__,
            'ui_service': self.ui_service.__dict__,
            'selenium_service': self.selenium_service.__dict__,
            'project_root': str(self.project_root),
            'log_dir': str(self.log_dir),
            'auto_start_all': self.auto_start_all,
            'startup_delay': self.startup_delay,
            'graceful_shutdown_timeout': self.graceful_shutdown_timeout,
        }

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'LauncherConfig':
        """
        Create LauncherConfig from dictionary

        Args:
            config_dict: Configuration dictionary

        Returns:
            LauncherConfig instance
        """
        # Extract service configurations
        web_config_dict = config_dict.get('web_service', {})
        mcp_config_dict = config_dict.get('mcp_service', {})
        ui_config_dict = config_dict.get('ui_service', {})
        selenium_config_dict = config_dict.get('selenium_service', {})

        # Create service configurations
        web_service = WebServiceConfig(**web_config_dict)
        mcp_service = MCPServiceConfig(**mcp_config_dict)
        ui_service = UIServiceConfig(**ui_config_dict)
        selenium_service = SeleniumServiceConfig(**selenium_config_dict)

        # Extract global settings
        project_root = config_dict.get('project_root')
        log_dir = config_dict.get('log_dir')
        auto_start_all = config_dict.get('auto_start_all', True)
        startup_delay = config_dict.get('startup_delay', 0.5)
        graceful_shutdown_timeout = config_dict.get('graceful_shutdown_timeout', 10)

        # Create LauncherConfig
        return cls(
            web_service=web_service,
            mcp_service=mcp_service,
            ui_service=ui_service,
            selenium_service=selenium_service,
            project_root=project_root,
            log_dir=log_dir,
            auto_start_all=auto_start_all,
            startup_delay=startup_delay,
            graceful_shutdown_timeout=graceful_shutdown_timeout
        )

    @classmethod
    def from_json_file(cls, file_path: str) -> 'LauncherConfig':
        """
        Load configuration from JSON file

        Args:
            file_path: Path to JSON configuration file

        Returns:
            LauncherConfig instance

        Example JSON format:
            ```json
            {
                "web_service": {
                    "host": "localhost",
                    "http_port": 8000,
                    "enabled": true
                },
                "mcp_service": {
                    "rpc_port": 8767,
                    "enabled": true
                },
                "ui_service": {
                    "app_name": "My App",
                    "window_size": [1280, 800],
                    "enabled": true
                },
                "selenium_service": {
                    "enabled": false
                },
                "auto_start_all": true,
                "startup_delay": 0.5
            }
            ```
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            config_dict = json.load(f)

        # Convert window_size from list to tuple if present
        if 'ui_service' in config_dict and 'window_size' in config_dict['ui_service']:
            config_dict['ui_service']['window_size'] = tuple(config_dict['ui_service']['window_size'])
        if 'ui_service' in config_dict and 'min_window_size' in config_dict['ui_service']:
            config_dict['ui_service']['min_window_size'] = tuple(config_dict['ui_service']['min_window_size'])

        # Convert cors_origins from list if present
        if 'web_service' in config_dict and 'cors_origins' in config_dict['web_service']:
            if not isinstance(config_dict['web_service']['cors_origins'], list):
                config_dict['web_service']['cors_origins'] = [config_dict['web_service']['cors_origins']]

        return cls.from_dict(config_dict)

    def save_to_json_file(self, file_path: str):
        """
        Save configuration to JSON file

        Args:
            file_path: Path to save JSON configuration
        """
        config_dict = self.to_dict()

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)
