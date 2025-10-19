#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codebase Scanner MCP Server Constants
Centralized configuration and constants for the Codebase Scanner service
"""

import os
from pathlib import Path

class CodebaseScannerConstants:
    """Constants and configuration for Codebase Scanner MCP Server"""
    
    # Service Information
    SERVICE_NAME = "CodebaseScanner"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Advanced codebase analysis and file management tool"
    
    # Auto-detect PROJECT_ROOT (3 levels up from this file)
    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    
    # Service-specific paths
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "scanner.log"
    
    # Required packages
    REQUIRED_PACKAGES = [
        "mcp", "Pillow", "numpy"
    ]
    
    # Package name mappings for import checking
    PACKAGE_IMPORT_MAPPING = {
        'Pillow': 'PIL',
        'numpy': 'numpy',
        'mcp': 'mcp'
    }
    
    # Default configuration
    DEFAULT_CONFIG = {
        "enable_global_access": True,
        "max_depth": 5,
        "max_results": 100,
        "session_timeout_hours": 24,
        "log_level": "INFO"
    }
    
    # Supported file extensions for analysis
    SUPPORTED_IMAGE_EXTENSIONS = {
        '.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp'
    }
    
    SUPPORTED_TEXT_EXTENSIONS = {
        '.txt', '.md', '.py', '.js', '.ts', '.html', '.css', '.json', '.xml',
        '.yaml', '.yml', '.ini', '.cfg', '.conf', '.log', '.sql', '.sh', '.bat'
    }
    
    # Flutter-specific paths
    FLUTTER_ROOT_NAME = "flutter_bloom"
    FLUTTER_APPS_DIR = "lib/apps"
    FLUTTER_COMMON_DIR = "lib/common"
    FLUTTER_ASSETS_DIR = "assets"
    
    # Environment variables (paths are derived, not set)
    ENV_VARS = {
        "ENABLE_GLOBAL_ACCESS": "true",
        "MCP_ALLOW_ALL_PATHS": "true"
    }
    
    # MCP Tool capabilities
    TOOL_CAPABILITIES = [
        "generate_directory_tree",
        "find_file_by_name",
        "search_content_in_files", 
        "get_codebase_stats",
        "find_file_by_path",
        "analyze_image_pixels",
        "scan_flutter_apps",
        "print_flutter_app_structure",
        "health_check"
    ]
    
    # Auto-approve tools (tools that don't require user confirmation)
    AUTO_APPROVE_TOOLS = [
        "generate_directory_tree",
        "find_file_by_name",
        "search_content_in_files",
        "get_codebase_stats", 
        "find_file_by_path",
        "analyze_image_pixels",
        "scan_flutter_apps",
        "print_flutter_app_structure",
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
