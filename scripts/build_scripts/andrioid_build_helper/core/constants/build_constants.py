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
