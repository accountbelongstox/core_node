"""
Special Software Environment Manager - Python Implementation

This module provides cross-platform support for managing special software environment variables.
It replaces the Windows PowerShell-only implementation with a Python-based solution that works
on both Windows and Linux.

Main Components:
- special_software_env_manager.py: Main entry point and logic
- common_utils.py: Common menu functions and utilities
- config_manager.py: Configuration management for all tools
- command_content_generator_windows.py: Windows command generator
- command_content_generator_linux.py: Linux command generator

Usage:
    python special_software_env_manager.py
"""

__version__ = '1.0.0'
__author__ = 'AI Assistant'

# Package exports
__all__ = ['__version__', '__author__']
