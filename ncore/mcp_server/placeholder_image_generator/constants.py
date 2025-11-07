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
        "mcp", "Pillow", "requests"
    ]

    # Package name mappings for import checking
    PACKAGE_IMPORT_MAPPING = {
        'mcp': 'mcp',
        'Pillow': 'PIL',
        'requests': 'requests'
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
    
    # Placeholder types with detailed descriptions
    PLACEHOLDER_TYPES = {
        "unsplash_search": "[BEST FOR AI][REAL PHOTO] Search Unsplash by description (e.g. 'mountain sunset', 'city night') - RECOMMENDED for specific needs",
        "unsplash_image": "[RECOMMENDED][REAL PHOTO] Random Unsplash photo (high quality, auto-fallback)",
        "bing_image": "[REAL PHOTO] Random Bing photo (auto-fallback to other sources)",
        "normal": "[REAL PHOTO] Random from 4 sources: Unsplash/Bing/RPic/Ltyuanfang (auto-fallback)",
        "icon": "[BLANK PLACEHOLDER] Simple icon style with filename and size",
        "white": "[BLANK PLACEHOLDER] Pure white with filename and size (not recommended)",
        "default": "[BLANK PLACEHOLDER] Gray background with filename and size"
    }

    # Recommended usage guide for AI
    USAGE_RECOMMENDATIONS = {
        "need_specific_content": "Use 'unsplash_search' with description parameter (e.g. description='beach sunset')",
        "need_high_quality": "Use 'unsplash_image' for random professional photos",
        "need_variety": "Use 'normal' to get diverse images from multiple sources",
        "need_simple_placeholder": "Use 'icon' or 'default' for temporary placeholders"
    }

    # Image source descriptions
    IMAGE_SOURCE_INFO = {
        "unsplash": "Unsplash - High-quality professional photography",
        "bing": "Bing - Random image API",
        "rpic": "RPic - Random photography collection",
        "ltyuanfang": "Ltyuanfang - Landscape photography"
    }

    # Bing random image API
    BING_IMAGE_API = "https://bing.img.run/rand_1366x768.php"
    BING_FETCH_TIMEOUT = 10

    # Unsplash API configuration
    UNSPLASH_ACCESS_KEY = "sUgzcLPI22a7oOMYMCrO4gVdO3jOyXzOplktg5BGOCs"
    UNSPLASH_SECRET_KEY = "Qvn1_xptzrnWzSB1ToI0NDiRATloEpUy2_l1lixChQM"
    UNSPLASH_APPLICATION_ID = "825736"
    UNSPLASH_RANDOM_API = "https://api.unsplash.com/photos/random"
    UNSPLASH_SEARCH_API = "https://api.unsplash.com/search/photos"
    UNSPLASH_FETCH_TIMEOUT = 15

    # RPic photography API
    RPIC_IMAGE_API = "https://rpic.origz.com/api.php?category=photography"
    RPIC_FETCH_TIMEOUT = 15

    # Ltyuanfang landscape API
    LTYUANFANG_IMAGE_API = "https://tu.ltyuanfang.cn/api/fengjing.php"
    LTYUANFANG_FETCH_TIMEOUT = 15

    # All available image sources
    ALL_IMAGE_SOURCES = ["unsplash", "bing", "rpic", "ltyuanfang"]

    # MCP Tool capabilities
    TOOL_CAPABILITIES = [
        "generate_placeholder",
        "get_image_size",
        "replace_image",
        "list_placeholders",
        "check_path_access",
        "health_check"
    ]

    # Auto-approve tools
    AUTO_APPROVE_TOOLS = [
        "generate_placeholder",
        "get_image_size",
        "replace_image",
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
