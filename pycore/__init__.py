# -*- coding: utf-8 -*-
# Documentation: ../py_auto/DEVELOPMENT_GUIDE.md
"""
Main package file for pytools.
Contains the dependency management logic.
"""

import os
import sys
import subprocess
import importlib.util
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

    # For WebView GUI (pyutils.web, pyutils.native_ui)
    "webview": "pywebview",
    "tkinterweb": "tkinterweb",
    "tkhtmlview": "tkhtmlview",

    # For logging
    "loguru": "loguru",

    # For YAML configuration
    "yaml": "pyyaml",
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
    import platform
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
            ColorPrint.blue("[INFO] GPU manager not available, skipping GPU setup")
        except Exception as e:
            # Non-critical error, continue
            ColorPrint.yellow(f"[WARNING] GPU setup failed: {e}")

    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))

    # Record dependency check results to THREAD_BUS via NativeUIBusManager
    # Use delayed import to avoid circular dependency
    try:
        from pycore.pyutils.native_ui.thread_bus_manager import get_bus_manager
        bus_mgr = get_bus_manager()
        bus_mgr.record_dependency_check(
            all_packages=sorted(list(all_dependencies.values())),
            installed=sorted(installed_packages_list),
            missing=sorted(missing_packages),
            platform=current_platform
        )
    except ImportError:
        # NativeUIBusManager not available (minimal installation)
        # Silently skip THREAD_BUS recording
        pass

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


# ============================================================================
# Convenient Top-Level Exports
# ============================================================================

# Foundation components
from pycore.pyfoundations import (
    ColorPrint,
    ENCYCLOPEDIA,
    EventBus,
    EventTypes,
    Event,
)

# Global variable manager (now in pygvar)
from pycore.pygvar import GlobalVarManager

# Thread communication bus
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Device structures and ADB utilities (unified in pyutils.device)
from pycore.pyutils.device import (
    AndroidDevice,
    ScrcpyDevice,
    DeviceInfo,
    ServerParams,
    VideoCodec,
    ADBManager,
    ADBDevice,
)

# Utility components
from pycore.pyutils import (
    DeviceManager,
    DeviceState,
    TouchEvent,
    KeyEvent,
    MessageBuilder,
    GroupController,
    AllSyncStrategy,
    TouchOnlySyncStrategy,
    H264Decoder,
    FMP4Encoder,
    VideoFrame,
    VideoFormat,
    VideoStreamHandler,
    H264Config,
)

# Optional imports
try:
    from pycore.pyutils import FMP4EncoderComplete, H264Frame
except ImportError:
    pass

try:
    from pycore.pyutils import WebSocketManager
except ImportError:
    pass

__version__ = '1.0.0'

__all__ = [
    # Dependency management
    'check_and_install_dependencies',
    'get_gpu_info',
    'DEPENDENCY_MAP',

    # Foundation
    'ColorPrint',
    'ENCYCLOPEDIA',
    'EventBus',
    'EventTypes',
    'Event',
    'GlobalVarManager',

    # Device structures
    'AndroidDevice',
    'ScrcpyDevice',
    'DeviceInfo',
    'ServerParams',
    'VideoCodec',

    # Device management
    'DeviceManager',
    'DeviceState',

    # ADB
    'ADBManager',
    'ADBDevice',

    # Control
    'TouchEvent',
    'KeyEvent',
    'MessageBuilder',

    # Group control
    'GroupController',
    'AllSyncStrategy',
    'TouchOnlySyncStrategy',

    # Streaming
    'H264Decoder',
    'FMP4Encoder',
    'VideoFrame',
    'VideoFormat',
    'VideoStreamHandler',
    'H264Config',
]
