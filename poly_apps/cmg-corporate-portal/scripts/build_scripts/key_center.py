#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build System Key Center
Centralized definition of all variable keys
Shared across Python, Windows PowerShell, and Linux Bash
"""

# ============================================
# PROJECT KEYS
# ============================================

# Project paths
KEY_PROJECT_ROOT = "PROJECT_ROOT"
KEY_ANDROID_PATH = "ANDROID_PATH"
KEY_ASSETS_PATH = "ASSETS_PATH"
KEY_PACKAGE_JSON_PATH = "PACKAGE_JSON_PATH"
KEY_PACKAGE_JSON_BACKUP_PATH = "PACKAGE_JSON_BACKUP_PATH"

# ============================================
# BUILD CONFIG KEYS
# ============================================

# App information
KEY_APP_NAME = "APP_NAME"
KEY_DISPLAY_NAME_EN = "DISPLAY_NAME_EN"
KEY_DISPLAY_NAME_CN = "DISPLAY_NAME_CN"
KEY_PACKAGE_ID = "PACKAGE_ID"
KEY_DESCRIPTION = "DESCRIPTION"

# Build settings
KEY_BUILD_PLATFORMS = "BUILD_PLATFORMS"
KEY_ICON_PATH = "ICON_PATH"
KEY_SPLASH_PATH = "SPLASH_PATH"

# ============================================
# ACTION KEYS
# ============================================

KEY_ACTION = "ACTION"

# Action values
ACTION_INSTALL_CAPACITOR = "install_capacitor"
ACTION_DEV_SERVER = "dev_server"
ACTION_BUILD_WEB = "build_web"
ACTION_BUILD_ANDROID = "build_android"

# ============================================
# COMMAND KEYS
# ============================================

# Command queue
KEY_COMMAND_COUNT = "COMMAND_COUNT"
KEY_COMMAND_PREFIX = "COMMAND_"  # Followed by index: COMMAND_0, COMMAND_1, etc.

# Command fields (for each command)
FIELD_CMD_TYPE = "TYPE"
FIELD_CMD_DESC = "DESC"
FIELD_CMD_WORKDIR = "WORKDIR"

# ============================================
# STATUS KEYS
# ============================================

KEY_PYTHON_SUCCESS = "PYTHON_SUCCESS"
KEY_ERROR = "ERROR"

# ============================================
# HELPER FUNCTIONS
# ============================================

def get_all_keys():
    """
    Get all defined keys

    Returns:
        List of all key names
    """
    keys = []
    for name, value in globals().items():
        if name.startswith('KEY_') and isinstance(value, str):
            keys.append(value)
    return sorted(keys)


def get_action_keys():
    """
    Get all action value keys

    Returns:
        List of action values
    """
    actions = []
    for name, value in globals().items():
        if name.startswith('ACTION_') and isinstance(value, str):
            actions.append(value)
    return sorted(actions)


def validate_key(key):
    """
    Validate if a key is defined

    Args:
        key: Key name to validate

    Returns:
        True if key is valid, False otherwise
    """
    all_keys = get_all_keys()
    return key in all_keys


def print_key_summary():
    """Print summary of all defined keys"""
    print("=" * 60)
    print("Build System Key Center")
    print("=" * 60)

    print("\nProject Keys:")
    for key in [KEY_PROJECT_ROOT, KEY_ANDROID_PATH, KEY_ASSETS_PATH,
                KEY_PACKAGE_JSON_PATH, KEY_PACKAGE_JSON_BACKUP_PATH]:
        print(f"  - {key}")

    print("\nBuild Config Keys:")
    for key in [KEY_APP_NAME, KEY_DISPLAY_NAME_EN, KEY_DISPLAY_NAME_CN,
                KEY_PACKAGE_ID, KEY_DESCRIPTION, KEY_BUILD_PLATFORMS,
                KEY_ICON_PATH, KEY_SPLASH_PATH]:
        print(f"  - {key}")

    print("\nAction Keys:")
    print(f"  - {KEY_ACTION}")
    print("    Values:")
    for action in get_action_keys():
        print(f"      * {action}")

    print("\nCommand Keys:")
    print(f"  - {KEY_COMMAND_COUNT}")
    print(f"  - {KEY_COMMAND_PREFIX}{{index}}")
    print("    Fields:")
    print(f"      * {FIELD_CMD_TYPE}")
    print(f"      * {FIELD_CMD_DESC}")
    print(f"      * {FIELD_CMD_WORKDIR}")

    print("\nStatus Keys:")
    for key in [KEY_PYTHON_SUCCESS, KEY_ERROR]:
        print(f"  - {key}")

    print(f"\nTotal Keys: {len(get_all_keys())}")
    print("=" * 60)


if __name__ == '__main__':
    print_key_summary()
