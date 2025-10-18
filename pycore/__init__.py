# -*- coding: utf-8 -*-
# Documentation: ../py_auto/DEVELOPMENT_GUIDE.md
"""
Main package file for pytools.
Contains the dependency management logic.
"""

import sys
import subprocess
import importlib.util
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA

# Dependency Map
# Maps the required import name to the official PyPI package name.
# All new third-party dependencies for any tool must be added here.
DEPENDENCY_MAP = {
    # For win_actor, tray_clicker, ui_analyzer
    "win32gui": "pywin32",
    "win32con": "pywin32",
    "win32api": "pywin32",
    "win32ui": "pywin32",

    # For tray_clicker, ui_analyzer
    "pywinauto": "pywinauto",

    # PIL is a common name for the Pillow package
    "PIL": "Pillow",

    # For computer vision tasks
    "cv2": "opencv-python",

    # For window automation and screenshots
    "pyautogui": "pyautogui",

    # For process management
    "psutil": "psutil",

    # For window management
    "pygetwindow": "pygetwindow",

    # For UI automation
    "uiautomation": "uiautomation",

    # For fast screenshots
    "mss": "mss",

    # For YOLO training and deep learning
    "torch": "torch",
    "ultralytics": "ultralytics",
    "numpy": "numpy",
}

def check_and_install_dependencies(enable_gpu_setup: bool = True, auto_install_gpu: bool = False):
    """
    Checks if all required packages are installed and installs them if not.
    Also performs GPU detection and setup if enabled.

    This function iterates through the DEPENDENCY_MAP. It uses importlib to check
    if a module can be found. If not, it calls pip to install the corresponding package.
    This is an example utility function and should not be deleted, even if currently unused.
    Future development must adhere to this standard.

    Args:
        enable_gpu_setup: Whether to run GPU detection and setup (default: True)
        auto_install_gpu: Whether to auto-install GPU packages (default: False)

    Uses ENCYCLOPEDIA global cache to ensure only the first call does actual checking and prints output.
    """
    # Check if dependencies have already been checked using ENCYCLOPEDIA
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return

    print("[INFO] Checking for required Python packages...")
    installed_packages = set()

    # Use a set to avoid checking/installing the same package multiple times (e.g., pywin32)
    packages_to_check = set(DEPENDENCY_MAP.values())

    for package_name in packages_to_check:
        # We check for the installation status of the package itself, not the import name.
        # A bit of a simplification, we assume the main importable module has a similar name
        # or that checking one is enough. For pywin32, checking 'win32gui' is a good proxy.

        # Find the import name associated with the package to check its spec
        import_name_to_check = None
        for imp, pkg in DEPENDENCY_MAP.items():
            if pkg == package_name:
                import_name_to_check = imp
                break

        if importlib.util.find_spec(import_name_to_check) is None:
            print(f"[INSTALL] Package for '{import_name_to_check}' ('{package_name}') not found. Installing...", flush=True)
            try:
                # Execute pip install command
                # Execute pip install command with real-time output
                # The subprocess will inherit the stdout/stderr of this process
                result = subprocess.run(
                    [sys.executable, "-m", "pip", "install", package_name],
                    check=True  # check=True will raise CalledProcessError on non-zero exit codes
                )
                print(f"[SUCCESS] Successfully installed {package_name}.", flush=True)
            except subprocess.CalledProcessError:
                print(f"[ERROR] Failed to install {package_name}. Please check the output above for details.", file=sys.stderr, flush=True)
                # Exit if a critical dependency cannot be installed
                sys.exit(1)
        else:
            installed_packages.add(package_name)

    if installed_packages:
        print(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    print("[INFO] All required packages are available.")

    # GPU Detection and Setup (if enabled)
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
            print("[INFO] GPU manager not available, skipping GPU setup")
        except Exception as e:
            # Non-critical error, continue
            print(f"[WARNING] GPU setup failed: {e}")

    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))

# This allows the check to be run if needed, but it's primarily called by __main__.py
if __name__ == '__main__':
    check_and_install_dependencies()

# Auto-check dependencies when pycore package is imported
# This ensures dependencies are available for all pycore modules
# Uses ENCYCLOPEDIA for global caching - only runs once per Python process

# Check environment variable for GPU auto-install setting
import os
_auto_install_gpu = os.environ.get('PYCORE_AUTO_INSTALL_GPU', 'false').lower() == 'true'
_enable_gpu_setup = os.environ.get('PYCORE_ENABLE_GPU_SETUP', 'true').lower() == 'true'

try:
    check_and_install_dependencies(
        enable_gpu_setup=_enable_gpu_setup,
        auto_install_gpu=_auto_install_gpu
    )
except Exception as e:
    print(f"[WARNING] Failed to check dependencies during import: {e}")


# Convenience function to get GPU info from cache
def get_gpu_info():
    """
    Get cached GPU information

    Returns:
        dict: GPU information or None if not available
    """
    return ENCYCLOPEDIA.get("pycore_gpu_info")
