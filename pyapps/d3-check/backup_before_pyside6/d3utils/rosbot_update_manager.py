# -*- coding: utf-8 -*-
"""
ROSBOT Update Manager - Library Abstraction

Design doc: docs/ROSBOT_UPDATE_FLOW.md

1. How to find download package (zip)
  - Location: Downloads directory (CONFIG paths.downloads_dir or ~/Downloads)
  - Conditions: Extension .zip, size 20-50MB (ROSBOT_ZIP_MIN/MAX_SIZE_MB), filename matches region
  - Region matching: Asia -> ROSBOT_ZIP_KEYWORDS_ASIA; CN -> ROSBOT_ZIP_KEYWORDS_CN (constants)
  - Version: Parse two-segment numbers from filename (e.g., 36.0129), sort by version descending, take newer than current
  - Prerequisite: Only execute when game_interface_data.get_battlenet_region() is asia or cn

2. How to extract
  - Region: asia = Asia_*, cn = CN_*. Version is per-region; directory = {Asia|CN}_{version}.
  - Create directory under GameTools: {region}_{version} (Asia_36.0129 or CN_36.0129, see ROSBOT_DIR_NAMESPACE_*)
  - Extract zip to that directory (zipfile.ZipFile.extractall(extract_to))
  - Recursively find RoS-BoT.exe or ros-bot*.exe (ROSBOT_EXE_PATTERNS), only care about exe directory

3. How to adjust directory structure after extraction
  - Rename and move exe directory to: GameTools\\{region}_version\\RosBot\\
  - Fixed subdirectory name: ROSBOT_FINAL_DIR_NAME = "RosBot"
  - If target RosBot exists, use shutil.rmtree then shutil.move(exe_dir, final_dir)
  - Copy old directory's RoS-BoT.ini to new directory (if exists)
  - Update CONFIG ros_settings.ros_directory to new directory, clear rosbot_manager singleton cache
"""
import os
import re
import zipfile
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Any, Dict

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, set_config_value_safe, get_config_value_safe
from providor.constants.d3 import (
    ROSBOT_GAMETOOLS_BASE,
    ROSBOT_ZIP_MIN_SIZE_MB,
    ROSBOT_ZIP_MAX_SIZE_MB,
    ROSBOT_EXE_PATTERNS,
    ROSBOT_ZIP_KEYWORDS_ASIA,
    ROSBOT_ZIP_KEYWORDS_CN,
    ROSBOT_DIR_NAMESPACE_ASIA,
    ROSBOT_DIR_NAMESPACE_CN,
)
from d3utils.rosbot_manager import get_rosbot_manager
import d3utils.rosbot_manager as rosbot_manager_module
from share.game_interface_data import get_game_interface_data

# Version: two-segment numbers like 36.0129 -> (36, 129). Directory = Asia_version or CN_version (version always bound to that region).
_VERSION_RE = re.compile(r"(\d{1,4})\.?(\d{2,5})")
_MIN_ZIP_BYTES = ROSBOT_ZIP_MIN_SIZE_MB * 1024 * 1024
_MAX_ZIP_BYTES = ROSBOT_ZIP_MAX_SIZE_MB * 1024 * 1024
ROSBOT_FINAL_DIR_NAME = "RosBot"  # Renamed directory name
# Temporary directory base: D:\applications\GameTools\.tmp\tmp_xxx (unique per run)
ROSBOT_TEMP_BASE_DIR = os.path.join(ROSBOT_GAMETOOLS_BASE, ".tmp")


class RosbotUpdateManager:
    """
    ROSBOT Update Manager Library
    
    Responsibilities:
    - Check for updates (only when Battle.net region is detected)
    - Find update packages in downloads directory
    - Compare version numbers
    - Apply updates (extract, move, update config)
    - Manage update confirmation dialogs
    """

    def __init__(self):
        """Initialize update manager"""
        self._rosbot_manager = None

    def _get_rosbot_manager(self):
        """Get ROSBOT manager instance (lazy load)"""
        if self._rosbot_manager is None:
            self._rosbot_manager = get_rosbot_manager()
        return self._rosbot_manager

    def get_battlenet_region(self) -> Optional[str]:
        """
        Get detected Battle.net region: asia | cn | None
        
        Region source: get_game_interface_data().get_battlenet_region() (single source of truth).
        Returns None if not detected, update check will be skipped.
        """
        return get_game_interface_data().get_battlenet_region()

    def get_downloads_dir(self) -> str:
        """
        Get downloads directory: config or ~/Downloads
        
        Returns:
            str: Downloads directory path
        """
        path = CONFIG.get("paths", {}).get("downloads_dir", "").strip()
        if path and os.path.isdir(path):
            return path
        return os.path.join(os.path.expanduser("~"), "Downloads")

    def parse_version_from_name(self, name: str) -> Optional[Tuple[int, int]]:
        """
        Extract version two-segment numbers from filename/path, e.g., 36.0129 -> (36, 129)
        
        Args:
            name: Filename or path
            
        Returns:
            Optional[Tuple[int, int]]: Version tuple, None if cannot parse
        """
        matches = _VERSION_RE.findall(name)
        if not matches:
            return None
        a, b = matches[-1]
        return (int(a), int(b))

    def version_to_str(self, version: Tuple[int, int]) -> str:
        """
        Convert version tuple to string, e.g., (36, 129) -> '36.0129' (for directory name)
        
        Args:
            version: Version tuple
            
        Returns:
            str: Version string
        """
        return f"{version[0]}.{version[1]:04d}" if version[1] < 10000 else f"{version[0]}.{version[1]}"

    def get_current_ros_dir_info(self) -> Tuple[Optional[str], float, Optional[Tuple[int, int]]]:
        """
        Get current ROS directory info
        
        Returns:
            Tuple[Optional[str], float, Optional[Tuple[int, int]]]: 
            (ros_dir, ctime, version) - directory path, creation time, version
        """
        mgr = self._get_rosbot_manager()
        exe_path = mgr.find_rosbot_exe()
        if not exe_path:
            return (None, 0.0, None)
        ros_dir = mgr.get_ros_directory()
        if not ros_dir or not os.path.isdir(ros_dir):
            return (ros_dir, 0.0, None)
        try:
            ctime = os.path.getctime(ros_dir)
        except OSError:
            ctime = 0.0
        version = self.parse_version_from_name(ros_dir)
        return (ros_dir, ctime, version)

    def zip_matches_region(self, filename: str, region: str) -> bool:
        """
        Check if zip filename matches given region.
        Each file is assigned to at most one region: Asia if any ASIA keyword present;
        CN only when CN keyword present and no ASIA keyword (avoids one zip counting for both).
        """
        if region not in ("asia", "cn"):
            return False
        lower = filename.lower()
        matches_asia = any(k in filename or k.lower() in lower for k in ROSBOT_ZIP_KEYWORDS_ASIA)
        matches_cn = any(k in filename or k.lower() in lower for k in ROSBOT_ZIP_KEYWORDS_CN)
        if region == "asia":
            return matches_asia
        # cn: only when matches CN and not Asia (Asia priority; names matching both regions count as Asia only)
        return matches_cn and not matches_asia

    def find_rosbot_zips_in_downloads(self, region: str) -> List[Tuple[str, int, Optional[Tuple[int, int]]]]:
        """
        Find matching ROSBOT zip files in Downloads directory
        
        Args:
            region: Region identifier (asia or cn)
            
        Returns:
            List[Tuple[str, int, Optional[Tuple[int, int]]]]: 
            [(path, size, version), ...] sorted by version descending
        """
        if region not in ("asia", "cn"):
            return []
        down = self.get_downloads_dir()
        if not os.path.isdir(down):
            return []
        out: List[Tuple[str, int, Optional[Tuple[int, int]]]] = []
        for f in os.listdir(down):
            if not f.lower().endswith(".zip"):
                continue
            if not self.zip_matches_region(f, region):
                continue
            path = os.path.join(down, f)
            try:
                if not os.path.isfile(path):
                    continue
                size = os.path.getsize(path)
                if size < _MIN_ZIP_BYTES or size > _MAX_ZIP_BYTES:
                    continue
            except OSError:
                continue
            version = self.parse_version_from_name(f)
            out.append((path, size, version))
        # Sort by version descending
        out.sort(key=lambda x: (-(x[2][0] * 10000 + x[2][1]) if x[2] else 0))
        return out

    def get_current_version_for_region(self, region: str) -> Tuple[Optional[Tuple[int, int]], float]:
        """
        Current installed version (and ctime) for this region only.
        If configured path is for this region, use it; else look for {Asia|CN}_* under GameTools.
        Returns (version_tuple or None, ctime). Used to decide if a zip is "newer" for this region.
        """
        if region not in ("asia", "cn"):
            return (None, 0.0)
        ros_dir, cur_ctime, cur_ver = self.get_current_ros_dir_info()
        if ros_dir:
            parent = os.path.basename(os.path.dirname(ros_dir))
            if region == "asia" and parent.startswith(ROSBOT_DIR_NAMESPACE_ASIA + "_"):
                return (cur_ver, cur_ctime)
            if region == "cn" and parent.startswith(ROSBOT_DIR_NAMESPACE_CN + "_"):
                return (cur_ver, cur_ctime)
        try:
            for name in os.listdir(ROSBOT_GAMETOOLS_BASE):
                if region == "asia" and not name.startswith(ROSBOT_DIR_NAMESPACE_ASIA + "_"):
                    continue
                if region == "cn" and not name.startswith(ROSBOT_DIR_NAMESPACE_CN + "_"):
                    continue
                final_dir = os.path.join(ROSBOT_GAMETOOLS_BASE, name, ROSBOT_FINAL_DIR_NAME)
                if os.path.isdir(final_dir) and self.find_rosbot_exe_recursive(final_dir):
                    ver = self.parse_version_from_name(final_dir)
                    ctime = os.path.getctime(final_dir) if os.path.exists(final_dir) else 0.0
                    return (ver, ctime)
        except OSError:
            pass
        return (None, 0.0)

    def get_best_newer_zip(self, region: str) -> Tuple[Optional[str], bool, Optional[str]]:
        """
        Find best zip newer than current **for this region**.
        Compares with installed version of this region (Asia_* or CN_*), not the configured path's region.
        So e.g. configured Asia_36.0129 + CN zip 36.0129 -> is_newer=True (no CN dir yet).
        """
        cur_ver, cur_ctime = self.get_current_version_for_region(region)
        candidates = self.find_rosbot_zips_in_downloads(region)
        if not candidates:
            return (None, False, None)
        for path, _size, zip_ver in candidates:
            if cur_ver and zip_ver:
                if (zip_ver[0], zip_ver[1]) > (cur_ver[0], cur_ver[1]):
                    return (path, True, self.version_to_str(zip_ver))
                continue
            if not cur_ver:
                try:
                    zip_mtime = os.path.getmtime(path)
                    if cur_ctime <= 0:
                        return (path, True, self.version_to_str(zip_ver) if zip_ver else None)
                    if zip_mtime > cur_ctime:
                        return (path, True, self.version_to_str(zip_ver) if zip_ver else None)
                except OSError:
                    pass
        return (None, False, None)

    def find_rosbot_exe_recursive(self, root_dir: str) -> Optional[str]:
        """
        Recursively find RoS-BoT.exe or ros-bot*.exe under root_dir
        
        Args:
            root_dir: Root directory path
            
        Returns:
            Optional[str]: First found exe full path, None if not found
        """
        root = Path(root_dir)
        if not root.is_dir():
            return None
        for pattern in ROSBOT_EXE_PATTERNS:
            for p in root.rglob(pattern):
                if p.is_file():
                    return str(p.resolve())
        return None

    def _find_nested_zips(self, root_dir: str) -> List[str]:
        """
        Find zip files containing "ros-bot" in filename under root_dir
        
        Args:
            root_dir: Root directory path
            
        Returns:
            List[str]: List of found zip file paths
        """
        zips = []
        root = Path(root_dir)
        if not root.is_dir():
            return zips
        for p in root.rglob("*.zip"):
            if p.is_file():
                filename_lower = p.name.lower()
                if "ros-bot" in filename_lower or "rosbot" in filename_lower:
                    zips.append(str(p.resolve()))
        return zips

    def _is_rosbot_zip_filename(self, name: str) -> bool:
        """True if filename looks like a ros-bot subpackage zip."""
        n = name.lower()
        return n.endswith(".zip") and ("ros-bot" in n or "rosbot" in n)


    def _safe_remove_file(self, file_path: str) -> bool:
        """
        Safely remove file using rename to avoid file lock issues
        
        Args:
            file_path: File path to remove
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not os.path.exists(file_path):
            return True
        try:
            # Try rename to temp name first to avoid file lock
            temp_path = file_path + ".tmp_delete"
            if os.path.exists(temp_path):
                os.remove(temp_path)
            os.rename(file_path, temp_path)
            os.remove(temp_path)
            return True
        except OSError:
            # If rename fails, try direct remove
            try:
                os.remove(file_path)
                return True
            except OSError:
                return False

    def _copy_directory_safe(self, src_dir: str, dst_dir: str) -> bool:
        """
        Safely copy directory by reading files from source and writing to destination.
        
        Args:
            src_dir: Source directory path
            dst_dir: Destination directory path
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            src_path = Path(src_dir)
            dst_path = Path(dst_dir)
            
            if not src_path.is_dir():
                return False
            
            dst_path.mkdir(parents=True, exist_ok=True)
            
            for item in src_path.rglob("*"):
                relative_path = item.relative_to(src_path)
                dst_item = dst_path / relative_path
                
                if item.is_file():
                    dst_item.parent.mkdir(parents=True, exist_ok=True)
                    with open(item, "rb") as src_file:
                        with open(dst_item, "wb") as dst_file:
                            shutil.copyfileobj(src_file, dst_file)
                elif item.is_dir():
                    dst_item.mkdir(parents=True, exist_ok=True)
            
            return True
        except Exception:
            return False

    def _copy_extract_to_dir_no_nesting(self, src_dir: str, dst_dir: str) -> bool:
        """
        Copy extracted content from src_dir to dst_dir. If src_dir has exactly one child
        and it is a directory, copy that child's CONTENTS into dst_dir (flatten one level)
        to avoid RosBot\\RosBot\\... recursion. Otherwise copy src_dir contents as usual.
        Used after extracting a zip to a temp dir: merge into dst without adding extra nesting.
        
        Example: if zip contains RosBot\RoS-BoT.exe, and we extract to temp, then copy to dst_dir,
        we want dst_dir\RoS-BoT.exe, not dst_dir\RosBot\RoS-BoT.exe.
        """
        src_path = Path(src_dir)
        if not src_path.is_dir():
            return False
        try:
            top = list(src_path.iterdir())
            # If exactly one child and it's a directory, copy its contents to dst_dir (merge, not nest)
            if len(top) == 1 and top[0].is_dir():
                # Copy child directory's contents into dst_dir (merge)
                return self._copy_directory_safe(str(top[0]), dst_dir)
            # Multiple items or files: copy all to dst_dir
            return self._copy_directory_safe(src_dir, dst_dir)
        except Exception:
            return False

    def _cleanup_directory_safe(self, dir_path: str) -> bool:
        """
        Safely cleanup directory by renaming first, then removing
        
        Args:
            dir_path: Directory path to cleanup
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not os.path.exists(dir_path):
            return True
        try:
            # Rename to temp name first to avoid file lock
            temp_path = dir_path + ".tmp_delete"
            if os.path.exists(temp_path):
                shutil.rmtree(temp_path)
            os.rename(dir_path, temp_path)
            shutil.rmtree(temp_path)
            return True
        except OSError:
            # If rename fails, try direct remove
            try:
                shutil.rmtree(dir_path)
                return True
            except OSError:
                return False

    def _get_unique_temp_dir(self) -> str:
        """Generate unique temp directory path: D:\applications\GameTools\.tmp\tmp_xxx"""
        os.makedirs(ROSBOT_TEMP_BASE_DIR, exist_ok=True)
        unique_id = uuid.uuid4().hex[:8]
        return os.path.join(ROSBOT_TEMP_BASE_DIR, f"tmp_{unique_id}")

    def _check_and_fix_nested_rosbot(self, parent_dir: str, final_dir: str) -> None:
        """
        Check for nested RosBot directories (e.g. Asia_36.0129\RosBot\RosBot\...) and fix by
        moving inner RosBot contents to outer RosBot, then removing inner.
        """
        if not os.path.exists(final_dir) or not os.path.isdir(final_dir):
            return
        final_path = Path(final_dir)
        # Check if final_dir contains a subdirectory named RosBot
        for item in final_path.iterdir():
            if item.is_dir() and item.name == ROSBOT_FINAL_DIR_NAME:
                nested_rosbot = str(item)
                ColorPrint.yellow(f"[RosbotUpdateManager] Found nested RosBot directory: {nested_rosbot}, fixing...")
                # Move nested RosBot contents to parent RosBot
                try:
                    for nested_item in item.iterdir():
                        nested_dst = final_path / nested_item.name
                        if nested_dst.exists():
                            if nested_dst.is_dir():
                                self._cleanup_directory_safe(str(nested_dst))
                            else:
                                self._safe_remove_file(str(nested_dst))
                        shutil.move(str(nested_item), str(nested_dst))
                    # Remove empty nested RosBot directory
                    self._cleanup_directory_safe(nested_rosbot)
                    ColorPrint.green(f"[RosbotUpdateManager] Fixed nested RosBot: moved contents to {final_dir}")
                except Exception as e:
                    ColorPrint.yellow(f"[RosbotUpdateManager] Failed to fix nested RosBot: {e}")

    def _extract_nested_zips_recursive(self, root_dir: str, max_depth: int = 5, current_depth: int = 0) -> bool:
        """
        Recursively extract zip files containing "ros-bot" in root_dir
        
        If exe is still not found after extraction, continue finding and extracting nested zips
        until exe is found or max depth is reached.
        
        Args:
            root_dir: Root directory path
            max_depth: Maximum recursion depth (prevent infinite recursion)
            current_depth: Current recursion depth
            
        Returns:
            bool: Whether exe was successfully found (via recursive extraction)
        """
        if current_depth >= max_depth:
            ColorPrint.yellow(f"[RosbotUpdateManager] Reached max depth {max_depth}, stopping recursive extraction")
            return False
        
        # Check if exe already exists
        exe_path = self.find_rosbot_exe_recursive(root_dir)
        if exe_path:
            return True
        
        # Find nested zips
        nested_zips = self._find_nested_zips(root_dir)
        if not nested_zips:
            return False
        
        ColorPrint.gray(f"[RosbotUpdateManager] Found {len(nested_zips)} nested zip(s), starting recursive extraction (depth {current_depth + 1})")
        
        # Extract each nested zip
        for zip_path in nested_zips:
            zip_dir = os.path.dirname(zip_path)
            # Use unique temp directory for each zip extraction
            temp_extract_dir = self._get_unique_temp_dir()
            
            try:
                # Extract to unique temporary directory; then copy into zip_dir and remove temp (avoid nesting)
                os.makedirs(temp_extract_dir, exist_ok=True)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(temp_extract_dir)
                # Flatten one level if zip had single top-level dir (e.g. RosBot) to avoid RosBot\RosBot\...
                self._copy_extract_to_dir_no_nesting(temp_extract_dir, zip_dir)
                self._cleanup_directory_safe(temp_extract_dir)
                
                ColorPrint.gray(f"[RosbotUpdateManager] Extracted nested zip: {os.path.basename(zip_path)}")
                
                # Safely remove extracted zip file
                self._safe_remove_file(zip_path)
                
                # Check immediately after extraction if exe is found
                exe_path = self.find_rosbot_exe_recursive(root_dir)
                if exe_path:
                    return True
                
                # If still not found, recursively extract deeper nested zips
                if self._extract_nested_zips_recursive(root_dir, max_depth, current_depth + 1):
                    return True
            except Exception as e:
                ColorPrint.yellow(f"[RosbotUpdateManager] Failed to extract nested zip: {zip_path}, {e}")
                # Cleanup temp directory on error
                self._cleanup_directory_safe(temp_extract_dir)
                continue
        
        # Final check if exe is found
        return self.find_rosbot_exe_recursive(root_dir) is not None

    def target_already_has_version(
        self,
        region: str,
        version_str: Optional[str] = None,
        zip_path: Optional[str] = None,
    ) -> bool:
        """
        Return True if the target directory for this (region, version) already exists and
        contains the main exe. Region asia -> Asia_*, cn -> CN_*.
        Version is per-region: Asia_36.0129 and CN_36.0129 are distinct directories.
        """
        if region not in ("asia", "cn"):
            return False
        if not version_str and zip_path:
            v = self.parse_version_from_name(os.path.basename(zip_path))
            version_str = self.version_to_str(v) if v else None
        if not version_str:
            return False
        region_dir = ROSBOT_DIR_NAMESPACE_ASIA if region == "asia" else ROSBOT_DIR_NAMESPACE_CN
        parent_name = f"{region_dir}_{version_str}"
        final_dir = os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name, ROSBOT_FINAL_DIR_NAME)
        if not os.path.exists(final_dir) or not os.path.isdir(final_dir):
            return False
        exe_in_final = self.find_rosbot_exe_recursive(final_dir)
        if not exe_in_final:
            return False
        parent_dir = os.path.dirname(final_dir)
        return os.path.basename(parent_dir) == parent_name

    def get_target_final_dir(
        self,
        region: str,
        version_str: Optional[str] = None,
        zip_path: Optional[str] = None,
    ) -> Optional[str]:
        """Return target directory for (region, version): GameTools/{Asia|CN}_{version}/RosBot. Version is tied to region (asia=Asia, cn=CN)."""
        if region not in ("asia", "cn"):
            return None
        if not version_str and zip_path:
            v = self.parse_version_from_name(os.path.basename(zip_path))
            version_str = self.version_to_str(v) if v else None
        if not version_str:
            return None
        region_dir = ROSBOT_DIR_NAMESPACE_ASIA if region == "asia" else ROSBOT_DIR_NAMESPACE_CN
        parent_name = f"{region_dir}_{version_str}"
        return os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name, ROSBOT_FINAL_DIR_NAME)

    def apply_update(
        self,
        zip_path: str,
        region: str,
        version_str: Optional[str] = None,
    ) -> bool:
        """
        Apply ROSBOT update
        
        Process (all work in temp directory, then copy clean result to final):
        1) Create temp directory: {region}_{version}_temp_extract
        2) Extract main zip to temp directory
        3) Recursively extract nested zips and find RoS-BoT.exe in temp
        4) Copy exe directory to final: GameTools\\{region}_version\\RosBot\\ (clean, no nesting)
        5) Copy old RoS-BoT.ini (if exists), update CONFIG ros_directory
        6) Cleanup temp directory
        
        Args:
            zip_path: Zip file path
            region: Region identifier (asia or cn)
            version_str: Version string (optional, will be parsed from zip_path)
            
        Returns:
            bool: Whether update was successfully applied
        """
        if not os.path.isfile(zip_path) or not zip_path.lower().endswith(".zip"):
            return False
        if region not in ("asia", "cn"):
            ColorPrint.yellow("[RosbotUpdateManager] Battle.net region not detected (need asia/cn), skipping update")
            return False
        region_dir = ROSBOT_DIR_NAMESPACE_ASIA if region == "asia" else ROSBOT_DIR_NAMESPACE_CN
        if not version_str:
            v = self.parse_version_from_name(os.path.basename(zip_path))
            version_str = self.version_to_str(v) if v else "0.0"
        parent_name = f"{region_dir}_{version_str}"
        final_dir = os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name, ROSBOT_FINAL_DIR_NAME)
        
        # Check if target directory already has this version (main exe present) -> skip extract
        if self.target_already_has_version(region, version_str):
            ColorPrint.gray(
                f"[RosbotUpdateManager] Already up to date: {final_dir} has main exe for {region} {version_str}, skipping extract"
            )
            return True
        if os.path.exists(final_dir) and os.path.isdir(final_dir):
            exe_in_final = self.find_rosbot_exe_recursive(final_dir)
            if exe_in_final:
                parent_dir = os.path.dirname(final_dir)
                if os.path.basename(parent_dir) != parent_name:
                    ColorPrint.gray(f"[RosbotUpdateManager] Target directory exists but parent name mismatch, proceeding with update")
        
        # Use unique temp directory for this update run
        temp_extract_root = self._get_unique_temp_dir()
        ros_dir_old, _, _ = self.get_current_ros_dir_info()
        
        try:
            
            # Step 1: Extract main zip to temp directory
            os.makedirs(temp_extract_root, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(temp_extract_root)
            ColorPrint.green(f"[RosbotUpdateManager] Extracted main zip to temp: {temp_extract_root}")
            
            # Step 2: Find exe in temp, extract nested zips if needed
            exe_path = self.find_rosbot_exe_recursive(temp_extract_root)
            if not exe_path:
                ColorPrint.gray("[RosbotUpdateManager] RoS-BoT.exe not found, searching for nested zips...")
                if self._extract_nested_zips_recursive(temp_extract_root):
                    exe_path = self.find_rosbot_exe_recursive(temp_extract_root)
            
            if not exe_path:
                ColorPrint.red("[RosbotUpdateManager] RoS-BoT.exe not found after extraction (tried recursive nested zip extraction)")
                self._cleanup_directory_safe(temp_extract_root)
                return False
            
            # Step 3: Copy exe directory to final location (clean, no nesting)
            exe_dir = os.path.dirname(exe_path)
            if os.path.exists(final_dir):
                self._cleanup_directory_safe(final_dir)
            
            # Copy with flatten to avoid RosBot\RosBot nesting
            if not self._copy_extract_to_dir_no_nesting(exe_dir, final_dir):
                ColorPrint.red(f"[RosbotUpdateManager] Failed to copy exe directory to final location")
                self._cleanup_directory_safe(temp_extract_root)
                return False
            
            ColorPrint.green(f"[RosbotUpdateManager] Copied to final: {final_dir}")
            
            # Step 3.5: Check and fix any nested RosBot directories that may have been created
            parent_name = f"{region_dir}_{version_str}"
            parent_dir = os.path.join(ROSBOT_GAMETOOLS_BASE, parent_name)
            self._check_and_fix_nested_rosbot(parent_dir, final_dir)
            
            # Step 4: Copy old config file
            if ros_dir_old and os.path.isdir(ros_dir_old):
                old_ini = os.path.join(ros_dir_old, "RoS-BoT.ini")
                new_ini = os.path.join(final_dir, "RoS-BoT.ini")
                if os.path.isfile(old_ini):
                    try:
                        shutil.copy2(old_ini, new_ini)
                        ColorPrint.gray("[RosbotUpdateManager] Copied RoS-BoT.ini")
                    except OSError:
                        pass
            
            # Step 5: Update config and clear cache (ensure UI reflects change)
            # Normalize final_dir path for consistent comparison
            final_dir_normalized = os.path.normpath(final_dir)
            
            success = set_config_value_safe("ros_settings.ros_directory", final_dir_normalized)
            if not success:
                ColorPrint.yellow("[RosbotUpdateManager] Failed to update config ros_settings.ros_directory")
            else:
                # Wait a bit for config worker to process and verify update
                for _ in range(10):
                    time.sleep(0.1)
                    updated_path = get_config_value_safe("ros_settings.ros_directory", "")
                    if updated_path:
                        updated_path_normalized = os.path.normpath(updated_path)
                        if updated_path_normalized == final_dir_normalized:
                            ColorPrint.green(f"[RosbotUpdateManager] Config updated: ros_directory = {final_dir_normalized}")
                            break
                else:
                    # Final check after waiting
                    updated_path = get_config_value_safe("ros_settings.ros_directory", "")
                    if updated_path:
                        updated_path_normalized = os.path.normpath(updated_path)
                        if updated_path_normalized != final_dir_normalized:
                            ColorPrint.yellow(f"[RosbotUpdateManager] Config path mismatch: expected {final_dir_normalized}, got {updated_path_normalized}")
                        else:
                            ColorPrint.green(f"[RosbotUpdateManager] Config updated: ros_directory = {final_dir_normalized}")
                    else:
                        ColorPrint.yellow("[RosbotUpdateManager] Config ros_directory is empty after update")
            
            # Clear rosbot_manager singleton cache
            try:
                rosbot_manager_module._rosbot_manager = None
                ColorPrint.gray("[RosbotUpdateManager] Cleared rosbot_manager singleton cache")
            except Exception:
                pass
            
            # Step 6: Cleanup temp directory
            self._cleanup_directory_safe(temp_extract_root)
            ColorPrint.gray("[RosbotUpdateManager] Cleaned up temp directory")
            
            return True
        except Exception as e:
            ColorPrint.red(f"[RosbotUpdateManager] Extract/move/update failed: {e}")
            # Try cleanup temp on error
            try:
                self._cleanup_directory_safe(temp_extract_root)
            except Exception:
                pass
            return False

    def check_update(self) -> Tuple[Optional[str], bool, Optional[str], Optional[str]]:
        """
        Execute update check
        
        Only check when Battle.net is detected as asia/cn; otherwise skip.
        
        Returns:
            Tuple[Optional[str], bool, Optional[str], Optional[str]]: 
            (best_zip_path or None, is_newer, version_str or None, region or None)
        """
        region = self.get_battlenet_region()
        if region not in ("asia", "cn"):
            ColorPrint.gray("[RosbotUpdateManager] Battle.net region not detected (need asia/cn), skipping update check")
            return (None, False, None, None)
        zip_path, is_newer, version_str = self.get_best_newer_zip(region)
        return (zip_path, is_newer, version_str, region)

    def ask_yes_no_on_main_thread(self, panel: Any, title: str, message: str) -> bool:
        """
        Pop up Yes/No dialog on main thread, block current thread until user chooses
        
        Args:
            panel: Tkinter panel object (must have container attribute)
            title: Dialog title
            message: Dialog message
            
        Returns:
            bool: True=Yes, False=No or timeout
        """
        result = [None]
        done = threading.Event()

        def _ask():
            try:
                from tkinter import messagebox
                result[0] = messagebox.askyesno(title, message)
            except Exception:
                result[0] = False
            done.set()

        if panel.container.winfo_exists():
            panel.container.after(0, _ask)
            done.wait(timeout=60)
        return result[0] is True


# Global singleton instance
_rosbot_update_manager: Optional[RosbotUpdateManager] = None


def get_rosbot_update_manager() -> RosbotUpdateManager:
    """
    Get global ROSBOT update manager instance (singleton)
    
    Returns:
        RosbotUpdateManager: Update manager instance
    """
    global _rosbot_update_manager
    if _rosbot_update_manager is None:
        _rosbot_update_manager = RosbotUpdateManager()
    return _rosbot_update_manager
