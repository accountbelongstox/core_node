#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Processor MCP Server Constants
Centralized configuration and constants for the File Processor service
"""

import os
from pathlib import Path

class FileProcessorConstants:
    """Constants and configuration for File Processor MCP Server"""

    # Service Information
    SERVICE_NAME = "FileProcessor"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Universal file and document processor for AI-readable content extraction"
    
    # Auto-detect PROJECT_ROOT (3 levels up from this file)
    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    
    # Service-specific paths
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "file_processor.log"
    
    # Required packages
    REQUIRED_PACKAGES = [
        "mcp", "Pillow", "numpy", "pymupdf", "python-docx", "openpyxl", 
        "pandas", "lxml", "beautifulsoup4", "requests", "paddlepaddle", "paddleocr"
    ]
    
    # Package name mappings for import checking
    PACKAGE_IMPORT_MAPPING = {
        'Pillow': 'PIL',
        'numpy': 'numpy',
        'mcp': 'mcp',
        'pymupdf': 'fitz',
        'python-docx': 'docx',
        'openpyxl': 'openpyxl',
        'pandas': 'pandas',
        'lxml': 'lxml',
        'beautifulsoup4': 'bs4',
        'requests': 'requests',
        'paddlepaddle': 'paddle',
        'paddleocr': 'paddleocr'
    }
    
    # Default configuration
    DEFAULT_CONFIG = {
        "max_file_size_mb": 50,
        "ocr_confidence_threshold": 30,
        "session_timeout_hours": 24,
        "log_level": "INFO"
    }
    
    # Supported document formats
    SUPPORTED_FORMATS = {
        'pdf': ['pdf'],
        'office': ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'],
        'text': ['txt', 'md', 'html', 'xml', 'json'],
        'images': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'webp']
    }
    
    # OCR engines
    OCR_ENGINES = {
        'free': 'Free OCR (OCR.space)',
        'tencent': 'Tencent Cloud OCR',
        'paddle': 'PaddleOCR',
        'auto': 'Automatic fallback'
    }
    
    # Environment variables (paths are derived, not set)
    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true"
    }
    
    # MCP Tool capabilities
    TOOL_CAPABILITIES = [
        "parse_document",
        "convert_document",
        "write_document",
        "batch_convert",
        "list_supported_formats",
        "list_conversion_formats",
        "initialize_packages",
        "ocr_recognize",
        "configure_ocr",
        "list_ocr_engines",
        "smart_ocr_recognize",
        "get_ocr_task_status",
        "get_ocr_batch_status",
        "get_ocr_system_status",
        "analyze_image_pixels",
        "health_check"
    ]

    # Auto-approve tools
    AUTO_APPROVE_TOOLS = [
        "parse_document",
        "convert_document",
        "write_document",
        "batch_convert",
        "list_supported_formats",
        "list_conversion_formats",
        "initialize_packages",
        "ocr_recognize",
        "configure_ocr",
        "list_ocr_engines",
        "smart_ocr_recognize",
        "get_ocr_task_status",
        "get_ocr_batch_status",
        "get_ocr_system_status",
        "analyze_image_pixels",
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
