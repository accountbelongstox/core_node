#!/usr/bin/env python3
"""
Resource Directory Collector
Shared resource directory collection for all platform scanners (Android, iOS, Windows, macOS, Web)

Collection State Management:
- Collects resource directories once per build session
- Subsequent calls return cached results
- Thread-safe collection state tracking
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple
from shared.standard_image_data import (
    BUILD_APPS_STATIC_RESOURCES_ROOT, ImageResourceManager,
    FlutterStaticResourceProvider, flutter_static_provider
)
from utils.print_helper import PrintHelper

def get_potential_resource_dirs(temp_build_root, app_name):
    """
    Get potential resource directories configuration for all platform scanners.
    Returns list of (directory_path, directory_type) tuples in priority order.

    Args:
        temp_build_root: Path to temporary build directory
        app_name: Application name

    Returns:
        List of (directory_path, directory_type) tuples in priority order:
        - EXTERNAL: Extension directory (highest priority)
        - BUILTIN: Built-in app directory (medium priority)
        - COMMON: Common directory (lowest priority)
    """
    return [
        (Path(BUILD_APPS_STATIC_RESOURCES_ROOT) / app_name, "EXTERNAL"),  # Extension directory (highest priority)
        (temp_build_root / "assets" / "apps" / app_name, "BUILTIN"),      # Built-in app directory (medium priority)
        (temp_build_root / "assets" / "apps" / "app_main", "COMMON")      # Common directory (lowest priority)
    ]

class ResourceDirectoryCollector:
    """Shared resource directory collector for all platform scanners"""

    # Class-level collection state
    _collected = False
    _resource_directories = []
    _last_collection_params = None

    @classmethod
    def collect_resource_directories(cls, temp_build_root: Path, app_name: str, force_recollect: bool = False) -> List[Path]:
        """
        Collect all resource directories in priority order for all platform scanners.

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Application name
            force_recollect: Force re-collection even if already collected

        Returns:
            List of existing resource directory paths in priority order
        """
        current_params = (str(temp_build_root), app_name)

        # Check if already collected with same parameters
        if (cls._collected and
            cls._last_collection_params == current_params and
            not force_recollect):
            PrintHelper.info("Resource directories already collected, using cached results")
            return cls._resource_directories.copy()

        PrintHelper.header("COLLECTING RESOURCE DIRECTORIES FOR ALL PLATFORM SCANNERS")

        # Clear previous state
        cls._resource_directories = []
        flutter_static_provider.clear_all()

        # Get potential directories configuration
        potential_dirs = get_potential_resource_dirs(temp_build_root, app_name)

        # Collect existing directories
        for i, (directory, dir_type) in enumerate(potential_dirs):
            if directory.exists() and directory.is_dir():
                cls._resource_directories.append(directory)

                # Register with Flutter static provider based on type
                if dir_type == "EXTERNAL":
                    flutter_static_provider.add_extension_directory(str(directory), priority=i)
                    PrintHelper.success(f"[{i+1}] External static resource directory (Extension): {directory}")
                elif dir_type == "BUILTIN":
                    flutter_static_provider.add_app_builtin_directory(str(directory), app_name, priority=i)
                    PrintHelper.success(f"[{i+1}] Built-in app directory: {directory}")
                elif dir_type == "COMMON":
                    flutter_static_provider.add_common_resource_directory(str(directory), priority=i)
                    PrintHelper.success(f"[{i+1}] Common directory (app_main): {directory}")
            else:
                if dir_type == "EXTERNAL":
                    PrintHelper.warning(f"[{i+1}] External static resource directory not found (Extension): {directory}")
                elif dir_type == "BUILTIN":
                    PrintHelper.warning(f"[{i+1}] Built-in app directory not found: {directory}")
                elif dir_type == "COMMON":
                    PrintHelper.warning(f"[{i+1}] Common directory (app_main) not found: {directory}")

        # Print directory status summary
        cls._print_directory_status_summary(temp_build_root, app_name)

        # Update collection state
        cls._collected = True
        cls._last_collection_params = current_params

        PrintHelper.success(f"Resource collection completed. Found {len(cls._resource_directories)} directories.")
        return cls._resource_directories.copy()

    @classmethod
    def _print_directory_status_summary(cls, temp_build_root: Path, app_name: str):
        """Print comprehensive directory status summary for all platform scanners"""
        PrintHelper.header("RESOURCE DIRECTORIES STATUS (ALL PLATFORMS)")

        # Get potential directories configuration
        potential_dirs = get_potential_resource_dirs(temp_build_root, app_name)

        for i, (directory, dir_type) in enumerate(potential_dirs, 1):
            exists_status = "EXISTS" if directory.exists() and directory.is_dir() else "MISSING"
            print(f"  {i}. [{dir_type}] {directory} - {exists_status}")

            # Show subdirectory status for existing directories
            if directory.exists() and directory.is_dir():
                icons_dir = directory / ImageResourceManager.ICON_SEARCH_SUBDIR
                launch_dir = directory / ImageResourceManager.BACKGROUND_SEARCH_SUBDIR
                icons_status = "YES" if icons_dir.exists() else "NO"
                launch_status = "YES" if launch_dir.exists() else "NO"
                print(f"      +-- icons/ {icons_status}  launch/ {launch_status}")

        print()

    @classmethod
    def get_collected_directories(cls) -> List[Path]:
        """Get previously collected directories (empty list if not collected yet)"""
        return cls._resource_directories.copy()

    @classmethod
    def is_collected(cls) -> bool:
        """Check if directories have been collected"""
        return cls._collected

    @classmethod
    def reset_collection_state(cls):
        """Reset collection state (useful for testing or manual reset)"""
        cls._collected = False
        cls._resource_directories = []
        cls._last_collection_params = None
        flutter_static_provider.clear_all()
        PrintHelper.info("Resource collection state reset")

# Global collector instance for easy access
resource_collector = ResourceDirectoryCollector()