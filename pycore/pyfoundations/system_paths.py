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
import re
import sys
import platform
import subprocess
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pathlib import Path
from typing import Optional, Tuple, List


def _is_wsl() -> bool:
    """
    Check if running in WSL (Windows Subsystem for Linux)

    Returns:
        bool: True if running in WSL
    """
    # Check for WSL-specific indicators
    if os.path.exists('/mnt/c/Windows'):
        return True

    # Check /proc/version for Microsoft/WSL
    if os.path.exists('/proc/version'):
        with open('/proc/version', 'r') as f:
            version_info = f.read().lower()
            if 'microsoft' in version_info or 'wsl' in version_info:
                return True

    return False


def _is_desktop_linux() -> bool:
    """
    Check if running on desktop Linux (has display server)

    Returns:
        bool: True if running on desktop Linux
    """
    # Check for display environment variables
    if os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'):
        return True

    # Check for desktop session
    if os.environ.get('DESKTOP_SESSION') or os.environ.get('XDG_SESSION_TYPE'):
        return True

    return False


def _get_linux_distro_info() -> Tuple[str, str]:
    """
    Get Linux distribution name and version

    Returns:
        Tuple[str, str]: (distro_name, version)
            e.g., ('ubuntu', '24.04') or ('debian', '12')
    """
    distro_name = 'linux'
    version = ''

    # Try to read /etc/os-release
    if os.path.exists('/etc/os-release'):
        with open('/etc/os-release', 'r') as f:
            content = f.read()

            # Extract ID (distro name)
            id_match = re.search(r'^ID=([^\n]+)$', content, re.MULTILINE)
            if id_match:
                distro_name = id_match.group(1).strip().strip('"').lower()

            # Extract VERSION_ID (version number)
            version_match = re.search(r'^VERSION_ID=([^\n]+)$', content, re.MULTILINE)
            if version_match:
                version = version_match.group(1).strip().strip('"')

    # Remove decimal points for version (24.04 -> 24)
    if version and '.' in version:
        version = version.split('.')[0]

    return distro_name, version


def _get_mounted_drives() -> List[Path]:
    """
    Get list of mounted drives in /mnt/ sorted by size (largest first)

    Returns:
        List[Path]: List of mounted drives sorted by available space
    """
    mounted_drives = []
    mnt_path = Path('/mnt')

    if not mnt_path.exists():
        return mounted_drives

    # Get all directories in /mnt/
    for item in mnt_path.iterdir():
        if item.is_dir() and item.name not in ['.', '..']:
            # Check if it's actually mounted and accessible
            try:
                # Try to access the directory
                if os.access(str(item), os.R_OK):
                    # Get disk usage
                    stat = os.statvfs(str(item))
                    available_space = stat.f_bavail * stat.f_frsize
                    mounted_drives.append((item, available_space))
            except (OSError, PermissionError):
                # Skip inaccessible mounts
                pass

    # Sort by available space (largest first)
    mounted_drives.sort(key=lambda x: x[1], reverse=True)

    # Return just the paths
    return [drive[0] for drive in mounted_drives]


def _get_largest_mounted_drive() -> Optional[Path]:
    """
    Get the largest mounted drive in /mnt/

    Returns:
        Optional[Path]: Largest mounted drive or None if no drives found
    """
    mounted_drives = _get_mounted_drives()
    return mounted_drives[0] if mounted_drives else None


def _get_actual_user() -> str:
    """
    Get actual logged-in user (for Linux desktop/WSL when running as root)

    This function is useful when running as root to find the actual user.
    It searches /home/ directory for user directories.

    Returns:
        str: Actual user name, or current user if detection fails
    """
    # First try standard methods
    # Check SUDO_USER (when using sudo)
    sudo_user = os.environ.get('SUDO_USER')
    if sudo_user and sudo_user != 'root':
        return sudo_user

    # Check LOGNAME
    logname = os.environ.get('LOGNAME')
    if logname and logname != 'root':
        return logname

    # Check USER
    user = os.environ.get('USER')
    if user and user != 'root':
        return user

    # If running as root, search /home/ for actual user
    home_path = Path('/home')
    if home_path.exists():
        # Get all user directories in /home/
        user_dirs = []
        for item in home_path.iterdir():
            if item.is_dir() and item.name not in ['.', '..', 'lost+found']:
                # Check if it's a valid user home directory
                # Valid home directories usually have .bashrc or .profile
                if (item / '.bashrc').exists() or (item / '.profile').exists() or (item / '.bash_profile').exists():
                    # Get last modified time to find most recently used
                    try:
                        mtime = item.stat().st_mtime
                        user_dirs.append((item.name, mtime))
                    except (OSError, PermissionError):
                        pass

        if user_dirs:
            # Sort by modification time (most recent first)
            user_dirs.sort(key=lambda x: x[1], reverse=True)
            return user_dirs[0][0]

    # Fallback to current user from pwd module
    import pwd
    try:
        return pwd.getpwuid(os.getuid()).pw_name
    except:
        # Final fallback
        return os.environ.get('USER', 'user')


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


def get_core_node_root() -> Path:
    """
    Get core_node root directory by locating from this file's position

    This file is at: pycore/pyfoundations/system_paths.py
    core_node root is 3 levels up

    Returns:
        Path: core_node root directory
    """
    return Path(__file__).resolve().parent.parent.parent


# Constants - Auto-initialized paths
SYSTEM_CACHE_DIR = get_system_cache_dir()
UI_STATE_CACHE_DIR = get_ui_state_cache_dir()
APP_CACHE_DIR = get_app_cache_dir()
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()
CORE_NODE_ROOT = get_core_node_root()


def map_web_path(path_key: str, sub_path: Optional[str] = None) -> Path:
    """
    Map web path based on environment

    SYNC WARNING: This function MUST be kept in sync with:
    - Shell version: scripts/shells/linux/common/gvar_common.sh::map_web_path()
    - All mappings must produce identical results across Python and Shell

    Windows mappings:
    - applications -> d:\\applications
    - programing -> d:\\programing
    - www -> d:\\www
    - wwwroot -> d:\\www\\wwwroot
    - pycore_db -> d:\\www\\wwwroot\\pycore_db
    - laravel_db -> d:\\www\\wwwroot\\laravel_db
    - compile_dir -> d:\\_win11 or d:\\_win10
    - old_compile_dir -> d:\\dev_win11 or d:\\dev_win10

    Linux mappings (context-aware):
    - WSL: Uses /mnt/d (or largest mounted drive)
    - Desktop: Uses largest /mnt/* drive if available, else /www
    - Server: Uses /www
    - pycore_db -> /www/wwwroot/pycore_db
    - laravel_db -> /www/wwwroot/laravel_db
    - compile_dir -> /mnt/d/_ubuntu24 (or _{distro}{version})
    - old_compile_dir -> /mnt/d/dev_ubuntu24 (or dev_{distro}{version})

    Args:
        path_key: Path key (e.g., 'wwwroot', 'pycore_db', 'laravel_db')
        sub_path: Optional sub-path to append

    Returns:
        Path: Mapped path
    """
    is_windows = platform.system() == 'Windows'

    if is_windows:
        # Windows mappings
        base_d = Path('D:/')

        # Detect Windows version
        win_version = platform.release()
        if '10' in win_version:
            win_suffix = 'win10'
        elif '11' in win_version:
            win_suffix = 'win11'
        else:
            win_suffix = f'win{win_version}'

        mappings = {
            'applications': base_d / 'applications',
            'programing': base_d / 'programing',
            'core_node': get_core_node_root(),
            'www': base_d / 'www',
            'wwwroot': base_d / 'www' / 'wwwroot',
            'pycore_db': base_d / 'www' / 'wwwroot' / 'pycore_db',
            'laravel_db': base_d / 'www' / 'wwwroot' / 'laravel_db',
            'compile_dir': base_d / f'_{win_suffix}',
            'old_compile_dir': base_d / f'dev_{win_suffix}',
        }
    else:
        # Linux mappings (context-aware)
        is_wsl = _is_wsl()
        is_desktop = _is_desktop_linux()

        # Determine base path
        if is_wsl:
            # WSL: Try /mnt/d first, fallback to largest mounted drive
            base_path = Path('/mnt/d')
            if not base_path.exists() or not os.access(str(base_path), os.R_OK):
                largest_drive = _get_largest_mounted_drive()
                base_path = largest_drive if largest_drive else Path('/www')
        elif is_desktop:
            # Desktop: Check for mounted drives in /mnt/
            largest_drive = _get_largest_mounted_drive()
            if largest_drive:
                base_path = largest_drive
            else:
                # No mounted drives, use /www
                base_path = Path('/www')
        else:
            # Server: Use root path
            base_path = Path('/')

        # Get distro info for compile_dir naming
        distro_name, distro_version = _get_linux_distro_info()
        distro_suffix = f'{distro_name}{distro_version}' if distro_version else distro_name

        # Check if base_path already points to /www (to avoid /www/www duplication)
        if base_path == Path('/www'):
            # base_path is already /www, use it directly
            www_base = base_path
        else:
            # base_path is /mnt/d or /, need to add www subdirectory
            www_base = base_path / 'www'

        mappings = {
            'applications': www_base / 'applications',
            'programing': www_base / 'programing',
            'core_node': get_core_node_root(),
            'www': www_base,
            'wwwroot': www_base / 'wwwroot',
            'pycore_db': www_base / 'wwwroot' / 'pycore_db',
            'laravel_db': www_base / 'wwwroot' / 'laravel_db',
            'compile_dir': base_path / 'mnt' / 'd' / f'_{distro_suffix}' if base_path == Path('/') else base_path / f'_{distro_suffix}',
            'old_compile_dir': base_path / 'mnt' / 'd' / f'dev_{distro_suffix}' if base_path == Path('/') else base_path / f'dev_{distro_suffix}',
        }

    # Get mapped path
    mapped_path = mappings.get(path_key, Path(path_key))

    # Append sub_path if provided
    if sub_path:
        sub_path = sub_path.lstrip('/').lstrip('\\')
        mapped_path = mapped_path / sub_path

    # Create directory if it doesn't exist (only for web-related paths)
    if path_key in ['wwwroot', 'www', 'applications', 'pycore_db', 'laravel_db']:
        mapped_path.mkdir(parents=True, exist_ok=True)

    return mapped_path


__all__ = [
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'get_core_node_root',
    'map_web_path',
    'SYSTEM_CACHE_DIR',
    'UI_STATE_CACHE_DIR',
    'APP_CACHE_DIR',
    'APP_CONFIG_DIR',
    'APP_DATA_DIR',
    'APP_LOGS_DIR',
    'CORE_NODE_ROOT',
]
