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
import importlib
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
    "uvicorn": "uvicorn[standard]",
    "websockets": "websockets",

    # For HTTP requests
    "requests": "requests",
    "aiohttp": "aiohttp",
    "fastapi": "fastapi",

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

    # For OCR (Optical Character Recognition)
    "cnocr": "cnocr[ort-cpu]",

    # For document processing
    "PyPDF2": "PyPDF2",
    "pdfplumber": "pdfplumber",
    "docx": "python-docx",
    "openpyxl": "openpyxl",
    "pptx": "python-pptx",

    # For machine learning and color analysis
    "sklearn": "scikit-learn",

    # For database operations
    "sqlalchemy": "sqlalchemy",

    # For MCP (Model Context Protocol) servers - FastMCP v2
    "fastmcp": "fastmcp",

    # For Azure Speech SDK (optional, but can be auto-installed)
    # Note: Import name uses dots (azure.cognitiveservices.speech)
    #       Package name uses hyphens (azure-cognitiveservices-speech)
    #       Install with: pip install azure-cognitiveservices-speech
    "azure.cognitiveservices.speech": "azure-cognitiveservices-speech",
}

# Optional packages - won't cause import failure if missing
# These packages are optional and the code handles their absence gracefully
OPTIONAL_PACKAGES = {
    # For Edge TTS (Microsoft Edge Text-to-Speech - optional)
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

# System packages required for Python packages (Debian/Ubuntu only)
# These are installed via apt-get, not pip
SYSTEM_PACKAGES = [
    "python3-tk",              # Required for tkinter GUI support
    "python3-dev",              # Required for building Python extensions
    "gir1.2-appindicator3-0.1", # Required for system tray indicators
    "gir1.2-gtk-3.0",          # Required for GTK3 GUI support
    "python3-gi",               # Required for GObject Introspection (GTK bindings)
    "python3-gi-cairo",         # Required for Cairo graphics with GObject
    "python3-pil",              # Required for PIL/Pillow image processing
    "python3-pil.imagetk",      # Required for PIL/Pillow with Tkinter support
]


def check_system_package_installed(package_name: str) -> bool:
    """
    Check if a system package is installed (Debian/Ubuntu only).
    
    Args:
        package_name: Name of the system package to check
        
    Returns:
        True if package is installed, False otherwise
    """
    try:
        # Use dpkg to check if package is installed
        result = subprocess.run(
            ["dpkg", "-l", package_name],
            capture_output=True,
            text=True,
            check=False
        )
        # If package is installed, dpkg -l will show it (exit code 0 and output contains package)
        return result.returncode == 0 and package_name in result.stdout
    except (FileNotFoundError, subprocess.SubprocessError):
        # dpkg not available or error occurred
        return False


def install_system_packages():
    """
    Check and install required system packages (Linux/Debian/Ubuntu only).
    
    Uses apt-get to install system packages. Requires sudo privileges.
    Only runs on Linux systems with apt-get available.
    First fixes any broken packages, then updates package list, then installs missing packages.
    """
    current_platform = platform.system()
    
    # Only run on Linux
    if current_platform != 'Linux':
        return
    
    # Check if apt-get is available
    try:
        subprocess.run(["which", "apt-get"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.SubprocessError):
        ColorPrint.blue("[INFO] apt-get not available, skipping system package check")
        return
    
    # Check if we have sudo privileges (or running as root)
    has_sudo = False
    if os.geteuid() == 0:
        has_sudo = True
    else:
        # Check if sudo is available and we can use it
        try:
            result = subprocess.run(
                ["sudo", "-n", "true"],
                capture_output=True,
                check=False
            )
            if result.returncode == 0:
                has_sudo = True
        except (FileNotFoundError, subprocess.SubprocessError):
            pass
    
    if not has_sudo:
        ColorPrint.yellow("[WARNING] Sudo privileges required for system package installation")
        ColorPrint.yellow(f"[WARNING] Please install manually: sudo apt-get install {' '.join(SYSTEM_PACKAGES)}")
        return
    
    ColorPrint.blue("[INFO] Checking for required system packages...")
    missing_packages = []
    
    for package in SYSTEM_PACKAGES:
        if not check_system_package_installed(package):
            missing_packages.append(package)
            ColorPrint.yellow(f"[INSTALL] System package '{package}' not found. Installing...")
        else:
            ColorPrint.green(f"[OK] System package '{package}' is installed")
    
    if missing_packages:
        try:
            # Fix broken packages first (if any)
            ColorPrint.blue("[INFO] Checking for broken packages and fixing if needed...")
            fix_cmd = ["sudo", "apt", "--fix-broken", "install", "-y"]
            fix_result = subprocess.run(fix_cmd, capture_output=True, text=True, check=False)
            if fix_result.returncode == 0:
                ColorPrint.green("[OK] Broken packages fixed (or none found)")
            else:
                # Try alternative command
                fix_cmd2 = ["sudo", "apt", "-f", "install", "-y"]
                fix_result2 = subprocess.run(fix_cmd2, capture_output=True, text=True, check=False)
                if fix_result2.returncode == 0:
                    ColorPrint.green("[OK] Broken packages fixed (or none found)")
                else:
                    ColorPrint.yellow("[WARNING] Could not fix broken packages, continuing anyway...")
            
            # Update package list
            ColorPrint.blue("[INFO] Updating package list...")
            update_cmd = ["sudo", "apt-get", "update", "-qq"]
            subprocess.run(update_cmd, check=True)
            
            # Install missing packages
            install_cmd = ["sudo", "apt-get", "install", "-y"] + missing_packages
            ColorPrint.blue(f"[INFO] Installing system packages: {', '.join(missing_packages)}")
            result = subprocess.run(install_cmd, check=True)
            
            ColorPrint.green(f"[SUCCESS] Successfully installed system packages: {', '.join(missing_packages)}")
        except subprocess.CalledProcessError as e:
            ColorPrint.red(f"[ERROR] Failed to install system packages: {e}")
            ColorPrint.yellow(f"[WARNING] Please install manually: sudo apt-get install {' '.join(missing_packages)}")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Unexpected error installing system packages: {e}")
    else:
        ColorPrint.green("[INFO] All required system packages are installed")


def build_pip_install_command(package_name: str) -> list:
    """
    Build pip install command with platform-specific flags.
    
    Args:
        package_name: The package name to install
    
    Returns:
        List of command arguments for subprocess.run()
    """
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install"]
    
    # On Linux/Mac, use --break-system-packages --ignore-installed for reliable installation
    # On Windows, use normal pip install
    if current_platform != 'Windows':
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    
    pip_cmd.append(package_name)
    return pip_cmd


def install_and_reimport_azure():
    """
    Install Azure Speech SDK package and reimport it.
    
    Direct hard import, no string variables, no DEPENDENCY_MAP lookup.
    
    Returns:
        The imported module if successful, None otherwise.
    """
    # Try direct hard import first
    try:
        import azure.cognitiveservices.speech
        return azure.cognitiveservices.speech
    except ImportError:
        pass
    
    # If import failed, install package directly
    ColorPrint.blue("[INFO] Installing Azure Speech SDK package...")
    pip_cmd = build_pip_install_command("azure-cognitiveservices-speech")
    
    try:
        result = subprocess.run(pip_cmd, check=True, capture_output=True, text=True)
        ColorPrint.green("[SUCCESS] Successfully installed Azure Speech SDK")
        
        # Invalidate import caches
        importlib.invalidate_caches()
        
        # Try hard import again
        try:
            import azure.cognitiveservices.speech
            ColorPrint.green("[SUCCESS] Successfully imported Azure Speech SDK")
            return azure.cognitiveservices.speech
        except ImportError as e:
            ColorPrint.yellow("[WARNING] Package installed but import still failed")
            ColorPrint.yellow("[WARNING] This may require a Python restart")
            return None
            
    except subprocess.CalledProcessError as e:
        ColorPrint.red("[ERROR] Failed to install Azure Speech SDK")
        if e.stdout:
            ColorPrint.yellow(f"[INFO] Install output: {e.stdout[-500:]}")
        if e.stderr:
            ColorPrint.yellow(f"[INFO] Install error: {e.stderr[-500:]}")
        return None
    except Exception as e:
        ColorPrint.red("[ERROR] Unexpected error installing Azure Speech SDK")
        return None


def install_and_reimport_edge_tts():
    """
    Install Edge TTS package and reimport it.
    
    Direct hard import, no string variables, no DEPENDENCY_MAP lookup.
    
    Returns:
        The imported module if successful, None otherwise.
    """
    # Try direct hard import first
    try:
        import edge_tts
        return edge_tts
    except ImportError:
        pass
    
    # If import failed, install package directly
    ColorPrint.blue("[INFO] Installing Edge TTS package...")
    pip_cmd = build_pip_install_command("edge-tts")
    
    try:
        result = subprocess.run(pip_cmd, check=True, capture_output=True, text=True)
        ColorPrint.green("[SUCCESS] Successfully installed Edge TTS")
        
        # Invalidate import caches
        importlib.invalidate_caches()
        
        # Try hard import again
        try:
            import edge_tts
            ColorPrint.green("[SUCCESS] Successfully imported Edge TTS")
            return edge_tts
        except ImportError as e:
            ColorPrint.yellow("[WARNING] Package installed but import still failed")
            ColorPrint.yellow("[WARNING] This may require a Python restart")
            return None
            
    except subprocess.CalledProcessError as e:
        ColorPrint.red("[ERROR] Failed to install Edge TTS")
        if e.stdout:
            ColorPrint.yellow(f"[INFO] Install output: {e.stdout[-500:]}")
        if e.stderr:
            ColorPrint.yellow(f"[INFO] Install error: {e.stderr[-500:]}")
        return None
    except Exception as e:
        ColorPrint.red("[ERROR] Unexpected error installing Edge TTS")
        return None


def check_and_install_dependencies():
    """
    Checks if all required packages are installed and installs them if not.
    Also performs GPU detection and setup.

    This function iterates through the DEPENDENCY_MAP. It uses importlib to check
    if a module can be found. If not, it calls pip to install the corresponding package.

    Uses ENCYCLOPEDIA global cache to ensure only the first call does actual checking and prints output.
    """
    ColorPrint.blue("[INFO] Checking for required Python packages...")
    # Allow callers to skip dependency checks via environment variable
    if os.environ.get('PYCORE_SKIP_DEP_CHECK') == '1':
        ENCYCLOPEDIA['pycore_dependencies_checked'] = True
        return

    # Check if dependencies have already been checked using ENCYCLOPEDIA
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return
    
    # Prevent recursive invocation - if we're already checking, return immediately
    if ENCYCLOPEDIA.get("pycore_dependencies_checking", False):
        return
    
    # Mark as checking to prevent recursion
    ENCYCLOPEDIA.add("pycore_dependencies_checking", True)

    # Check and install system packages first (before Python packages)
    install_system_packages()

    installed_packages = set()
    missing_packages = set()
    installed_packages_list = []

    # Merge dependency maps based on platform
    # IMPORTANT: DO NOT MODIFY - Windows packages are automatically skipped on Linux/Mac
    current_platform = platform.system()

    # Required packages only (no optional packages during check)
    all_dependencies = dict(DEPENDENCY_MAP)
    if current_platform == 'Windows':
        all_dependencies.update(WINDOWS_ONLY_PACKAGES)
    else:
        ColorPrint.blue(f"[INFO] Skipping Windows-only packages on {current_platform}")

    # Optional packages are not checked/installed automatically
    ColorPrint.blue(f"[INFO] Optional packages are not auto-installed")

    # Use a set to avoid checking/installing the same package multiple times (e.g., pywin32)
    packages_to_check = set(all_dependencies.values())
    
    # Check if any packages need installation/upgrade, and upgrade pip first if needed
    needs_installation = False
    for package_name in packages_to_check:
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break
        if import_name_to_check and importlib.util.find_spec(import_name_to_check) is None:
            needs_installation = True
            break
    
    # Upgrade pip first if any packages need installation
    if needs_installation:
        ColorPrint.blue("[INFO] Upgrading pip to latest version...")
        try:
            pip_upgrade_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "pip"]
            if current_platform != 'Windows':
                pip_upgrade_cmd.extend(["--break-system-packages", "--ignore-installed"])
            subprocess.run(pip_upgrade_cmd, check=True, capture_output=True, text=True)
            ColorPrint.green("[SUCCESS] pip upgraded successfully")
        except subprocess.CalledProcessError as e:
            ColorPrint.yellow(f"[WARNING] Failed to upgrade pip: {e}")
            ColorPrint.yellow("[WARNING] Continuing with package installation anyway...")

    failed_packages = []
    
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

        # Safely check if module can be imported (handle exceptions)
        try:
            module_spec = importlib.util.find_spec(import_name_to_check)
            is_installed = module_spec is not None
        except Exception as e:
            ColorPrint.yellow(f"[WARNING] Error checking '{import_name_to_check}': {e}")
            is_installed = False

        if not is_installed:
            missing_packages.add(package_name)
            ColorPrint.yellow(f"[INSTALL] Package for '{import_name_to_check}' ('{package_name}') not found. Installing...")

            # Build pip install command using reusable helper
            pip_cmd = build_pip_install_command(package_name)

            try:
                result = subprocess.run(pip_cmd, check=True, capture_output=True, text=True)
                ColorPrint.green(f"[SUCCESS] Successfully installed {package_name}.")
                
                # Verify installation by checking if module can be imported
                importlib.invalidate_caches()
                try:
                    module_spec = importlib.util.find_spec(import_name_to_check)
                    if module_spec is None:
                        ColorPrint.yellow(f"[WARNING] Package {package_name} installed but import '{import_name_to_check}' still not available")
                        ColorPrint.yellow(f"[WARNING] This may require a Python restart or the package may need different import name")
                        failed_packages.append((package_name, import_name_to_check))
                    else:
                        installed_packages.add(package_name)
                        installed_packages_list.append(package_name)
                except Exception as e:
                    ColorPrint.yellow(f"[WARNING] Error verifying '{import_name_to_check}' after installation: {e}")
                    failed_packages.append((package_name, import_name_to_check))
            except subprocess.CalledProcessError as e:
                ColorPrint.red(f"[ERROR] Failed to install {package_name}: {e}")
                if e.stdout:
                    ColorPrint.yellow(f"[INFO] Install output: {e.stdout[-500:]}")  # Last 500 chars
                if e.stderr:
                    ColorPrint.yellow(f"[INFO] Install error: {e.stderr[-500:]}")  # Last 500 chars
                if current_platform != 'Windows':
                    ColorPrint.yellow(f"[WARNING] Please install manually: pip install --break-system-packages --ignore-installed {package_name}")
                else:
                    ColorPrint.yellow(f"[WARNING] Please install manually: pip install {package_name}")
                failed_packages.append((package_name, import_name_to_check))
        else:
            installed_packages.add(package_name)
            installed_packages_list.append(package_name)
    
    # Report failed packages if any
    if failed_packages:
        ColorPrint.yellow(f"[WARNING] {len(failed_packages)} package(s) failed to install or verify:")
        for pkg_name, import_name in failed_packages:
            ColorPrint.yellow(f"  - {import_name} ({pkg_name})")

    if installed_packages:
        ColorPrint.blue(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    ColorPrint.green("[INFO] All required packages are available.")


    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))
    # Remove checking flag
    ENCYCLOPEDIA.add("pycore_dependencies_checking", False)


# Auto-check dependencies when module is imported
# This ensures dependencies are available for all modules using third-party packages
# Uses ENCYCLOPEDIA for global caching - only runs once per Python process

try:
    check_and_install_dependencies()
except Exception as e:
    ColorPrint.red(f"[ERROR] Failed to check dependencies during import: {e}")
    ColorPrint.yellow("[WARNING] Attempting to continue, but some packages may be missing")
    # Ensure checking flag is cleared even on error
    ENCYCLOPEDIA.add("pycore_dependencies_checking", False)


# Direct imports after dependency check
# All third-party packages are imported directly and exported
# Packages are already installed by check_and_install_dependencies() above

# Standard packages
import aiohttp
import netifaces
import websockets
import requests
import uvicorn
import fastapi
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
import loguru
import yaml
import webview
import tkinterweb
import tkhtmlview
import pystray
import cnocr

# Document processing packages
import PyPDF2
import pdfplumber
import docx
import openpyxl
import pptx

# Machine learning
import sklearn

# Database operations
import sqlalchemy

# MCP (Model Context Protocol) - FastMCP v2
import fastmcp
from fastmcp import FastMCP, Context

# Convenience aliases for PIL
from PIL import Image as PIL_Image, ImageDraw as PIL_ImageDraw, ImageFont as PIL_ImageFont

# Convenience aliases for document libraries
python_docx = docx
python_pptx = pptx

# Azure Speech SDK - optional import (if needed)
# Package: azure-cognitiveservices-speech (install with: pip install azure-cognitiveservices-speech)
# Import: azure.cognitiveservices.speech (note: dots in import, hyphens in package name)
# Direct call to install function which handles import and installation
speechsdk = install_and_reimport_azure()

# Edge TTS (Microsoft Edge Text-to-Speech) - optional import
# Direct call to install function which handles import and installation
edge_tts = install_and_reimport_edge_tts()

# Windows-only packages (only available on Windows)
current_platform = platform.system()
if current_platform == 'Windows':
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
    'check_system_package_installed',
    'install_system_packages',
    'aiohttp',
    'netifaces',
    'websockets',
    'requests',
    'uvicorn',
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
    'cnocr',
    # Document processing packages
    'PyPDF2',
    'pdfplumber',
    'docx',
    'python_docx',  # alias
    'openpyxl',
    'pptx',
    'python_pptx',  # alias
    'sklearn',
    'sqlalchemy',
    # PIL convenience aliases
    'PIL_Image',
    'PIL_ImageDraw',
    'PIL_ImageFont',
    # MCP (Model Context Protocol) - FastMCP v2
    'fastmcp',         # FastMCP module
    'FastMCP',         # FastMCP server class
    'Context',         # MCP context for tools/resources
    # Optional packages (may be None if not installed)
    'speechsdk',       # Azure Speech SDK (optional)
    'edge_tts',        # Edge TTS (optional)
    # Windows-only packages (only available on Windows, None on Linux/Mac)
    'win32gui',
    'win32con',
    'win32api',
    'win32ui',
    'pywinauto',
    'pygetwindow',
    'uiautomation',
]
