#!/usr/bin/env python3
"""
MCP Server Configuration Module

Centralized configuration management for mcpserver application
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class ServerConfig:
    """MCP Server configuration settings"""

    # Singleton detection settings
    singleton_host: str = 'localhost'
    singleton_port: int = 19997

    # RPC server settings
    rpc_host: str = 'localhost'
    rpc_port: int = 8767

    # Debug mode
    debug: bool = True

    # Service settings
    enable_codebase_scanner: bool = True
    enable_file_processor: bool = True
    enable_image_generator: bool = True
    enable_database: bool = True
    enable_ai_collaboration: bool = True
    enable_document_offline: bool = True
    enable_webview: bool = True
    enable_icon_info: bool = True


# Global config instance
config = ServerConfig()


def get_config() -> ServerConfig:
    """
    Get the global server configuration

    Returns:
        ServerConfig instance
    """
    return config


def update_config(**kwargs) -> ServerConfig:
    """
    Update server configuration

    Args:
        **kwargs: Configuration parameters to update

    Returns:
        Updated ServerConfig instance
    """
    for key, value in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, value)
    return config


# Import tray configuration
from .tray_config import (
    TrayCallbacks,
    TrayConfig,
    create_tray_menu
)

# Export config and utilities
__all__ = [
    'ServerConfig',
    'config',
    'get_config',
    'update_config',
    'TrayCallbacks',
    'TrayConfig',
    'create_tray_menu'
]
