#!/usr/bin/env python3
"""
Third-Party Package Unified Import Manager for Flutter Bloom Build Scripts

This module provides a unified interface for importing third-party packages
with automatic dependency checking and installation.

All third-party packages MUST be imported through this module.

Usage:
    from third_party import Image, ImageOps, yaml

The module automatically checks and installs missing packages on first import.
"""

import os
import sys
import subprocess
import importlib
import importlib.util
import platform

# Global cache to ensure dependencies are only checked once
_dependencies_checked = False
_dependencies_checking = False

# Package cache for lazy loading
_PACKAGE_CACHE = {}


# Dependency Map
# Maps import name to PyPI package name
DEPENDENCY_MAP = {
    # Image processing
    "PIL": "Pillow",

    # YAML configuration
    "yaml": "pyyaml",

    # Web framework (for source viewer server)
    "flask": "flask",

    # Process management (for view effects controller)
    "psutil": "psutil",

    # Optional: for advanced image processing (not currently used)
    "cv2": "opencv-python",
    "numpy": "numpy",
}


def _print_info(msg):
    """Print info message"""
    print(f"[INFO] {msg}")


def _print_success(msg):
    """Print success message"""
    print(f"[SUCCESS] {msg}")


def _print_warning(msg):
    """Print warning message"""
    print(f"[WARNING] {msg}")


def _print_error(msg):
    """Print error message"""
    print(f"[ERROR] {msg}")


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

    # On Linux/Mac, use --break-system-packages for reliable installation
    # On Windows, use normal pip install
    if current_platform != 'Windows':
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")

    pip_cmd.append(package_name)
    return pip_cmd


def run_pip_install(pip_cmd: list, package_name: str) -> bool:
    """
    Run pip install command with output capture.

    Args:
        pip_cmd: List of command arguments
        package_name: Name of package being installed (for display)

    Returns:
        True if installation succeeded, False otherwise
    """
    try:
        result = subprocess.run(
            pip_cmd,
            capture_output=True,
            text=True,
            check=False
        )

        # Check output for success indicators
        output = result.stdout.lower() + result.stderr.lower()
        if "successfully installed" in output or "already satisfied" in output or result.returncode == 0:
            return True
        else:
            _print_error(f"Installation failed for {package_name}")
            _print_error(f"Output: {output}")
            return False
    except Exception as e:
        _print_error(f"Exception during installation: {e}")
        return False


def check_and_install_dependencies():
    """
    Checks if all required packages are installed and installs them if not.

    Uses global flag to ensure only the first call does actual checking.
    """
    global _dependencies_checked, _dependencies_checking

    # Check if dependencies have already been checked
    if _dependencies_checked:
        return

    # Prevent recursive invocation
    if _dependencies_checking:
        return

    # Mark as checking to prevent recursion
    _dependencies_checking = True

    _print_info("Checking for required Python packages...")

    installed_packages = set()
    missing_packages = set()

    # Check each package
    for import_name, package_name in DEPENDENCY_MAP.items():
        try:
            module_spec = importlib.util.find_spec(import_name)
            is_installed = module_spec is not None
        except Exception:
            is_installed = False

        if not is_installed:
            missing_packages.add(package_name)
            _print_warning(f"Package for '{import_name}' ('{package_name}') not found. Installing...")

            # Build pip install command
            pip_cmd = build_pip_install_command(package_name)

            # Run installation
            if run_pip_install(pip_cmd, package_name):
                # Verify installation
                importlib.invalidate_caches()
                try:
                    module_spec = importlib.util.find_spec(import_name)
                    if module_spec is None:
                        _print_warning(f"Package {package_name} installed but import '{import_name}' still not available")
                    else:
                        _print_success(f"Successfully installed {package_name}")
                        installed_packages.add(package_name)
                except Exception as e:
                    _print_warning(f"Error verifying '{import_name}' after installation: {e}")
            else:
                _print_error(f"Failed to install {package_name}")
        else:
            installed_packages.add(package_name)

    if installed_packages:
        _print_info(f"Available packages: {', '.join(sorted(installed_packages))}")
    _print_success("Package check complete.")

    # Mark as checked
    _dependencies_checked = True
    _dependencies_checking = False


def _lazy_import(package_name: str, import_statement: str):
    """
    Lazy import helper with caching and auto-install

    Args:
        package_name: Cache key for the package
        import_statement: Python import statement to execute

    Returns:
        The imported module/package
    """
    if package_name not in _PACKAGE_CACHE:
        local_vars = {}
        try:
            # Execute import statement and cache result
            exec(import_statement, globals(), local_vars)
            _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
        except (ImportError, ModuleNotFoundError) as e:
            # Package not installed, try to install it
            pip_package = DEPENDENCY_MAP.get(package_name)

            if pip_package:
                _print_warning(f"Package '{package_name}' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                if run_pip_install(pip_cmd, pip_package):
                    # Clear import caches and retry
                    importlib.invalidate_caches()
                    try:
                        exec(import_statement, globals(), local_vars)
                        _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
                        _print_success(f"Successfully installed and imported '{package_name}'")
                    except (ImportError, ModuleNotFoundError) as retry_e:
                        _print_error(f"Package installed but import still failed: {retry_e}")
                        raise retry_e
                else:
                    _print_error(f"Failed to install package '{pip_package}'")
                    raise e
            else:
                # Package not in dependency map, re-raise original error
                raise e
    return _PACKAGE_CACHE[package_name]


# ============================================================================
# Lazy Loading Getter Functions
# ============================================================================

def get_third_package_PIL():
    """Get PIL package (lazy load)"""
    return _lazy_import('PIL', 'import PIL')


def get_third_package_PIL_Image():
    """Get PIL.Image (lazy load)"""
    if 'PIL_Image' not in _PACKAGE_CACHE:
        from PIL import Image as PIL_Image
        _PACKAGE_CACHE['PIL_Image'] = PIL_Image
    return _PACKAGE_CACHE['PIL_Image']


def get_third_package_PIL_ImageOps():
    """Get PIL.ImageOps (lazy load)"""
    if 'PIL_ImageOps' not in _PACKAGE_CACHE:
        from PIL import ImageOps as PIL_ImageOps
        _PACKAGE_CACHE['PIL_ImageOps'] = PIL_ImageOps
    return _PACKAGE_CACHE['PIL_ImageOps']


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


def get_third_package_yaml():
    """Get yaml package (lazy load)"""
    return _lazy_import('yaml', 'import yaml')


def get_third_package_cv2():
    """Get cv2 package (lazy load) - Optional"""
    return _lazy_import('cv2', 'import cv2')


def get_third_package_numpy():
    """Get numpy package (lazy load) - Optional"""
    return _lazy_import('numpy', 'import numpy')


def get_third_package_flask():
    """Get flask package (lazy load)"""
    return _lazy_import('flask', 'import flask')


def get_third_package_Flask():
    """Get Flask class (lazy load)"""
    if 'Flask' not in _PACKAGE_CACHE:
        from flask import Flask
        _PACKAGE_CACHE['Flask'] = Flask
    return _PACKAGE_CACHE['Flask']


def get_third_package_flask_render_template_string():
    """Get flask render_template_string (lazy load)"""
    if 'render_template_string' not in _PACKAGE_CACHE:
        from flask import render_template_string
        _PACKAGE_CACHE['render_template_string'] = render_template_string
    return _PACKAGE_CACHE['render_template_string']


def get_third_package_flask_jsonify():
    """Get flask jsonify (lazy load)"""
    if 'jsonify' not in _PACKAGE_CACHE:
        from flask import jsonify
        _PACKAGE_CACHE['jsonify'] = jsonify
    return _PACKAGE_CACHE['jsonify']


def get_third_package_flask_request():
    """Get flask request (lazy load)"""
    if 'request' not in _PACKAGE_CACHE:
        from flask import request
        _PACKAGE_CACHE['request'] = request
    return _PACKAGE_CACHE['request']


def get_third_package_flask_send_file():
    """Get flask send_file (lazy load)"""
    if 'send_file' not in _PACKAGE_CACHE:
        from flask import send_file
        _PACKAGE_CACHE['send_file'] = send_file
    return _PACKAGE_CACHE['send_file']


def get_third_package_flask_Response():
    """Get flask Response (lazy load)"""
    if 'Response' not in _PACKAGE_CACHE:
        from flask import Response
        _PACKAGE_CACHE['Response'] = Response
    return _PACKAGE_CACHE['Response']


def get_third_package_psutil():
    """Get psutil package (lazy load)"""
    return _lazy_import('psutil', 'import psutil')


# Auto-check dependencies when module is imported (before module replacement)
# Can be disabled by setting BUILD_SCRIPTS_SKIP_DEP_CHECK environment variable
if os.environ.get('BUILD_SCRIPTS_SKIP_DEP_CHECK') != '1':
    try:
        check_and_install_dependencies()
    except Exception as e:
        _print_error(f"Failed to check dependencies during import: {e}")
        _print_warning("Attempting to continue, but some packages may be missing")
        # Ensure checking flag is cleared even on error
        _dependencies_checking = False
else:
    _print_info("Dependency check skipped (BUILD_SCRIPTS_SKIP_DEP_CHECK=1)")
    _dependencies_checked = True


# ============================================================================
# Module-level attribute access (lazy-loaded on first access)
# ============================================================================
# Provides direct access: from third_party import Image, ImageOps, yaml
# ============================================================================

class _ThirdPartyModule:
    """Lazy-loading module wrapper for third-party packages"""

    # Store original module attributes
    _original_attrs = {
        'DEPENDENCY_MAP': DEPENDENCY_MAP,
        'check_and_install_dependencies': check_and_install_dependencies,
        'get_third_package_PIL': get_third_package_PIL,
        'get_third_package_PIL_Image': get_third_package_PIL_Image,
        'get_third_package_PIL_ImageOps': get_third_package_PIL_ImageOps,
        'get_third_package_PIL_ImageDraw': get_third_package_PIL_ImageDraw,
        'get_third_package_PIL_ImageFont': get_third_package_PIL_ImageFont,
        'get_third_package_yaml': get_third_package_yaml,
        'get_third_package_flask': get_third_package_flask,
        'get_third_package_Flask': get_third_package_Flask,
        'get_third_package_flask_render_template_string': get_third_package_flask_render_template_string,
        'get_third_package_flask_jsonify': get_third_package_flask_jsonify,
        'get_third_package_flask_request': get_third_package_flask_request,
        'get_third_package_flask_send_file': get_third_package_flask_send_file,
        'get_third_package_flask_Response': get_third_package_flask_Response,
        'get_third_package_psutil': get_third_package_psutil,
        'get_third_package_cv2': get_third_package_cv2,
        'get_third_package_numpy': get_third_package_numpy,
        '__name__': __name__,
        '__file__': __file__,
        '__doc__': __doc__,
        '__package__': __package__,
    }

    def __getattr__(self, name):
        # Check original attributes first
        if name in self._original_attrs:
            return self._original_attrs[name]

        # PIL package and submodules
        if name == 'PIL':
            return get_third_package_PIL()
        elif name == 'Image':
            return get_third_package_PIL_Image()
        elif name == 'ImageOps':
            return get_third_package_PIL_ImageOps()
        elif name == 'ImageDraw':
            return get_third_package_PIL_ImageDraw()
        elif name == 'ImageFont':
            return get_third_package_PIL_ImageFont()

        # YAML
        elif name == 'yaml':
            return get_third_package_yaml()

        # Flask web framework
        elif name == 'flask':
            return get_third_package_flask()
        elif name == 'Flask':
            return get_third_package_Flask()
        elif name == 'render_template_string':
            return get_third_package_flask_render_template_string()
        elif name == 'jsonify':
            return get_third_package_flask_jsonify()
        elif name == 'request':
            return get_third_package_flask_request()
        elif name == 'send_file':
            return get_third_package_flask_send_file()
        elif name == 'Response':
            return get_third_package_flask_Response()

        # Process management
        elif name == 'psutil':
            return get_third_package_psutil()

        # Optional packages
        elif name == 'cv2':
            return get_third_package_cv2()
        elif name == 'numpy':
            return get_third_package_numpy()

        raise AttributeError(f"module 'third_party' has no attribute '{name}'")

    def __dir__(self):
        """Return list of available attributes"""
        return list(self._original_attrs.keys()) + [
            'PIL', 'Image', 'ImageOps', 'ImageDraw', 'ImageFont',
            'yaml',
            'flask', 'Flask', 'render_template_string', 'jsonify', 'request', 'send_file', 'Response',
            'psutil',
            'cv2', 'numpy'
        ]


# Replace module with lazy-loading wrapper
sys.modules[__name__] = _ThirdPartyModule()
