#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
System Paths Module

Defines system-wide cache and data directories for core_node applications.
These paths are used for storing persistent data, cache, and configuration files.

Platform-specific paths:
    Windows: C:\Users\{username}\.core_node
    Linux:   /var/_core_node

Directory Structure:
    .core_node/
        ├── cache/              # Application cache files
        ├── config/             # Configuration files
        ├── data/               # Persistent data
        ├── logs/               # Log files
        └── ui_state/           # UI state cache (window positions, etc.)
"""

import os
import sys
import platform
from pathlib import Path
from typing import Optional


def get_system_cache_dir() -> Path:
    r"""
    Get platform-specific system cache directory

    Returns:
        Path: System cache directory path
            - Windows: C:\Users\{username}\.core_node
            - Linux: /var/_core_node

    The directory is automatically created if it does not exist.
    """
    if sys.platform == 'win32':
        # Windows: Use user home directory
        user_home = Path.home()
        cache_dir = user_home / '.core_node'
    else:
        # Linux/Unix: Use /var/_core_node
        cache_dir = Path('/var/_core_node')

        # Fallback to user home if /var is not writable
        if not os.access('/var', os.W_OK):
            user_home = Path.home()
            cache_dir = user_home / '.core_node'

    # Create directory if not exists
    if not cache_dir.exists():
        cache_dir.mkdir(parents=True, exist_ok=True)

    return cache_dir


def get_ui_state_cache_dir() -> Path:
    r"""
    Get UI state cache directory

    Used for storing window positions, sizes, and other UI state.

    Returns:
        Path: UI state cache directory (.core_node/ui_state/)
    """
    ui_state_dir = get_system_cache_dir() / 'ui_state'

    if not ui_state_dir.exists():
        ui_state_dir.mkdir(parents=True, exist_ok=True)

    return ui_state_dir


def get_app_cache_dir() -> Path:
    r"""
    Get application cache directory

    Returns:
        Path: Application cache directory (.core_node/cache/)
    """
    cache_dir = get_system_cache_dir() / 'cache'

    if not cache_dir.exists():
        cache_dir.mkdir(parents=True, exist_ok=True)

    return cache_dir


def get_app_config_dir() -> Path:
    r"""
    Get application configuration directory

    Returns:
        Path: Application config directory (.core_node/config/)
    """
    config_dir = get_system_cache_dir() / 'config'

    if not config_dir.exists():
        config_dir.mkdir(parents=True, exist_ok=True)

    return config_dir


def get_app_data_dir() -> Path:
    r"""
    Get application persistent data directory

    Returns:
        Path: Application data directory (.core_node/data/)
    """
    data_dir = get_system_cache_dir() / 'data'

    if not data_dir.exists():
        data_dir.mkdir(parents=True, exist_ok=True)

    return data_dir


def get_app_logs_dir() -> Path:
    r"""
    Get application logs directory

    Returns:
        Path: Application logs directory (.core_node/logs/)
    """
    logs_dir = get_system_cache_dir() / 'logs'

    if not logs_dir.exists():
        logs_dir.mkdir(parents=True, exist_ok=True)

    return logs_dir


# Constants - Auto-initialized paths
SYSTEM_CACHE_DIR = get_system_cache_dir()
UI_STATE_CACHE_DIR = get_ui_state_cache_dir()
APP_CACHE_DIR = get_app_cache_dir()
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()


def map_web_path(path_key: str, sub_path: Optional[str] = None) -> Path:
    """
    Map web path based on environment (similar to gvar_common.sh map_web_path)
    
    Windows mappings:
    - applications -> d:\\applications
    - programing -> d:\\programing
    - www -> d:\\www
    - wwwroot -> d:\\www\\wwwroot
    - compile_dir -> d:\\.dev_win11 or d:\\.dev_win10
    
    Linux mappings:
    - Uses /mnt/d or /www based on environment
    
    Args:
        path_key: Path key (e.g., 'wwwroot', 'applications', 'programing')
        sub_path: Optional sub-path to append
    
    Returns:
        Path: Mapped path
    """
    is_windows = platform.system() == 'Windows'
    
    if is_windows:
        # Windows mappings
        base_d = Path('D:/')
        mappings = {
            'applications': base_d / 'applications',
            'programing': base_d / 'programing',
            'www': base_d / 'www',
            'wwwroot': base_d / 'www' / 'wwwroot',
            'compile_dir': base_d / f'.dev_{platform.release().lower()}',
        }
        
        # Detect Windows version for compile_dir
        if 'compile_dir' in path_key:
            win_version = platform.release()
            if '10' in win_version:
                mappings['compile_dir'] = base_d / '.dev_win10'
            elif '11' in win_version:
                mappings['compile_dir'] = base_d / '.dev_win11'
            else:
                mappings['compile_dir'] = base_d / f'.dev_win{win_version}'
    else:
        # Linux mappings (similar to gvar_common.sh)
        # Check for WSL
        is_wsl = os.path.exists('/mnt/c/Windows')
        
        if is_wsl:
            base_path = Path('/mnt/d')
        else:
            # Production server
            base_path = Path('/www')
        
        mappings = {
            'applications': base_path / 'applications',
            'programing': base_path / 'programing',
            'www': base_path / 'www',
            'wwwroot': base_path / 'www' / 'wwwroot',
            'compile_dir': base_path / '.dev',
        }
    
    # Get mapped path
    mapped_path = mappings.get(path_key, Path(path_key))
    
    # Append sub_path if provided
    if sub_path:
        sub_path = sub_path.lstrip('/').lstrip('\\')
        mapped_path = mapped_path / sub_path
    
    # Create directory if it doesn't exist (only for web-related paths)
    if path_key in ['wwwroot', 'www', 'applications']:
        mapped_path.mkdir(parents=True, exist_ok=True)
    
    return mapped_path


__all__ = [
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'map_web_path',
    'SYSTEM_CACHE_DIR',
    'UI_STATE_CACHE_DIR',
    'APP_CACHE_DIR',
    'APP_CONFIG_DIR',
    'APP_DATA_DIR',
    'APP_LOGS_DIR',
]
