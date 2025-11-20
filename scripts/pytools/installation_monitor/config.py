"""
Configuration file for Installation Monitor
Contains paths and settings for monitoring software installations
"""

import os
import platform
from pathlib import Path


def get_windows_version():
    """
    Get Windows version to determine dev directory

    Returns:
        str: 'win10' or 'win11'
    """
    try:
        version = platform.version()
        build = int(version.split('.')[-1]) if '.' in version else 0
        # Windows 11 build number is 22000 or higher
        return 'win11' if build >= 22000 else 'win10'
    except:
        # Default to win10 if detection fails
        return 'win10'


def ensure_cache_directories():
    """
    Ensure all cache directories exist
    """
    USER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MONITOR_RESULTS_BASE.mkdir(parents=True, exist_ok=True)
    EXPORT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

# User cache directory for storing monitoring results and settings
USER_HOME = Path.home()
USER_CACHE_DIR = USER_HOME / ".core_node" / ".installation_monitor"
MONITOR_RESULTS_BASE = USER_CACHE_DIR / "monitoring_results"
EXPORT_BASE_DIR = USER_CACHE_DIR / "exported_software"
CACHE_DIR = USER_CACHE_DIR / "cache"

# Legacy support - keep old paths for backward compatibility
LEGACY_MONITOR_RESULTS_BASE = Path(__file__).parent / "monitoring_results"
LEGACY_EXPORT_BASE_DIR = Path("D:/.tmp/Softwares")

# Detailed directory definitions with scan depth parameters
WINDOWS_VERSION = get_windows_version()

# Core system directories
PROGRAM_FILES = "C:/Program Files"
PROGRAM_FILES_X86 = "C:/Program Files (x86)"
PROGRAMDATA = os.getenv('PROGRAMDATA', 'C:/ProgramData')
C_ROOT = "C:/"
WINDOWS_DIR = "C:/Windows"

# User directories
USER_ALL_USERS = "C:/Users/All Users"  # Usually symlink to ProgramData
USER_PUBLIC = Path("C:/Users/Public")
USER_DEFAULT = Path("C:/Users/Default")
USER_APPDATA_ROAMING = os.getenv('APPDATA', str(USER_HOME / "AppData" / "Roaming"))
USER_APPDATA_LOCAL = os.getenv('LOCALAPPDATA', str(USER_HOME / "AppData" / "Local"))
USER_APPDATA_LOCALLOW = str(USER_HOME / "AppData" / "LocalLow")

# Start Menu and Desktop directories
USER_START_MENU = USER_HOME / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu" / "Programs"
PUBLIC_START_MENU = Path("C:/ProgramData/Microsoft/Windows/Start Menu/Programs")
USER_DESKTOP = USER_HOME / "Desktop"
PUBLIC_DESKTOP = Path("C:/Users/Public/Desktop")

# Development directory (based on Windows version)
DEV_DIRECTORY = Path(f"D:/.dev_{WINDOWS_VERSION}")

# Directory configuration with scan depth and options
DIRECTORY_CONFIG = {
    # Core system directories
    'program_files': {
        'path': PROGRAM_FILES,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\Program Files'
    },
    'program_files_x86': {
        'path': PROGRAM_FILES_X86,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\Program Files (x86)'
    },
    'programdata': {
        'path': PROGRAMDATA,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\ProgramData'
    },
    'c_root': {
        'path': C_ROOT,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\ (Root Directory)'
    },
    'windows_dir': {
        'path': WINDOWS_DIR,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\Windows'
    },
    
    # User directories
    'user_all_users': {
        'path': USER_ALL_USERS,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\Users\\All Users'
    },
    'user_public': {
        'path': str(USER_PUBLIC),
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'C:\\Users\\Public'
    },
    'user_home': {
        'path': str(USER_HOME),
        'scan_depth': 1,
        'ignore_history': True,
        'description': f'C:\\Users\\{USER_HOME.name}'
    },
    'user_appdata_local': {
        'path': USER_APPDATA_LOCAL,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'AppData\\Local'
    },
    'user_appdata_locallow': {
        'path': USER_APPDATA_LOCALLOW,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'AppData\\LocalLow'
    },
    'user_appdata_roaming': {
        'path': USER_APPDATA_ROAMING,
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'AppData\\Roaming'
    },
    
    # Start Menu and Desktop
    'user_start_menu': {
        'path': str(USER_START_MENU),
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'User Start Menu'
    },
    'public_start_menu': {
        'path': str(PUBLIC_START_MENU),
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'Public Start Menu'
    },
    'user_desktop': {
        'path': str(USER_DESKTOP),
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'User Desktop'
    },
    'public_desktop': {
        'path': str(PUBLIC_DESKTOP),
        'scan_depth': 1,
        'ignore_history': True,
        'description': 'Public Desktop'
    },
    
    # Development directory
    'dev_directory': {
        'path': str(DEV_DIRECTORY),
        'scan_depth': 1,
        'ignore_history': True,
        'description': f'D:\\.dev_{WINDOWS_VERSION}'
    }
}

# Legacy support - keep old variables for backward compatibility
APPDATA = USER_APPDATA_ROAMING
LOCAL_APPDATA = USER_APPDATA_LOCAL

# Registry keys to monitor
REGISTRY_KEYS = [
    r"HKEY_LOCAL_MACHINE\SOFTWARE",
    r"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node",
    r"HKEY_CURRENT_USER\SOFTWARE",
    r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services",
    r"HKEY_CLASSES_ROOT",
    r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    r"HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    r"HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
]

# File patterns to skip (temporary files, downloads, etc.)
SKIP_PATTERNS = [
    "temp",
    "tmp",
    "cache",
    ".tmp",
    "~",
    "downloads",  # Skip Downloads directories
    "\\downloads\\",  # Skip Downloads path segment
    "\\temp\\",  # Skip temp directories
    "\\tmp\\",  # Skip tmp directories
]

# Directory patterns to skip (for first-level directories only)
SKIP_FIRST_LEVEL_PATTERNS = [
    "temp",
    "tmp",
    "cache",
    ".tmp",
    "downloads",
]

# Dot-prefixed directories to skip (first level only)
SKIP_DOT_PREFIXED = True  # Skip directories starting with '.' at first level only

# Polling interval in seconds
POLL_INTERVAL = 2

# Real-time monitoring settings
REALTIME_MONITOR_INTERVAL = 1  # Check for changes every 1 second
ENABLE_REALTIME_STATUS = True  # Show real-time status updates
REALTIME_STATUS_UPDATE_INTERVAL = 1  # Update status every 1 second if no changes

# Maximum file size to record (in bytes, 100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Performance optimization settings
ENABLE_SMART_SCAN = True  # Use smart directory tracking for large directories
SMART_SCAN_THRESHOLD_AGE = 3600  # Skip directories unchanged for 1 hour (in seconds)

# Monitoring behavior
MONITOR_SUBDIRECTORIES_DEPTH = -1  # -1 = unlimited, or specify max depth
QUICK_SCAN_TIMEOUT = 30  # Timeout for quick scans in seconds

# GUI settings
GUI_UPDATE_INTERVAL = 500  # milliseconds
SHOW_DETAILED_PROGRESS = True  # Show detailed progress during scans

# Default software name
DEFAULT_SOFTWARE_NAME = "SoftwarePackage"  # Used when user doesn't specify a name

# Permission error caching
PERMISSION_ERROR_CACHE_FILE = Path(__file__).parent / ".permission_errors_cache.json"
ENABLE_PERMISSION_CACHE = True  # Cache directories with permission errors to skip on next scan
