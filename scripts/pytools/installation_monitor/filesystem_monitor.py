"""
Filesystem Monitor for tracking file and directory changes during software installation
Optimized version with smart directory tracking
"""

import os
import time
import json
from pathlib import Path
from typing import Dict, List, Set, Any, Tuple
from datetime import datetime
from utils import should_skip_path, should_skip_first_level_directory, should_skip_by_depth, get_file_info, save_json
from config import (SKIP_PATTERNS, SKIP_FIRST_LEVEL_PATTERNS, SKIP_DOT_PREFIXED, 
                   PERMISSION_ERROR_CACHE_FILE, ENABLE_PERMISSION_CACHE, DIRECTORY_CONFIG)


class PermissionErrorCache:
    """Cache for directories with permission errors to skip on future scans"""

    def __init__(self, cache_file: Path = None):
        """
        Initialize permission error cache

        Args:
            cache_file: Path to cache file
        """
        self.cache_file = cache_file or PERMISSION_ERROR_CACHE_FILE
        self.cached_errors: Set[str] = set()
        self.enabled = ENABLE_PERMISSION_CACHE
        self.load_cache()

    def load_cache(self) -> None:
        """Load cached permission errors from file"""
        if not self.enabled or not self.cache_file.exists():
            return

        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.cached_errors = set(data.get('permission_errors', []))
            print(f"  Loaded {len(self.cached_errors)} cached permission errors")
        except Exception as e:
            print(f"  Warning: Could not load permission cache: {e}")
            self.cached_errors = set()

    def save_cache(self) -> None:
        """Save cached permission errors to file"""
        if not self.enabled:
            return

        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'permission_errors': sorted(list(self.cached_errors)),
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            print(f"  Warning: Could not save permission cache: {e}")

    def is_cached(self, path: str) -> bool:
        """Check if path is in cache"""
        return self.enabled and path in self.cached_errors

    def add(self, path: str) -> None:
        """Add path to cache"""
        if self.enabled:
            self.cached_errors.add(path)

    def clear(self) -> None:
        """Clear cache"""
        self.cached_errors.clear()
        if self.cache_file.exists():
            try:
                self.cache_file.unlink()
            except Exception:
                pass


class SmartDirectoryTracker:
    """Smart directory tracker that only scans changed directories"""

    def __init__(self, root_dir: Path, skip_patterns: List[str], permission_cache: PermissionErrorCache = None):
        """
        Initialize smart directory tracker

        Args:
            root_dir: Root directory to track
            skip_patterns: Patterns to skip
            permission_cache: Cache for permission errors
        """
        self.root_dir = root_dir
        self.skip_patterns = skip_patterns
        self.permission_cache = permission_cache
        self.top_level_dirs: Dict[str, float] = {}  # dir_path -> mtime
        self.is_program_files = self._is_program_files_dir()

    def _is_program_files_dir(self) -> bool:
        """Check if this is a Program Files directory"""
        root_str = str(self.root_dir).lower()
        return 'program files' in root_str or 'programdata' in root_str

    def scan_top_level(self) -> Dict[str, float]:
        """
        Scan only top-level directories and record modification times

        Returns:
            Dictionary of dir_path -> mtime
        """
        top_level = {}

        if not self.root_dir.exists():
            return top_level

        try:
            for item in self.root_dir.iterdir():
                if item.is_dir():
                    item_str = str(item)

                    # Check permission cache
                    if self.permission_cache and self.permission_cache.is_cached(item_str):
                        continue

                    if should_skip_path(item_str, self.skip_patterns):
                        continue

                    try:
                        mtime = item.stat().st_mtime
                        top_level[item_str] = mtime
                    except (PermissionError, OSError) as e:
                        # Cache this permission error
                        if self.permission_cache:
                            self.permission_cache.add(item_str)
                            print(f"    Permission denied (cached): {item_str}")

        except (PermissionError, OSError) as e:
            print(f"  Warning: Cannot scan {self.root_dir}: {e}")
            if self.permission_cache:
                self.permission_cache.add(str(self.root_dir))

        return top_level

    def get_changed_dirs(self, baseline: Dict[str, float]) -> List[str]:
        """
        Get list of directories that are new or modified

        Args:
            baseline: Baseline directory mtimes

        Returns:
            List of changed directory paths
        """
        current = self.scan_top_level()
        changed = []

        # Find new or modified directories
        for dir_path, mtime in current.items():
            baseline_mtime = baseline.get(dir_path)

            if baseline_mtime is None or mtime > baseline_mtime:
                changed.append(dir_path)

        return changed

    def scan_directory_shallow(self, directory: Path, baseline_subdirs: Set[str] = None, max_depth: int = 1) -> Set[str]:
        """
        Shallow scan - only scan directory without recursing into existing subdirectories
        For newly created directories during monitoring, we only record the directory itself

        Args:
            directory: Directory to scan
            baseline_subdirs: Set of subdirectories that existed in baseline (skip these)
            max_depth: Maximum scan depth (1 = only direct children)

        Returns:
            Set of paths (only new directories, not their contents)
        """
        paths = set()

        if not directory.exists():
            return paths

        baseline_subdirs = baseline_subdirs or set()

        try:
            # Add the directory itself
            paths.add(str(directory))

            # Scan only direct children (depth 1)
            for item in directory.iterdir():
                item_str = str(item)
                item_name = item.name

                # Skip if in baseline (existed before monitoring)
                if item_str in baseline_subdirs:
                    continue

                # Check permission cache
                if self.permission_cache and self.permission_cache.is_cached(item_str):
                    continue

                # Skip first-level patterns and dot-prefixed directories
                if item.is_dir():
                    if should_skip_first_level_directory(item_name, SKIP_FIRST_LEVEL_PATTERNS, SKIP_DOT_PREFIXED):
                        continue

                # Skip general patterns
                if should_skip_path(item_str, self.skip_patterns):
                    continue

                try:
                    # Add new items (files and directories)
                    if item.is_dir():
                        # For directories, only add the directory itself, not contents
                        # This is the optimization: once we detect a new folder,
                        # we don't need to scan inside it
                        paths.add(item_str)
                    elif item.is_file():
                        paths.add(item_str)
                except (PermissionError, OSError):
                    if self.permission_cache:
                        self.permission_cache.add(item_str)

        except (PermissionError, OSError) as e:
            if self.permission_cache:
                self.permission_cache.add(str(directory))

        return paths

    def deep_scan_directory(self, directory: Path, max_depth: int = -1) -> Set[str]:
        """
        Deep scan a specific directory (used for final collection)

        Args:
            directory: Directory to scan
            max_depth: Maximum scan depth (-1 for unlimited)

        Returns:
            Set of all paths in directory
        """
        paths = set()

        if not directory.exists():
            return paths

        try:
            for root, dirs, files in os.walk(directory):
                root_path = Path(root)
                root_str = str(root_path)
                
                # Calculate current depth
                current_depth = len(Path(root).relative_to(directory).parts) if root != str(directory) else 0

                # Check depth limit
                if should_skip_by_depth(current_depth, max_depth):
                    dirs.clear()  # Don't descend further
                    continue

                # Check permission cache
                if self.permission_cache and self.permission_cache.is_cached(root_str):
                    dirs.clear()
                    continue

                # Skip directories matching patterns
                if should_skip_path(root_str, self.skip_patterns):
                    dirs.clear()  # Don't descend into skipped directories
                    continue

                # Add directory itself
                paths.add(root_str)

                # Add all files
                for file in files:
                    file_path = root_path / file
                    if not should_skip_path(str(file_path), self.skip_patterns):
                        paths.add(str(file_path))

                # Check for permission errors on subdirectories
                dirs_to_remove = []
                for subdir in dirs:
                    subdir_path = root_path / subdir
                    subdir_str = str(subdir_path)

                    # Skip first-level patterns and dot-prefixed directories
                    if current_depth == 0:  # Only check first level
                        if should_skip_first_level_directory(subdir, SKIP_FIRST_LEVEL_PATTERNS, SKIP_DOT_PREFIXED):
                            dirs_to_remove.append(subdir)
                            continue

                    if self.permission_cache and self.permission_cache.is_cached(subdir_str):
                        dirs_to_remove.append(subdir)
                        continue

                    try:
                        # Test if we can access the directory
                        subdir_path.stat()
                    except (PermissionError, OSError):
                        if self.permission_cache:
                            self.permission_cache.add(subdir_str)
                            print(f"      Permission denied (cached): {subdir_str}")
                        dirs_to_remove.append(subdir)

                # Remove inaccessible directories from walk
                for subdir in dirs_to_remove:
                    dirs.remove(subdir)

        except (PermissionError, OSError) as e:
            print(f"    Warning: Cannot scan {directory}: {e}")
            if self.permission_cache:
                self.permission_cache.add(str(directory))

        return paths


class FilesystemMonitor:
    """Monitor filesystem changes in specified directories"""

    def __init__(self, directories: List[str] = None, skip_patterns: List[str] = None, directory_config: Dict[str, Dict] = None):
        """
        Initialize filesystem monitor

        Args:
            directories: List of directories to monitor (legacy mode)
            skip_patterns: Patterns to skip (defaults to config SKIP_PATTERNS)
            directory_config: Directory configuration dict (new mode)
        """
        self.skip_patterns = skip_patterns or SKIP_PATTERNS
        self.permission_cache = PermissionErrorCache()
        self.trackers: Dict[str, SmartDirectoryTracker] = {}
        self.baseline_top_level: Dict[str, Dict[str, float]] = {}  # root_dir -> {subdir -> mtime}
        self.baseline_files: Dict[str, Set[str]] = {}  # For non-Program Files dirs
        self.changes: Dict[str, List[Dict[str, Any]]] = {}
        self.monitoring = False
        
        # Directory configuration
        self.directory_config = directory_config or {}
        
        if directory_config:
            # New mode: use directory configuration
            self.directories = []
            for config_key, config_data in directory_config.items():
                if config_data.get('enabled', True):  # Default to enabled
                    dir_path = Path(config_data['path'])
                    if dir_path.exists():
                        self.directories.append(dir_path)
                    else:
                        print(f"  Warning: Directory does not exist: {config_data['path']}")
        else:
            # Legacy mode: use simple directory list
            self.directories = [Path(d) for d in directories] if directories else []

        # Create trackers with permission cache
        for directory in self.directories:
            self.trackers[str(directory)] = SmartDirectoryTracker(directory, self.skip_patterns, self.permission_cache)

    @classmethod
    def from_config_keys(cls, config_keys: List[str]) -> 'FilesystemMonitor':
        """
        Create FilesystemMonitor from configuration keys
        
        Args:
            config_keys: List of directory configuration keys to enable
            
        Returns:
            FilesystemMonitor instance
        """
        directory_config = {}
        for key in config_keys:
            if key in DIRECTORY_CONFIG:
                directory_config[key] = DIRECTORY_CONFIG[key].copy()
                directory_config[key]['enabled'] = True
            else:
                print(f"  Warning: Unknown directory config key: {key}")
        
        return cls(directory_config=directory_config)

    def _is_large_directory(self, directory: Path) -> bool:
        """Check if directory should use smart tracking - now all directories use shallow scan"""
        # All directories now use shallow scan (depth 1 only)
        return True

    def _quick_scan_files(self, directory: Path) -> Set[str]:
        """
        Quick scan for small directories (Start Menu, etc.)

        Args:
            directory: Directory to scan

        Returns:
            Set of paths
        """
        paths = set()

        if not directory.exists():
            return paths

        try:
            for root, dirs, files in os.walk(directory):
                root_path = Path(root)

                if should_skip_path(str(root_path), self.skip_patterns):
                    dirs.clear()
                    continue

                paths.add(str(root_path))

                for file in files:
                    file_path = root_path / file
                    if not should_skip_path(str(file_path), self.skip_patterns):
                        paths.add(str(file_path))

        except (PermissionError, OSError):
            pass

        return paths

    def create_baseline(self) -> None:
        """Create baseline snapshot of all monitored directories"""
        print("Creating baseline snapshot (optimized)...")
        
        # Show all configured directories
        if self.directory_config:
            print("  Monitoring directories:")
            for key, config_data in self.directory_config.items():
                if config_data.get('enabled', True):
                    print(f"    [✓] {config_data['description']}")
        else:
            print("  Only scanning top-level directories in Program Files...")

        for directory in self.directories:
            dir_str = str(directory)

            if not directory.exists():
                print(f"  Warning: Directory not found: {directory}")
                self.baseline_top_level[dir_str] = {}
                self.baseline_files[dir_str] = set()
                continue

            tracker = self.trackers[dir_str]

            # Get scan depth from configuration
            scan_depth = 1  # Default depth
            if self.directory_config:
                for config_key, config_data in self.directory_config.items():
                    if config_data.get('path') == dir_str:
                        scan_depth = config_data.get('scan_depth', 1)
                        break

            # All directories use shallow scan (depth 1 only)
            print(f"  Scanning (depth {scan_depth}): {directory}")
            top_level = tracker.scan_top_level()
            self.baseline_top_level[dir_str] = top_level
            print(f"    Found {len(top_level)} top-level directories")

        total_tracked = sum(len(v) for v in self.baseline_top_level.values())
        print(f"\nBaseline created:")
        print(f"  Tracked directories: {total_tracked}")
        print(f"  All directories using depth 1 scan (shallow scan only)")

    def detect_changes(self) -> Dict[str, List[str]]:
        """
        Detect changes since baseline

        Returns:
            Dictionary of directory -> list of new paths
        """
        new_items = {}

        print("\nScanning for changes (smart scan)...")

        for directory in self.directories:
            dir_str = str(directory)
            tracker = self.trackers[dir_str]

            # All directories use shallow scan (depth 1 only)
            print(f"  Checking: {directory}")

            baseline = self.baseline_top_level.get(dir_str, {})
            changed_dirs = tracker.get_changed_dirs(baseline)

            if changed_dirs:
                print(f"    Changed directories: {len(changed_dirs)}")
                all_new = set()

                for changed_dir in changed_dirs:
                    changed_path = Path(changed_dir)
                    print(f"      Found new: {changed_path.name}")

                    # Only record the directory itself - no deep scanning
                    # Since we're copying the whole directory later, we don't need to scan contents
                    all_new.add(str(changed_path))

                if all_new:
                    new_items[dir_str] = sorted(list(all_new))
            else:
                print(f"    No changes detected")

        return new_items

    def start_monitoring(self) -> None:
        """Start monitoring process"""
        self.monitoring = True
        self.create_baseline()

    def stop_monitoring(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Stop monitoring and collect all changes

        Returns:
            Dictionary of changes with detailed file information
        """
        self.monitoring = False

        new_items = self.detect_changes()
        detailed_changes = {}

        print("\nCollecting directory information...")

        total_paths = sum(len(paths) for paths in new_items.values())
        processed = 0

        for directory, paths in new_items.items():
            detailed_changes[directory] = []
            print(f"  Processing {directory}: {len(paths)} directories")

            for path_str in paths:
                # Simplified info collection - just basic directory info
                info = {
                    "path": path_str,
                    "is_dir": True,
                    "type": "directory"
                }
                detailed_changes[directory].append(info)
                processed += 1
                
                # Show progress every 10 items (since we expect fewer directories)
                if processed % 10 == 0:
                    print(f"    Progress: {processed}/{total_paths} directories processed")

        self.changes = detailed_changes

        # Save permission cache
        self.permission_cache.save_cache()

        return detailed_changes

    def save_results(self, output_dir: Path, filename: str = "filesystem_changes.json") -> None:
        """
        Save monitoring results to file

        Args:
            output_dir: Output directory
            filename: Output filename
        """
        output_file = output_dir / filename

        result = {
            "monitored_directories": [str(d) for d in self.directories],
            "skip_patterns": self.skip_patterns,
            "changes": self.changes,
            "timestamp": datetime.now().isoformat(),
            "total_new_items": sum(len(v) for v in self.changes.values())
        }

        save_json(result, output_file)
        print(f"Filesystem changes saved to: {output_file}")

    def print_summary(self) -> None:
        """Print summary of detected changes"""
        if not self.changes:
            print("\nNo filesystem changes detected.")
            return

        print("\n" + "=" * 80)
        print("FILESYSTEM CHANGES SUMMARY")
        print("=" * 80)

        total_changes = 0

        for directory, items in self.changes.items():
            if items:
                print(f"\n{directory}:")
                print(f"  New items: {len(items)}")

                # Group by type
                files = [i for i in items if not i.get('is_dir', False)]
                dirs = [i for i in items if i.get('is_dir', False)]

                print(f"    Directories: {len(dirs)}")
                print(f"    Files: {len(files)}")

                total_changes += len(items)

        print(f"\n{'=' * 80}")
        print(f"Total new items: {total_changes}")
        print(f"{'=' * 80}\n")


def create_filesystem_monitor(program_files: bool = True,
                               program_files_x86: bool = True,
                               user_home: bool = True,
                               start_menus: bool = True,
                               additional_dirs: List[str] = None) -> FilesystemMonitor:
    """
    Create a filesystem monitor with specified directories

    Args:
        program_files: Monitor Program Files
        program_files_x86: Monitor Program Files (x86)
        user_home: Monitor user home directory
        start_menus: Monitor start menu directories
        additional_dirs: Additional directories to monitor

    Returns:
        Configured FilesystemMonitor
    """
    from config import (PROGRAM_FILES, PROGRAM_FILES_X86, USER_HOME,
                        USER_START_MENU, PUBLIC_START_MENU, ADDITIONAL_DIRS)

    directories = []

    if program_files:
        directories.append(PROGRAM_FILES)

    if program_files_x86:
        directories.append(PROGRAM_FILES_X86)

    if user_home:
        directories.append(str(USER_HOME))

    if start_menus:
        directories.extend([str(USER_START_MENU), str(PUBLIC_START_MENU)])

    if additional_dirs:
        directories.extend(additional_dirs)
    elif start_menus or user_home:
        # Add default additional directories
        directories.extend(ADDITIONAL_DIRS)

    return FilesystemMonitor(directories)
