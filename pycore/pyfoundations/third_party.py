#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Third-Party Package Unified Import Manager

This module provides a unified interface for importing third-party packages
with automatic dependency checking and installation.

All third-party packages MUST be imported through this module.
Usage: from pycore.pyfoundations.third_party import aiohttp, netifaces, etc.

The module automatically checks and installs missing packages on first import.
"""

import os
import sys
import subprocess
import importlib.util
import platform

from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint

# Dependency Map
# Maps the required import name to the official PyPI package name.
# All new third-party dependencies for any tool must be added here.
#
# IMPORTANT: DO NOT MODIFY platform-specific package filtering logic below
# Windows-only packages are automatically skipped on Linux/Mac systems
DEPENDENCY_MAP = {
    # PIL is a common name for the Pillow package
    "PIL": "Pillow",

    # For computer vision tasks
    "cv2": "opencv-python",

    # For window automation and screenshots
    "pyautogui": "pyautogui",

    # For process management
    "psutil": "psutil",

    # For fast screenshots
    "mss": "mss",

    # For YOLO training and deep learning
    "torch": "torch",
    "ultralytics": "ultralytics",
    "numpy": "numpy",

    # For ADB communication (pyutils.device)
    "adb_shell": "adb-shell",

    # For video processing (pyutils.stream)
    "av": "av",

    # For FastAPI web framework (pyutils.api, pyutils.web)
    "fastapi": "fastapi",
    "uvicorn": "uvicorn[standard]",
    "pydantic": "pydantic",
    "websockets": "websockets",

    # For HTTP requests
    "requests": "requests",
    "aiohttp": "aiohttp",

    # For network interface detection (pyutils.rpc.discovery)
    "netifaces": "netifaces",

    # For WebView GUI (pyutils.web, pyutils.native_ui)
    "webview": "pywebview",
    "tkinterweb": "tkinterweb",
    "tkhtmlview": "tkhtmlview",
    "pystray": "pystray",

    # For logging
    "loguru": "loguru",

    # For YAML configuration
    "yaml": "pyyaml",

    # For Azure Cognitive Services Speech
    "azure.cognitiveservices.speech": "azure-cognitiveservices-speech",

    # For Edge TTS (Microsoft Edge Text-to-Speech)
    "edge_tts": "edge-tts",
}

# Windows-only packages
# IMPORTANT: DO NOT MODIFY - These packages are only available on Windows
# The installation logic below automatically skips these on Linux/Mac
WINDOWS_ONLY_PACKAGES = {
    # For win_actor, tray_clicker, ui_analyzer
    "win32gui": "pywin32",
    "win32con": "pywin32",
    "win32api": "pywin32",
    "win32ui": "pywin32",

    # For tray_clicker, ui_analyzer
    "pywinauto": "pywinauto",

    # For window management (Windows-specific)
    "pygetwindow": "pygetwindow",

    # For UI automation (Windows-specific)
    "uiautomation": "uiautomation",
}


def check_and_install_dependencies():
    """
    Checks if all required packages are installed and installs them if not.
    Also performs GPU detection and setup.

    This function iterates through the DEPENDENCY_MAP. It uses importlib to check
    if a module can be found. If not, it calls pip to install the corresponding package.

    Uses ENCYCLOPEDIA global cache to ensure only the first call does actual checking and prints output.
    """
    # Allow callers to skip dependency checks via environment variable
    if os.environ.get('PYCORE_SKIP_DEP_CHECK') == '1':
        ENCYCLOPEDIA['pycore_dependencies_checked'] = True
        return

    # Check if dependencies have already been checked using ENCYCLOPEDIA
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return

    ColorPrint.blue("[INFO] Checking for required Python packages...")
    installed_packages = set()
    missing_packages = set()
    installed_packages_list = []

    # Merge dependency maps based on platform
    # IMPORTANT: DO NOT MODIFY - Windows packages are automatically skipped on Linux/Mac
    current_platform = platform.system()

    all_dependencies = dict(DEPENDENCY_MAP)
    if current_platform == 'Windows':
        all_dependencies.update(WINDOWS_ONLY_PACKAGES)
    else:
        ColorPrint.blue(f"[INFO] Skipping Windows-only packages on {current_platform}")

    # Use a set to avoid checking/installing the same package multiple times (e.g., pywin32)
    packages_to_check = set(all_dependencies.values())

    for package_name in packages_to_check:
        # We check for the installation status of the package itself, not the import name.
        # A bit of a simplification, we assume the main importable module has a similar name
        # or that checking one is enough. For pywin32, checking 'win32gui' is a good proxy.

        # Find the import name associated with the package to check its spec
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break

        if importlib.util.find_spec(import_name_to_check) is None:
            missing_packages.add(package_name)
            ColorPrint.yellow(f"[INSTALL] Package for '{import_name_to_check}' ('{package_name}') not found. Installing...")

            # Build pip install command
            pip_cmd = [sys.executable, "-m", "pip", "install", package_name]

            # On Linux/Mac, add --break-system-packages if needed (for externally-managed environments)
            # On Windows, use normal pip install
            if current_platform != 'Windows':
                pip_cmd.append("--break-system-packages")

            result = subprocess.run(pip_cmd, check=True)
            ColorPrint.green(f"[SUCCESS] Successfully installed {package_name}.")
            installed_packages.add(package_name)
            installed_packages_list.append(package_name)
        else:
            installed_packages.add(package_name)
            installed_packages_list.append(package_name)

    if installed_packages:
        ColorPrint.blue(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    ColorPrint.green("[INFO] All required packages are available.")

    # GPU Detection and Setup (default: enabled, auto_install: False)
    enable_gpu_setup = os.environ.get('PYCORE_ENABLE_GPU_SETUP', 'true').lower() == 'true'
    auto_install_gpu = os.environ.get('PYCORE_AUTO_INSTALL_GPU', 'false').lower() == 'true'
    
    if enable_gpu_setup:
        try:
            # Delay import to avoid circular dependency
            from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

            # Initialize GPU manager (verbose=True to show detection info)
            # auto_install will install PyTorch CUDA if GPU detected
            gpu_manager = get_gpu_manager(verbose=True, auto_install=auto_install_gpu)

            # Store GPU info in ENCYCLOPEDIA for quick access
            ENCYCLOPEDIA.add("pycore_gpu_info", gpu_manager.get_info())
        except ImportError:
            # GPU manager not available (pyutils.ultralytics not installed)
            ColorPrint.blue("[INFO] GPU manager not available, skipping GPU setup")
        except Exception as e:
            # Non-critical error, continue
            ColorPrint.yellow(f"[WARNING] GPU setup failed: {e}")

    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))


# Auto-check dependencies when module is imported
# This ensures dependencies are available for all modules using third-party packages
# Uses ENCYCLOPEDIA for global caching - only runs once per Python process

try:
    check_and_install_dependencies()
except Exception as e:
    ColorPrint.yellow(f"[WARNING] Failed to check dependencies during import: {e}")


# Direct imports after dependency check
# All third-party packages are imported directly and exported
# Packages are already installed by check_and_install_dependencies() above

# Standard packages
import aiohttp
import netifaces
import websockets
import requests
import fastapi
import uvicorn
import pydantic
import PIL
import cv2
import pyautogui
import psutil
import mss
import torch
import ultralytics
import numpy
import adb_shell
import av
import webview
import tkinterweb
import tkhtmlview
import pystray
import loguru
import yaml

# Azure Cognitive Services Speech SDK
try:
    import azure.cognitiveservices.speech
    speechsdk = azure.cognitiveservices.speech
except ImportError:
    speechsdk = None

# Edge TTS (Microsoft Edge Text-to-Speech)
try:
    import edge_tts
except ImportError:
    edge_tts = None

# Windows-only packages (only available on Windows)
if platform.system() == 'Windows':
    import win32gui
    import win32con
    import win32api
    import win32ui
    import pywinauto
    import pygetwindow
    import uiautomation
else:
    # Create None placeholders for non-Windows systems
    win32gui = None
    win32con = None
    win32api = None
    win32ui = None
    pywinauto = None
    pygetwindow = None
    uiautomation = None


__all__ = [
    'check_and_install_dependencies',
    'DEPENDENCY_MAP',
    'WINDOWS_ONLY_PACKAGES',
    # Standard packages
    'aiohttp',
    'netifaces',
    'websockets',
    'requests',
    'fastapi',
    'uvicorn',
    'pydantic',
    'PIL',
    'cv2',
    'pyautogui',
    'psutil',
    'mss',
    'torch',
    'ultralytics',
    'numpy',
    'adb_shell',
    'av',
    'webview',
    'tkinterweb',
    'tkhtmlview',
    'pystray',
    'loguru',
    'yaml',
    # Azure Cognitive Services Speech SDK
    'speechsdk',
    # Edge TTS
    'edge_tts',
    # Windows-only packages (only available on Windows)
    'win32gui',
    'win32con',
    'win32api',
    'win32ui',
    'pywinauto',
    'pygetwindow',
    'uiautomation',
]
