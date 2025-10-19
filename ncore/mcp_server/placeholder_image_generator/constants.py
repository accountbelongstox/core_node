#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Placeholder Image Generator MCP Server Constants
Centralized configuration and constants for the Placeholder Image Generator service
"""

import os
from pathlib import Path

class PlaceholderImageGeneratorConstants:
    """Constants and configuration for Placeholder Image Generator MCP Server"""
    
    # Service Information
    SERVICE_NAME = "PlaceholderImageGenerator"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Generate placeholder images with filename and dimensions overlay"
    
    # Auto-detect PROJECT_ROOT (3 levels up from this file)
    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    
    # Service-specific paths
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "placeholder_generator.log"
    
    # Required packages
    REQUIRED_PACKAGES = [
        "mcp", "Pillow", "numpy"
    ]
    
    # Package name mappings for import checking
    PACKAGE_IMPORT_MAPPING = {
        'mcp': 'mcp',
        'Pillow': 'PIL',
        'numpy': 'numpy'
    }
    
    # Default configuration
    DEFAULT_CONFIG = {
        "default_width": 800,
        "default_height": 600,
        "default_bg_color": "#f0f0f0",
        "default_text_color": "#333333",
        "session_timeout_hours": 24,
        "log_level": "INFO"
    }
    
    # Supported image formats
    SUPPORTED_FORMATS = {
        'png': 'PNG',
        'jpg': 'JPEG',
        'jpeg': 'JPEG',
        'bmp': 'BMP',
        'gif': 'GIF',
        'tiff': 'TIFF',
        'webp': 'WEBP'
    }
    
    # Default colors
    DEFAULT_COLORS = {
        'background': '#f0f0f0',
        'text': '#333333',
        'border': '#cccccc'
    }
    
    # Environment variables (paths are derived, not set)
    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true"
    }
    
    # MCP Tool capabilities
    TOOL_CAPABILITIES = [
        "generate_placeholder",
        "list_placeholders",
        "check_path_access",
        "health_check"
    ]
    
    # Auto-approve tools
    AUTO_APPROVE_TOOLS = [
        "generate_placeholder",
        "list_placeholders",
        "check_path_access",
        "health_check"
    ]
    
    @classmethod
    def get_project_root(cls) -> Path:
        """Get the project root directory"""
        return cls.PROJECT_ROOT
    
    @classmethod
    def get_service_root(cls) -> Path:
        """Get the service root directory"""
        return cls.SERVICE_ROOT
    
    @classmethod
    def get_tmp_dir(cls) -> Path:
        """Get the temporary directory for sessions"""
        return cls.TMP_DIR
    
    @classmethod
    def ensure_directories(cls):
        """Ensure all required directories exist"""
        cls.TMP_DIR.mkdir(exist_ok=True)
    
    @classmethod
    def get_env_vars(cls) -> dict:
        """Get environment variables for this service"""
        return cls.ENV_VARS.copy()
    
    @classmethod
    def get_mcp_config(cls) -> dict:
        """Get MCP server configuration"""
        return {
            "command": "cmd",
            "args": [
                "/c",
                "python",
                str(cls.SERVICE_ROOT / "main.py")
            ],
            "env": cls.get_env_vars(),
            "disabled": False,
            "autoApprove": cls.AUTO_APPROVE_TOOLS
        }
