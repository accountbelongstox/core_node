#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build System Key Center
Centralized definition of all variable keys
Shared across Python, Windows PowerShell, and Linux Bash
"""

import os
import json
from pathlib import Path

# ============================================
# VERSION CONFIGURATION
# ============================================

def load_version_config():
    """
    Load version configuration from build_versions_config.json

    Returns:
        dict: Version configuration
    """
    config_path = Path(__file__).parent / "build_versions_config.json"

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        # Print configuration info
        print(f"\n{'='*60}")
        print("Build Version Configuration - Capacitor 8")
        print(f"{'='*60}")
        print(f"Config file: {config_path}")
        print(f"Last verified: {config.get('_last_verified', 'Unknown')}")
        print(f"Official docs: {config.get('_official_sources', ['N/A'])[0] if config.get('_official_sources') else 'N/A'}")
        print(f"\nCapacitor: v{config['capacitor']['required_major_version']}.x")
        print(f"AGP: {config['android_build_tools']['agp_version']}")
        print(f"Gradle: {config['android_build_tools']['gradle_version']}")
        print(f"compileSdk: {config['android_sdk']['compile_sdk']}")
        print(f"targetSdk: {config['android_sdk']['target_sdk']}")
        print(f"minSdk: {config['android_sdk']['min_sdk']}")
        print(f"Kotlin: {config['android_sdk']['kotlin_version']}")
        print(f"\n💡 Java: Requires {config['java_requirements']['minimum_version']}+ (recommended {config['java_requirements']['recommended_version']})")
        print(f"   AGP 8.13 enforces Java 17 minimum")
        print(f"{'='*60}\n")

        # Flush output to ensure immediate display
        import sys
        sys.stdout.flush()

        return config
    except Exception as e:
        print(f"\n[WARNING] Could not load version config: {e}")
        print(f"[WARNING] Using fallback defaults")
        # Fallback defaults based on Capacitor 8 requirements
        return {
            'capacitor': {'required_major_version': 8},
            'android_build_tools': {
                'agp_version': '8.13.0',
                'gradle_version': '8.14.3',
                'google_services_version': '4.4.4'
            },
            'android_sdk': {
                'compile_sdk': '36',
                'target_sdk': '36',
                'min_sdk': '24',
                'kotlin_version': '2.2.20'
            },
            'java_requirements': {
                'minimum_version': '17',
                'recommended_version': '21'
            }
        }

# Load configuration at module import
VERSION_CONFIG = load_version_config()

# Export commonly used values
REQUIRED_CORE_MAJOR_VERSION = VERSION_CONFIG['capacitor']['required_major_version']

def get_version_config():
    """
    Get the current version configuration

    Returns:
        dict: Version configuration
    """
    return VERSION_CONFIG

def get_java_requirements():
    """
    Get Java and build tool requirements from configuration

    Returns:
        dict: Complete build requirements including AGP, Gradle, SDK versions
    """
    return {
        'agp_version': VERSION_CONFIG['android_build_tools']['agp_version'],
        'gradle_version': VERSION_CONFIG['android_build_tools']['gradle_version'],
        'google_services_version': VERSION_CONFIG['android_build_tools'].get('google_services_version', '4.4.4'),
        'compile_sdk': VERSION_CONFIG['android_sdk']['compile_sdk'],
        'target_sdk': VERSION_CONFIG['android_sdk']['target_sdk'],
        'min_sdk': VERSION_CONFIG['android_sdk']['min_sdk'],
        'kotlin_version': VERSION_CONFIG['android_sdk']['kotlin_version'],
        'java_minimum': VERSION_CONFIG['java_requirements']['minimum_version'],
        'java_recommended': VERSION_CONFIG['java_requirements']['recommended_version']
    }

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
# CAPACITOR UPGRADE KEYS
# ============================================

# Upgrade detection
KEY_UPGRADE_NEEDED = "UPGRADE_NEEDED"
KEY_UPGRADE_TARGET = "UPGRADE_TARGET"  # "capacitor_7"
KEY_CURRENT_CAPACITOR_VERSION = "CURRENT_CAPACITOR_VERSION"
KEY_TARGET_CAPACITOR_VERSION = "TARGET_CAPACITOR_VERSION"

# Upgrade actions
KEY_UPGRADE_PACKAGES_TO_REMOVE = "UPGRADE_PACKAGES_TO_REMOVE"
KEY_UPGRADE_PACKAGES_TO_INSTALL = "UPGRADE_PACKAGES_TO_INSTALL"

# File replacements (Python generates content, shell executes)
KEY_FILE_REPLACEMENT_COUNT = "FILE_REPLACEMENT_COUNT"
KEY_FILE_REPLACEMENT_PREFIX = "FILE_REPLACEMENT_"  # Followed by index
# For each replacement:
FIELD_FILE_PATH = "PATH"
FIELD_FILE_CONTENT = "CONTENT"
FIELD_FILE_BACKUP = "BACKUP"

# Java environment requirements
KEY_REQUIRED_JAVA_VERSION = "REQUIRED_JAVA_VERSION"
KEY_REQUIRED_JAVA_DOWNLOAD_URL = "REQUIRED_JAVA_DOWNLOAD_URL"
KEY_REQUIRED_AGP_VERSION = "REQUIRED_AGP_VERSION"
KEY_REQUIRED_GRADLE_VERSION = "REQUIRED_GRADLE_VERSION"
KEY_REQUIRED_ANDROID_STUDIO_VERSION = "REQUIRED_ANDROID_STUDIO_VERSION"
KEY_REQUIRED_COMPILE_SDK = "REQUIRED_COMPILE_SDK"
KEY_REQUIRED_TARGET_SDK = "REQUIRED_TARGET_SDK"

# Java/AGP compatibility
KEY_SYSTEM_JAVA_VERSION = "SYSTEM_JAVA_VERSION"
KEY_PROJECT_JAVA_VERSION = "PROJECT_JAVA_VERSION"
KEY_PROJECT_AGP_VERSION = "PROJECT_AGP_VERSION"

# Action Sheet compatibility (legacy - for old Capacitor 6 compatibility checks)
KEY_ACTION_SHEET_FIX_NEEDED = "ACTION_SHEET_FIX_NEEDED"
KEY_ACTION_SHEET_FIX_METHOD = "ACTION_SHEET_FIX_METHOD"
KEY_ACTION_SHEET_CURRENT_VERSION = "ACTION_SHEET_CURRENT_VERSION"
KEY_ACTION_SHEET_TARGET_VERSION = "ACTION_SHEET_TARGET_VERSION"
KEY_ACTION_SHEET_BUILD_GRADLE_PATH = "ACTION_SHEET_BUILD_GRADLE_PATH"

# Fix method values
FIX_METHOD_NONE = "none"
FIX_METHOD_DOWNGRADE = "downgrade"
FIX_METHOD_PATCH_GRADLE = "patch_gradle"

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
