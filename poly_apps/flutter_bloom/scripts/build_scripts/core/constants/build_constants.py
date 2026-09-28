"""
Build Constants for Flutter Bloom Build System
Centralized constants and configuration values
"""

import os
from pathlib import Path

# Core directories
PROGRAMING_DIR = r'D:/programing/.build_dir'
EXTERNAL_RESOURCES_DIR = os.path.join(PROGRAMING_DIR, 'build_apps_static_resources')
COMPILE_FACTORY_DIR = os.path.join(PROGRAMING_DIR, 'compile_factory')


# Default package information
DEFAULT_PACKAGE_ID = "com.ddsj.qyapp"
DEFAULT_APP_DISPLAY_NAME_CN = "我的应用"
DEFAULT_APP_DISPLAY_NAME_EN = "AppQy"

# Placeholder constants for global replacement
PLACEHOLDER_PACKAGE_ID = "com.ddsj.qyapp"
PLACEHOLDER_APP_NAME_CN = "应用程序"
PLACEHOLDER_APP_NAME_EN = "App-QY"


# Ensure required directories exist
def ensure_build_directories():
    """Ensure all required build directories exist"""
    directories = [
        PROGRAMING_DIR,
        EXTERNAL_RESOURCES_DIR,
        COMPILE_FACTORY_DIR
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

# Initialize directories on import
ensure_build_directories()
