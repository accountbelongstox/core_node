"""
Special Software Environment Manager - Python Implementation

This module provides cross-platform support for managing special software environment variables.
It replaces the Windows PowerShell-only implementation with a Python-based solution that works
on both Windows and Linux.

Main Components:
- special_software_env_manager.py: Main entry point and logic
- utils/: shared utilities (common_utils, secret_manager, smart_recognition)
- config/: configuration management (config_manager, path_config)
- generators/: platform command generators (command_content_generator_windows/linux)
- managers/: feature managers (env vars, scripts, backup, menu, command handling)
- script_sections/: PowerShell/bash script-fragment builders

Usage:
    python special_software_env_manager.py
"""

__version__ = '1.0.0'
__author__ = 'AI Assistant'

# Package exports
__all__ = ['__version__', '__author__']
