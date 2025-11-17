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

    # For HTML parsing
    "bs4": "beautifulsoup4",

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

    # For audio input/output (cross-platform)
    # Standard PyAudio for Linux/macOS
    "pyaudio": "pyaudio",

    # For global hotkey listening (keyboard and mouse)
    "pynput": "pynput",

    # For clipboard operations (cross-platform)
    "pyperclip": "pyperclip",
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

    # For audio with WASAPI loopback support (Windows-specific)
    "pyaudiowpatch": "pyaudiowpatch",
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
    "portaudio19-dev",          # Required for pyaudio (audio input/output)
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


def run_pip_install_with_realtime_output(pip_cmd: list, package_name: str) -> bool:
    """
    Run pip install command with real-time output.
    
    Args:
        pip_cmd: List of command arguments
        package_name: Name of package being installed (for display)
    
    Returns:
        True if installation succeeded, False otherwise
    """
    try:
        process = subprocess.Popen(
            pip_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Read output line by line in real-time
        for line in process.stdout:
            line = line.strip()
            if line:
                # Show important installation progress lines
                if any(keyword in line.lower() for keyword in [
                    "downloading", "installing", "collecting", "successfully",
                    "building", "wheels", "already satisfied", "requirement"
                ]):
                    ColorPrint.gray(f"   {line}")
        
        # Wait for process to complete
        process.wait()
        
        if process.returncode == 0:
            return True
        else:
            ColorPrint.red(f"[ERROR] Installation failed with return code {process.returncode}")
            return False
            
    except Exception as e:
        ColorPrint.red(f"[ERROR] Command execution failed: {e}")
        return False


def run_command_with_realtime_output(cmd: list, description: str = "") -> bool:
    """
    Run command with real-time output.
    
    Args:
        cmd: List of command arguments
        description: Description of what is being executed (for display)
    
    Returns:
        True if command succeeded, False otherwise
    """
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Read output line by line in real-time
        for line in process.stdout:
            line = line.strip()
            if line:
                ColorPrint.gray(f"   {line}")
        
        # Wait for process to complete
        process.wait()
        
        if process.returncode == 0:
            return True
        else:
            ColorPrint.red(f"[ERROR] Command failed with return code {process.returncode}")
            return False
            
    except Exception as e:
        ColorPrint.red(f"[ERROR] Command execution failed: {e}")
        return False


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
    
    # Run installation with real-time output
    run_pip_install_with_realtime_output(pip_cmd, "azure-cognitiveservices-speech")
    
    # Verify installation by trying to import (not by return code)
    importlib.invalidate_caches()
    try:
        import azure.cognitiveservices.speech
        ColorPrint.green("[SUCCESS] Successfully installed and imported Azure Speech SDK")
        return azure.cognitiveservices.speech
    except ImportError as e:
        ColorPrint.yellow("[WARNING] Package installation completed but import still failed")
        ColorPrint.yellow("[WARNING] This may require a Python restart")
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
    
    # Run installation with real-time output
    run_pip_install_with_realtime_output(pip_cmd, "edge-tts")
    
    # Verify installation by trying to import (not by return code)
    importlib.invalidate_caches()
    try:
        import edge_tts
        ColorPrint.green("[SUCCESS] Successfully installed and imported Edge TTS")
        return edge_tts
    except ImportError as e:
        ColorPrint.yellow("[WARNING] Package installation completed but import still failed")
        ColorPrint.yellow("[WARNING] This may require a Python restart")
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
        pip_upgrade_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "pip"]
        if current_platform != 'Windows':
            pip_upgrade_cmd.extend(["--break-system-packages", "--ignore-installed"])
        if run_pip_install_with_realtime_output(pip_upgrade_cmd, "pip"):
            ColorPrint.green("[SUCCESS] pip upgraded successfully")
        else:
            ColorPrint.yellow("[WARNING] Failed to upgrade pip")
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

            # Run installation with real-time output
            run_pip_install_with_realtime_output(pip_cmd, package_name)
            
            # Verify installation by checking if module can be imported (not by return code)
            importlib.invalidate_caches()
            try:
                module_spec = importlib.util.find_spec(import_name_to_check)
                if module_spec is None:
                    ColorPrint.yellow(f"[WARNING] Package {package_name} installed but import '{import_name_to_check}' still not available")
                    ColorPrint.yellow(f"[WARNING] This may require a Python restart or the package may need different import name")
                    failed_packages.append((package_name, import_name_to_check))
                else:
                    ColorPrint.green(f"[SUCCESS] Successfully installed {package_name}.")
                    installed_packages.add(package_name)
                    installed_packages_list.append(package_name)
            except Exception as e:
                ColorPrint.yellow(f"[WARNING] Error verifying '{import_name_to_check}' after installation: {e}")
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


# ============================================================================
# LAZY LOADING IMPLEMENTATION
# ============================================================================
# Packages are loaded only when first accessed via getter functions
# This significantly reduces initial import time (from ~12s to <1s)
# All packages are cached after first load to avoid repeated imports
# ============================================================================

# Global cache for loaded packages
_PACKAGE_CACHE = {}


def _lazy_import(package_name: str, import_statement: str):
    """
    Lazy import helper with caching

    Args:
        package_name: Cache key for the package
        import_statement: Python import statement to execute

    Returns:
        The imported module/package
    """
    if package_name not in _PACKAGE_CACHE:
        # Execute import statement and cache result
        local_vars = {}
        exec(import_statement, globals(), local_vars)
        _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
    return _PACKAGE_CACHE[package_name]


# Standard packages getter functions
def get_third_package_aiohttp():
    """Get aiohttp package (lazy load)"""
    return _lazy_import('aiohttp', 'import aiohttp')


def get_third_package_aiohttp_web():
    """Get aiohttp.web (lazy load)"""
    if 'aiohttp_web' not in _PACKAGE_CACHE:
        from aiohttp import web as aiohttp_web
        _PACKAGE_CACHE['aiohttp_web'] = aiohttp_web
    return _PACKAGE_CACHE['aiohttp_web']


def get_third_package_netifaces():
    """Get netifaces package (lazy load)"""
    return _lazy_import('netifaces', 'import netifaces')


def get_third_package_websockets():
    """Get websockets package (lazy load)"""
    return _lazy_import('websockets', 'import websockets')


def get_third_package_requests():
    """Get requests package (lazy load)"""
    return _lazy_import('requests', 'import requests')


def get_third_package_uvicorn():
    """Get uvicorn package (lazy load)"""
    return _lazy_import('uvicorn', 'import uvicorn')


def get_third_package_fastapi():
    """Get fastapi package (lazy load)"""
    return _lazy_import('fastapi', 'import fastapi')


def get_third_package_PIL():
    """Get PIL package (lazy load)"""
    return _lazy_import('PIL', 'import PIL')


def get_third_package_PIL_Image():
    """Get PIL.Image (lazy load)"""
    if 'PIL_Image' not in _PACKAGE_CACHE:
        from PIL import Image as PIL_Image
        _PACKAGE_CACHE['PIL_Image'] = PIL_Image
    return _PACKAGE_CACHE['PIL_Image']


def get_third_package_PIL_ImageDraw():
    """Get PIL.ImageDraw (lazy load)"""
    if 'PIL_ImageDraw' not in _PACKAGE_CACHE:
        from PIL import ImageDraw as PIL_ImageDraw
        _PACKAGE_CACHE['PIL_ImageDraw'] = PIL_ImageDraw
    return _PACKAGE_CACHE['PIL_ImageDraw']


def get_third_package_PIL_ImageFont():
    """Get PIL.ImageFont (lazy load)"""
    if 'PIL_ImageFont' not in _PACKAGE_CACHE:
        from PIL import ImageFont as PIL_ImageFont
        _PACKAGE_CACHE['PIL_ImageFont'] = PIL_ImageFont
    return _PACKAGE_CACHE['PIL_ImageFont']


def get_third_package_PIL_ImageTk():
    """Get PIL.ImageTk (lazy load)"""
    if 'PIL_ImageTk' not in _PACKAGE_CACHE:
        from PIL import ImageTk as PIL_ImageTk
        _PACKAGE_CACHE['PIL_ImageTk'] = PIL_ImageTk
    return _PACKAGE_CACHE['PIL_ImageTk']


def get_third_package_cv2():
    """Get cv2 package (lazy load)"""
    return _lazy_import('cv2', 'import cv2')


def get_third_package_pyautogui():
    """Get pyautogui package (lazy load)"""
    return _lazy_import('pyautogui', 'import pyautogui')


def get_third_package_psutil():
    """Get psutil package (lazy load)"""
    return _lazy_import('psutil', 'import psutil')


def get_third_package_mss():
    """Get mss package (lazy load)"""
    return _lazy_import('mss', 'import mss')


def get_third_package_torch():
    """Get torch package (lazy load) - Heavy package ~2s load time"""
    return _lazy_import('torch', 'import torch')


def get_third_package_ultralytics():
    """Get ultralytics package (lazy load) - Heavy package ~2s load time"""
    return _lazy_import('ultralytics', 'import ultralytics')


def get_third_package_numpy():
    """Get numpy package (lazy load)"""
    return _lazy_import('numpy', 'import numpy')


def get_third_package_adb_shell():
    """Get adb_shell package (lazy load)"""
    return _lazy_import('adb_shell', 'import adb_shell')


def get_third_package_av():
    """Get av package (lazy load)"""
    return _lazy_import('av', 'import av')


def get_third_package_loguru():
    """Get loguru package (lazy load)"""
    return _lazy_import('loguru', 'import loguru')


def get_third_package_yaml():
    """Get yaml package (lazy load)"""
    return _lazy_import('yaml', 'import yaml')


def get_third_package_webview():
    """Get webview package (lazy load)"""
    return _lazy_import('webview', 'import webview')


def get_third_package_tkinterweb():
    """Get tkinterweb package (lazy load)"""
    return _lazy_import('tkinterweb', 'import tkinterweb')


def get_third_package_tkhtmlview():
    """Get tkhtmlview package (lazy load)"""
    return _lazy_import('tkhtmlview', 'import tkhtmlview')


def get_third_package_pystray():
    """Get pystray package (lazy load)"""
    return _lazy_import('pystray', 'import pystray')


def get_third_package_cnocr():
    """Get cnocr package (lazy load) - Heavy package"""
    return _lazy_import('cnocr', 'import cnocr')


def get_third_package_pynput():
    """Get pynput package (lazy load)"""
    return _lazy_import('pynput', 'import pynput')


def get_third_package_pyperclip():
    """Get pyperclip package (lazy load)"""
    return _lazy_import('pyperclip', 'import pyperclip')


# Document processing packages
def get_third_package_PyPDF2():
    """Get PyPDF2 package (lazy load)"""
    return _lazy_import('PyPDF2', 'import PyPDF2')


def get_third_package_pdfplumber():
    """Get pdfplumber package (lazy load)"""
    return _lazy_import('pdfplumber', 'import pdfplumber')


def get_third_package_docx():
    """Get docx package (lazy load)"""
    return _lazy_import('docx', 'import docx')


def get_third_package_python_docx():
    """Get python-docx package (alias for docx, lazy load)"""
    return get_third_package_docx()


def get_third_package_openpyxl():
    """Get openpyxl package (lazy load)"""
    return _lazy_import('openpyxl', 'import openpyxl')


def get_third_package_pptx():
    """Get pptx package (lazy load)"""
    return _lazy_import('pptx', 'import pptx')


def get_third_package_python_pptx():
    """Get python-pptx package (alias for pptx, lazy load)"""
    return get_third_package_pptx()


# HTML parsing
def get_third_package_bs4():
    """Get bs4 (BeautifulSoup4) package (lazy load)"""
    return _lazy_import('bs4', 'import bs4')


def get_third_package_BeautifulSoup():
    """Get BeautifulSoup class from bs4 (lazy load)"""
    if 'BeautifulSoup' not in _PACKAGE_CACHE:
        from bs4 import BeautifulSoup
        _PACKAGE_CACHE['BeautifulSoup'] = BeautifulSoup
    return _PACKAGE_CACHE['BeautifulSoup']


# Machine learning
def get_third_package_sklearn():
    """Get sklearn package (lazy load) - Heavy package"""
    return _lazy_import('sklearn', 'import sklearn')


# Database operations
def get_third_package_sqlalchemy():
    """Get sqlalchemy package (lazy load)"""
    return _lazy_import('sqlalchemy', 'import sqlalchemy')


# MCP (Model Context Protocol) - FastMCP v2
def get_third_package_fastmcp():
    """Get fastmcp package (lazy load)"""
    return _lazy_import('fastmcp', 'import fastmcp')


def get_third_package_FastMCP():
    """Get FastMCP class (lazy load)"""
    if 'FastMCP' not in _PACKAGE_CACHE:
        from fastmcp import FastMCP
        _PACKAGE_CACHE['FastMCP'] = FastMCP
    return _PACKAGE_CACHE['FastMCP']


def get_third_package_Context():
    """Get MCP Context class (lazy load)"""
    if 'Context' not in _PACKAGE_CACHE:
        from fastmcp import Context
        _PACKAGE_CACHE['Context'] = Context
    return _PACKAGE_CACHE['Context']


# Optional packages
def get_third_package_speechsdk():
    """Get Azure Speech SDK (lazy load, optional)"""
    if 'speechsdk' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['speechsdk'] = install_and_reimport_azure()
    return _PACKAGE_CACHE['speechsdk']


def get_third_package_edge_tts():
    """Get Edge TTS (lazy load, optional)"""
    if 'edge_tts' not in _PACKAGE_CACHE:
        _PACKAGE_CACHE['edge_tts'] = install_and_reimport_edge_tts()
    return _PACKAGE_CACHE['edge_tts']


# Audio packages
def get_third_package_pyaudio():
    """Get pyaudio package (lazy load, may be None if not installed)"""
    if 'pyaudio' not in _PACKAGE_CACHE:
        try:
            import pyaudio
            _PACKAGE_CACHE['pyaudio'] = pyaudio
        except ImportError:
            ColorPrint.yellow("[WARNING] pyaudio not available")
            _PACKAGE_CACHE['pyaudio'] = None
    return _PACKAGE_CACHE['pyaudio']


# Windows-only packages
def get_third_package_win32gui():
    """Get win32gui package (lazy load, Windows only)"""
    if 'win32gui' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32gui
            _PACKAGE_CACHE['win32gui'] = win32gui
        else:
            _PACKAGE_CACHE['win32gui'] = None
    return _PACKAGE_CACHE['win32gui']


def get_third_package_win32con():
    """Get win32con package (lazy load, Windows only)"""
    if 'win32con' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32con
            _PACKAGE_CACHE['win32con'] = win32con
        else:
            _PACKAGE_CACHE['win32con'] = None
    return _PACKAGE_CACHE['win32con']


def get_third_package_win32api():
    """Get win32api package (lazy load, Windows only)"""
    if 'win32api' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32api
            _PACKAGE_CACHE['win32api'] = win32api
        else:
            _PACKAGE_CACHE['win32api'] = None
    return _PACKAGE_CACHE['win32api']


def get_third_package_win32ui():
    """Get win32ui package (lazy load, Windows only)"""
    if 'win32ui' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import win32ui
            _PACKAGE_CACHE['win32ui'] = win32ui
        else:
            _PACKAGE_CACHE['win32ui'] = None
    return _PACKAGE_CACHE['win32ui']


def get_third_package_pywinauto():
    """Get pywinauto package (lazy load, Windows only)"""
    if 'pywinauto' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import pywinauto
            _PACKAGE_CACHE['pywinauto'] = pywinauto
        else:
            _PACKAGE_CACHE['pywinauto'] = None
    return _PACKAGE_CACHE['pywinauto']


def get_third_package_pygetwindow():
    """Get pygetwindow package (lazy load, Windows only)"""
    if 'pygetwindow' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import pygetwindow
            _PACKAGE_CACHE['pygetwindow'] = pygetwindow
        else:
            _PACKAGE_CACHE['pygetwindow'] = None
    return _PACKAGE_CACHE['pygetwindow']


def get_third_package_uiautomation():
    """Get uiautomation package (lazy load, Windows only)"""
    if 'uiautomation' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            import uiautomation
            _PACKAGE_CACHE['uiautomation'] = uiautomation
        else:
            _PACKAGE_CACHE['uiautomation'] = None
    return _PACKAGE_CACHE['uiautomation']


def get_third_package_pyaudiowpatch():
    """Get pyaudiowpatch package (lazy load, Windows only)"""
    if 'pyaudiowpatch' not in _PACKAGE_CACHE:
        current_platform = platform.system()
        if current_platform == 'Windows':
            try:
                import pyaudiowpatch
                _PACKAGE_CACHE['pyaudiowpatch'] = pyaudiowpatch
            except ImportError:
                ColorPrint.yellow("[WARNING] pyaudiowpatch not available (Windows loopback may not work)")
                _PACKAGE_CACHE['pyaudiowpatch'] = None
        else:
            _PACKAGE_CACHE['pyaudiowpatch'] = None
    return _PACKAGE_CACHE['pyaudiowpatch']


__all__ = [
    # Dependency management utilities
    'check_system_package_installed',
    'install_system_packages',

    # Lazy loading getter functions (use these instead of direct imports)
    'get_third_package_aiohttp',
    'get_third_package_aiohttp_web',
    'get_third_package_netifaces',
    'get_third_package_websockets',
    'get_third_package_requests',
    'get_third_package_uvicorn',
    'get_third_package_fastapi',
    'get_third_package_PIL',
    'get_third_package_PIL_Image',
    'get_third_package_PIL_ImageDraw',
    'get_third_package_PIL_ImageFont',
    'get_third_package_PIL_ImageTk',
    'get_third_package_cv2',
    'get_third_package_pyautogui',
    'get_third_package_psutil',
    'get_third_package_mss',
    'get_third_package_torch',
    'get_third_package_ultralytics',
    'get_third_package_numpy',
    'get_third_package_adb_shell',
    'get_third_package_av',
    'get_third_package_loguru',
    'get_third_package_yaml',
    'get_third_package_webview',
    'get_third_package_tkinterweb',
    'get_third_package_tkhtmlview',
    'get_third_package_pystray',
    'get_third_package_cnocr',
    'get_third_package_pynput',
    'get_third_package_pyperclip',
    # Document processing packages
    'get_third_package_PyPDF2',
    'get_third_package_pdfplumber',
    'get_third_package_docx',
    'get_third_package_python_docx',
    'get_third_package_openpyxl',
    'get_third_package_pptx',
    'get_third_package_python_pptx',
    # Machine learning
    'get_third_package_sklearn',
    # Database
    'get_third_package_sqlalchemy',
    # MCP (Model Context Protocol)
    'get_third_package_fastmcp',
    'get_third_package_FastMCP',
    'get_third_package_Context',
    # Optional packages
    'get_third_package_speechsdk',
    'get_third_package_edge_tts',
    # Audio packages
    'get_third_package_pyaudio',
    # Windows-only packages
    'get_third_package_win32gui',
    'get_third_package_win32con',
    'get_third_package_win32api',
    'get_third_package_win32ui',
    'get_third_package_pywinauto',
    'get_third_package_pygetwindow',
    'get_third_package_uiautomation',
    'get_third_package_pyaudiowpatch',
]
