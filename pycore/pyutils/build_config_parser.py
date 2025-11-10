#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Configuration Parser

This module provides a parser for build_config.ini files located in app directories.
It defines standard configuration fields and provides validation and defaults.

Usage:
    from pycore.pyutils.build_config_parser import BuildConfigParser

    parser = BuildConfigParser("/path/to/app/build_config.ini")
    if parser.exists():
        config = parser.parse()
        print(config.get_display_name())
"""

import configparser
import os
from pathlib import Path
from typing import Optional, Dict, List, Any


class BuildConfig:
    """
    Represents parsed build configuration with typed access methods.
    """

    def __init__(self, config_data: Dict[str, Any]):
        """
        Initialize build configuration from parsed data.

        Args:
            config_data: Dictionary containing parsed configuration sections
        """
        self._data = config_data

    # App Info Section
    def get_display_name_chinese(self) -> Optional[str]:
        """Get Chinese display name"""
        return self._data.get('app_info', {}).get('display_name_chinese')

    def get_display_name_english(self) -> Optional[str]:
        """Get English display name"""
        return self._data.get('app_info', {}).get('display_name_english')

    def get_display_name(self, prefer_chinese: bool = False) -> Optional[str]:
        """
        Get display name with preference.

        Args:
            prefer_chinese: If True, prefer Chinese name over English

        Returns:
            Display name string or None
        """
        if prefer_chinese:
            return self.get_display_name_chinese() or self.get_display_name_english()
        return self.get_display_name_english() or self.get_display_name_chinese()

    def get_description(self) -> Optional[str]:
        """Get app description"""
        return self._data.get('app_info', {}).get('description')

    def get_version(self) -> Optional[str]:
        """Get app version"""
        return self._data.get('app_info', {}).get('version')

    def get_author(self) -> Optional[str]:
        """Get app author"""
        return self._data.get('app_info', {}).get('author')

    # Dependencies Section
    def requires_node(self) -> bool:
        """Check if Node.js is required"""
        return self._data.get('dependencies', {}).get('require_nodejs', 'true').lower() == 'true'

    def requires_python(self) -> bool:
        """Check if Python is required"""
        return self._data.get('dependencies', {}).get('require_python', 'true').lower() == 'true'

    def get_node_version(self) -> Optional[str]:
        """Get required Node.js version"""
        return self._data.get('dependencies', {}).get('nodejs_version')

    def get_python_version(self) -> Optional[str]:
        """Get required Python version"""
        return self._data.get('dependencies', {}).get('python_version')

    def get_npm_packages(self) -> List[str]:
        """Get list of required npm packages"""
        packages = self._data.get('dependencies', {}).get('npm_packages', '')
        if not packages:
            return []
        return [pkg.strip() for pkg in packages.split(',') if pkg.strip()]

    def get_pip_packages(self) -> List[str]:
        """Get list of required pip packages"""
        packages = self._data.get('dependencies', {}).get('pip_packages', '')
        if not packages:
            return []
        return [pkg.strip() for pkg in packages.split(',') if pkg.strip()]

    # Installation Section
    def get_pre_install_commands(self) -> List[str]:
        """Get pre-installation commands"""
        commands = self._data.get('installation', {}).get('pre_install_commands', '')
        if not commands:
            return []
        return [cmd.strip() for cmd in commands.split(';') if cmd.strip()]

    def get_post_install_commands(self) -> List[str]:
        """Get post-installation commands"""
        commands = self._data.get('installation', {}).get('post_install_commands', '')
        if not commands:
            return []
        return [cmd.strip() for cmd in commands.split(';') if cmd.strip()]

    def skip_pnpm_install(self) -> bool:
        """Check if pnpm install should be skipped"""
        return self._data.get('installation', {}).get('skip_pnpm_install', 'false').lower() == 'true'

    def skip_pycore_init(self) -> bool:
        """Check if pycore initialization should be skipped"""
        return self._data.get('installation', {}).get('skip_pycore_init', 'false').lower() == 'true'

    def create_desktop_shortcut(self) -> bool:
        """Check if desktop shortcut should be created"""
        return self._data.get('installation', {}).get('create_desktop_shortcut', 'true').lower() == 'true'

    # Startup Section
    def get_startup_command(self) -> Optional[str]:
        """Get custom startup command (overrides default)"""
        return self._data.get('startup', {}).get('command')

    def get_working_directory(self) -> Optional[str]:
        """Get custom working directory"""
        return self._data.get('startup', {}).get('working_directory')

    def get_environment_variables(self) -> Dict[str, str]:
        """Get environment variables to set"""
        env_section = self._data.get('environment', {})
        return {k: v for k, v in env_section.items() if k != 'variables'}

    # Build Settings Section
    def get_build_platforms(self) -> List[str]:
        """Get target build platforms"""
        platforms = self._data.get('build_settings', {}).get('build_platforms', '')
        if not platforms:
            return []
        return [p.strip() for p in platforms.split(',') if p.strip()]

    def use_external_resources(self) -> bool:
        """Check if external resources should be used"""
        return self._data.get('build_settings', {}).get('use_external_resources', 'false').lower() == 'true'

    def optimize_images(self) -> bool:
        """Check if images should be optimized"""
        return self._data.get('build_settings', {}).get('optimize_images', 'false').lower() == 'true'

    # Raw access
    def get_section(self, section: str) -> Dict[str, str]:
        """Get entire section as dictionary"""
        return self._data.get(section, {})

    def get_value(self, section: str, key: str, default: Any = None) -> Any:
        """Get specific value from section"""
        return self._data.get(section, {}).get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        """Get all configuration data as dictionary"""
        return self._data.copy()


class BuildConfigParser:
    """
    Parser for build_config.ini files in app directories.
    """

    # Default configuration template
    DEFAULT_CONFIG_TEMPLATE = """# Build Configuration Template
# This file defines installation and runtime settings for the application

[app_info]
# Display names (at least one should be provided)
display_name_chinese =
display_name_english = My Application
description = Application description
version = 1.0.0
author =

[dependencies]
# Runtime dependencies
require_nodejs = true
require_python = true
# Optional: specify required versions
# nodejs_version = 22.x
# python_version = 3.13
# Additional packages (comma-separated)
# npm_packages = express, axios
# pip_packages = requests, pandas

[installation]
# Installation behavior
skip_pnpm_install = false
skip_pycore_init = false
create_desktop_shortcut = true
# Commands to run (semicolon-separated)
# pre_install_commands = echo "Pre-install"; mkdir build
# post_install_commands = echo "Post-install complete"

[startup]
# Custom startup command (overrides default)
# command = node index.js --production
# working_directory = ./dist
# timeout = 30

[environment]
# Environment variables for runtime
# NODE_ENV = production
# DEBUG = false

[build_settings]
# Build configuration (for future use)
build_platforms =
use_external_resources = false
optimize_images = false
"""

    def __init__(self, config_path: str):
        """
        Initialize parser with path to build_config.ini

        Args:
            config_path: Path to build_config.ini file
        """
        self.config_path = Path(config_path)
        self.app_dir = self.config_path.parent
        self._exists = self.config_path.exists()

    def exists(self) -> bool:
        """Check if config file exists"""
        return self._exists

    def parse(self) -> Optional[BuildConfig]:
        """
        Parse configuration file and return BuildConfig object.

        Returns:
            BuildConfig object if file exists and is valid, None otherwise
        """
        if not self.exists():
            return None

        try:
            config = configparser.ConfigParser()
            config.read(self.config_path, encoding='utf-8')

            # Convert to dictionary
            config_data = {}
            for section in config.sections():
                config_data[section] = dict(config.items(section))

            return BuildConfig(config_data)

        except Exception as e:
            print(f"[WARNING] Failed to parse build_config.ini: {e}")
            return None

    def create_default_config(self) -> bool:
        """
        Create a default build_config.ini file in the app directory.

        Returns:
            True if created successfully, False otherwise
        """
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w', encoding='utf-8') as f:
                f.write(self.DEFAULT_CONFIG_TEMPLATE)
            self._exists = True
            return True
        except Exception as e:
            print(f"[ERROR] Failed to create default config: {e}")
            return False

    @staticmethod
    def get_config_from_app_dir(app_dir: str) -> Optional[BuildConfig]:
        """
        Convenience method to get config directly from app directory.

        Args:
            app_dir: Application directory path

        Returns:
            BuildConfig object if config exists, None otherwise
        """
        config_path = Path(app_dir) / "build_config.ini"
        parser = BuildConfigParser(str(config_path))
        return parser.parse()


# Convenience functions
def load_build_config(app_dir: str) -> Optional[BuildConfig]:
    """
    Load build configuration from app directory.

    Args:
        app_dir: Application directory path

    Returns:
        BuildConfig object or None
    """
    return BuildConfigParser.get_config_from_app_dir(app_dir)


def has_build_config(app_dir: str) -> bool:
    """
    Check if app directory has build_config.ini

    Args:
        app_dir: Application directory path

    Returns:
        True if config file exists
    """
    config_path = Path(app_dir) / "build_config.ini"
    return config_path.exists()


# Export public API
__all__ = [
    'BuildConfig',
    'BuildConfigParser',
    'load_build_config',
    'has_build_config',
]
