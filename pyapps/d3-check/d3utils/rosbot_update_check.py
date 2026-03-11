# -*- coding: utf-8 -*-
"""
ROSBOT update check: backward-compatible function API.

This module keeps the legacy function API; implementation delegates to RosbotUpdateManager.
New code should use d3utils.rosbot_update_manager.get_rosbot_update_manager().
"""
from typing import List, Optional, Tuple, Any

from d3utils.rosbot_update_manager import get_rosbot_update_manager, ROSBOT_FINAL_DIR_NAME

# Re-export constants from rosbot_update_manager
__all__ = [
    "get_battlenet_region",
    "get_downloads_dir",
    "get_current_ros_dir_ctime_version",
    "find_rosbot_zips_in_downloads",
    "get_best_newer_zip",
    "apply_rosbot_update",
    "run_rosbot_update_check",
    "ask_yes_no_on_main_thread",
    "ROSBOT_FINAL_DIR_NAME",
]

# Update manager singleton (lazy)
_update_manager = None


def _get_update_manager():
    """Get update manager instance (lazy load)."""
    global _update_manager
    if _update_manager is None:
        _update_manager = get_rosbot_update_manager()
    return _update_manager


def get_battlenet_region() -> Optional[str]:
    """Battle.net detected region: asia | cn | None. None skips update check."""
    return _get_update_manager().get_battlenet_region()


def get_downloads_dir() -> str:
    """Downloads directory: from config or ~/Downloads."""
    return _get_update_manager().get_downloads_dir()


def get_current_ros_dir_ctime_version() -> Tuple[Optional[str], float, Optional[Tuple[int, int]]]:
    """Current ROS dir, dir ctime, version from path if any."""
    return _get_update_manager().get_current_ros_dir_info()


def find_rosbot_zips_in_downloads(region: str) -> List[Tuple[str, int, Optional[Tuple[int, int]]]]:
    """Zips in Downloads 20-50MB matching region. Returns [(path, size, version), ...] by version desc."""
    return _get_update_manager().find_rosbot_zips_in_downloads(region)


def get_best_newer_zip(region: str) -> Tuple[Optional[str], bool, Optional[str]]:
    """Best zip newer than current for region. Returns (zip_path or None, is_newer, version_str). is_newer=False if no region or no update."""
    return _get_update_manager().get_best_newer_zip(region)


def apply_rosbot_update(zip_path: str, region: str, version_str: Optional[str] = None) -> bool:
    """Create GameTools/{Region}_{Version}, extract zip, find RoS-BoT.exe and move to GameTools\\{Region}_{Version}\\RosBot\\, copy RoS-BoT.ini and update CONFIG."""
    return _get_update_manager().apply_update(zip_path, region, version_str)


def run_rosbot_update_check() -> Tuple[Optional[str], bool, Optional[str], Optional[str]]:
    """Run update check only when Battle.net region is asia/cn. Returns (best_zip or None, is_newer, version_str or None, region or None)."""
    return _get_update_manager().check_update()


def ask_yes_no_on_main_thread(panel: Any, title: str, message: str) -> bool:
    """Show Yes/No dialog on main thread, block until user choice. Returns True=Yes."""
    return _get_update_manager().ask_yes_no_on_main_thread(panel, title, message)
