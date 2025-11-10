# Platform-Specific Package Import Guidelines

## Overview

This document explains how to handle platform-specific packages (especially Windows-only packages) in the pycore codebase.

## Package Classification

### Cross-Platform Packages
Defined in `pycore/__init__.py::DEPENDENCY_MAP`:
- PIL, cv2, numpy, av, fastapi, requests, etc.
- These packages work on Windows, Linux, and macOS

### Windows-Only Packages
Defined in `pycore/__init__.py::WINDOWS_ONLY_PACKAGES`:
- `win32gui`, `win32con`, `win32api`, `win32ui` (pywin32)
- `pywinauto` - Windows UI automation
- `pygetwindow` - Windows window management
- `uiautomation` - Windows UI inspection

## Important Rules

### ⚠️ DO NOT MODIFY
**The platform detection logic in `pycore/__init__.py` is automatically managed.**

```python
# IMPORTANT: DO NOT MODIFY - Windows packages are automatically skipped on Linux/Mac
import platform
current_platform = platform.system()

all_dependencies = dict(DEPENDENCY_MAP)
if current_platform == 'Windows':
    all_dependencies.update(WINDOWS_ONLY_PACKAGES)
else:
    print(f"[INFO] Skipping Windows-only packages on {current_platform}")
```

### How to Use Windows-Only Packages

When importing Windows-only packages in your code, always wrap them with platform checks:

```python
import platform

# Method 1: Try-except (recommended for optional features)
try:
    import win32gui
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

def windows_specific_function():
    if not HAS_WIN32:
        raise NotImplementedError("This function requires Windows")
    # Use win32gui, win32con here


# Method 2: Platform check (recommended for mandatory features)
if platform.system() == 'Windows':
    import win32gui
    import win32con
else:
    # Provide alternative implementation or raise error
    def win32gui_placeholder():
        raise NotImplementedError("This feature is Windows-only")
```

## Files Using Windows-Only Packages

The following files contain Windows-specific imports and should maintain platform checks:

- `pycore/pyutils/app_launcher.py`
- `pycore/pyutils/click_handler.py`
- `pycore/pyutils/common/window_finder.py`
- `pycore/pyutils/desktop_icon_generator.py`
- `pycore/pyutils/integrated_window_analyzer.py`
- `pycore/pyutils/process_manager.py`
- `pycore/pyutils/tray_clicker.py`
- `pycore/pyutils/ui_analyzer.py`
- `pycore/pyutils/window_activator.py`
- `pycore/pyutils/window_analyzer.py`

## Auto-Installation Behavior

When `pycore` is imported:
1. `check_and_install_dependencies()` runs automatically
2. On Windows: Installs both cross-platform and Windows-only packages
3. On Linux/Mac: Only installs cross-platform packages, skips Windows-only packages
4. Installation uses pip and respects virtual environments

## Adding New Platform-Specific Packages

### For Windows-Only Packages:
Add to `WINDOWS_ONLY_PACKAGES` in `pycore/__init__.py`:

```python
WINDOWS_ONLY_PACKAGES = {
    "your_import_name": "pypi-package-name",
}
```

### For Cross-Platform Packages:
Add to `DEPENDENCY_MAP` in `pycore/__init__.py`:

```python
DEPENDENCY_MAP = {
    "your_import_name": "pypi-package-name",
}
```

## Testing

### On Windows:
```bash
python -c "import pycore; print('Windows packages:', pycore.WINDOWS_ONLY_PACKAGES)"
```

### On Linux/Mac:
```bash
python3 -c "import pycore; print('Skipped Windows packages successfully')"
```

## Troubleshooting

### "externally-managed-environment" Error on Linux
This error occurs when trying to install packages system-wide on modern Linux distributions.

**Solution**: The auto-installer should use `--user` flag or virtual environments. This is handled automatically in `check_and_install_dependencies()`.

### "Package not found" on Linux for Windows-only package
This is expected behavior. Windows-only packages are automatically skipped on non-Windows platforms.

## Maintenance

- ✅ **DO**: Add platform checks when using Windows-only packages
- ✅ **DO**: Test your code on both Windows and Linux if possible
- ❌ **DON'T**: Remove the platform detection logic in `__init__.py`
- ❌ **DON'T**: Import Windows packages at module level without checks
- ❌ **DON'T**: Assume all packages are available on all platforms
