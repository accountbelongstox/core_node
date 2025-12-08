"""
Project Root Locator
Auto-detect project root directory based on script location
"""

from pathlib import Path


def get_project_root() -> Path:
    """
    Auto-detect React Native project root directory

    Starting from this script's location, walk up the directory tree
    to find the React Native project root (containing package.json)

    Structure:
    react_native/                    <- Project root (has package.json)
    └── scripts/
        └── build_scripts/
            └── react_native_py_scripts/
                └── [this script]

    Returns:
        Path: Absolute path to project root
    """
    # Start from this script's directory
    current = Path(__file__).parent.resolve()

    # Walk up to find project root (has package.json)
    for _ in range(10):  # Max 10 levels up
        package_json = current / "package.json"
        if package_json.exists():
            return current

        # Go up one level
        parent = current.parent
        if parent == current:  # Reached filesystem root
            break
        current = parent

    # Fallback: assume 3 levels up from script directory
    # react_native_py_scripts -> build_scripts -> scripts -> react_native
    fallback = Path(__file__).parent.parent.parent.parent.resolve()
    return fallback


def get_script_dir() -> Path:
    """Get the directory containing Python scripts"""
    return Path(__file__).parent.resolve()
