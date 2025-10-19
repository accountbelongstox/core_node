#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
McpAlchemy MCP Server Constants
Centralized configuration and constants for the McpAlchemy service
"""

import os
from pathlib import Path

class McpAlchemyConstants:
    """Constants and configuration for McpAlchemy MCP Server"""
    
    # Service Information
    SERVICE_NAME = "McpAlchemy"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Advanced database management and query tool"
    
    # Auto-detect PROJECT_ROOT (3 levels up from this file)
    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    
    # Service-specific paths
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "mcp_alchemy.log"
    
    # Required packages
    REQUIRED_PACKAGES = [
        "mcp", "sqlalchemy", "pandas", "numpy"
    ]
    
    # Package name mappings for import checking
    PACKAGE_IMPORT_MAPPING = {
        'mcp': 'mcp',
        'sqlalchemy': 'sqlalchemy',
        'pandas': 'pandas',
        'numpy': 'numpy'
    }
    
    # Default configuration
    DEFAULT_CONFIG = {
        "execute_query_max_chars": 4000,
        "session_timeout_hours": 24,
        "log_level": "INFO",
        "max_connections": 10
    }
    
    # Supported database types
    SUPPORTED_DATABASES = {
        'sqlite': 'SQLite',
        'postgresql': 'PostgreSQL',
        'mysql': 'MySQL',
        'oracle': 'Oracle',
        'mssql': 'Microsoft SQL Server'
    }
    
    # Environment variables (paths are derived, not set)
    ENV_VARS = {
        "EXECUTE_QUERY_MAX_CHARS": "4000"
    }
    
    # MCP Tool capabilities
    TOOL_CAPABILITIES = [
        "get_namespace_guide",
        "start_namespace_negotiation",
        "confirm_namespace",
        "list_session_databases",
        "register_database",
        "all_table_names",
        "filter_table_names",
        "schema_definitions",
        "get_database_info",
        "batch_insert",
        "batch_update",
        "batch_delete",
        "batch_upsert",
        "batch_select",
        "analyze_table_performance",
        "create_optimized_index",
        "get_database_stats"
    ]
    
    # Auto-approve tools
    AUTO_APPROVE_TOOLS = [
        "get_namespace_guide",
        "start_namespace_negotiation",
        "confirm_namespace",
        "list_session_databases",
        "register_database",
        "all_table_names",
        "filter_table_names",
        "schema_definitions",
        "get_database_info",
        "batch_insert",
        "batch_update",
        "batch_delete",
        "batch_upsert",
        "batch_select",
        "analyze_table_performance",
        "create_optimized_index",
        "get_database_stats"
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
