# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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

# Flutter project paths
ORIGINAL_FLUTTER_ROOT = str(Path(__file__).parent.parent.parent.parent.parent)
FLUTTER_LIB_DIR = os.path.join(ORIGINAL_FLUTTER_ROOT, 'lib')
FLUTTER_APPS_DIR = os.path.join(FLUTTER_LIB_DIR, 'apps')

# Platform directories
PLATFORM_DIRS = ["android", "web", "windows", "macos", "ios"]

# Image file extensions
IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp']

# Default resource files
DEFAULT_RESOURCE_FILES = {
    'icon_file': 'icon.png',
    'small_icon_file': 'notification_icon.png',
    'splash_screen_file': 'splash.png',
    'background_image_file': 'background.png'
}

# Resource types mapping
RESOURCE_TYPES = {
    'icon': 'icon.png',
    'small_icon': 'notification_icon.png',
    'splash': 'splash.png',
    'background': 'background.png'
}

# Icon name mappings
ICON_MAPPINGS = {
    "ic_launcher": "icon",
    "launcher_icon": "icon",
    "app_icon": "icon",
    "ic_notification": "notification_icon",
    "notification": "notification_icon"
}

# Build configuration keys
APP_NAME_KEY = 'AppName'
BUILD_CONFIG_SECTIONS = {
    'app_info': ['app_name', 'display_name_chinese', 'display_name_english', 'description'],
    'package_settings': ['random_package_id', 'default_package_id', 'random_display_name'],
    'build_settings': ['build_platforms', 'use_external_resources', 'optimize_images', 'use_external_safe_build'],
    'resources': ['icon_file', 'small_icon_file', 'splash_screen_file', 'background_image_file']
}

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
