#!/usr/bin/env python3
"""
Factory Directory Manager for React Native Multi-App System
Handles copying project to external build directory for safe builds
"""

import os
import sys
import shutil
import platform
import re
import fnmatch
import traceback
from pathlib import Path
from typing import List
import time


class FactoryManager:
    """Manages external factory directory for safe builds"""

    def __init__(self, project_root: Path, app_namespace: str):
        """
        Initialize factory manager

        Args:
            project_root: Root directory of React Native project
            app_namespace: App namespace identifier
        """
        self.project_root = project_root
        self.app_namespace = app_namespace
        self.factory_root = self._get_factory_root()

    def _get_factory_root(self) -> Path:
        """Get factory directory root path (outside project)"""
        system = platform.system()

        if system == "Windows":
            # Windows: Fixed directory outside code
            factory_dir = Path("D:/programing/.build_dir")
        else:
            # Linux/Unix: Use environment variable or default
            # Check if gvar provides build directory mapping
            build_dir = os.environ.get("GVAR_BUILD_DIR")
            if build_dir:
                factory_dir = Path(build_dir)
            else:
                # Default to /tmp/.build_dir if no mapping
                factory_dir = Path("/tmp/.build_dir")

        factory_dir.mkdir(parents=True, exist_ok=True)
        return factory_dir

    def get_factory_base_dir(self) -> Path:
        """Get factory base directory for current app (without version number)"""
        return self.factory_root / "react_native" / self.app_namespace

    def scan_existing_factory_dirs(self) -> list:
        """Scan existing factory directories for current app"""
        base_dir = self.get_factory_base_dir()
        if not base_dir.exists():
            return []

        # Find all directories matching app_namespace1, app_namespace2, etc.
        existing_dirs = []
        for item in base_dir.iterdir():
            if item.is_dir() and item.name.startswith(self.app_namespace):
                suffix = item.name[len(self.app_namespace):]
                if suffix.isdigit():
                    existing_dirs.append((int(suffix), item))

        # Sort by number
        existing_dirs.sort(key=lambda x: x[0])
        return [path for _, path in existing_dirs]

    def get_next_factory_path(self) -> Path:
        """Get next incremental factory path (app_name1, app_name2, ...)"""
        existing = self.scan_existing_factory_dirs()
        if not existing:
            next_num = 1
        else:
            # Get highest number and increment
            last_path = existing[-1]
            last_num = int(last_path.name[len(self.app_namespace):])
            next_num = last_num + 1

        base_dir = self.get_factory_base_dir()
        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir / f"{self.app_namespace}{next_num}"

    def get_factory_path(self) -> Path:
        """Get factory build path (will be set by user selection)"""
        if not hasattr(self, '_selected_factory_path'):
            # Default to next incremental path
            self._selected_factory_path = self.get_next_factory_path()
        return self._selected_factory_path

    def set_factory_path(self, path: Path):
        """Set selected factory path"""
        self._selected_factory_path = path

    def compare_files(self, factory_path: Path) -> tuple:
        """
        Compare source and factory files

        Returns:
            (need_copy, changed_files_count, new_files_count)
        """
        if not factory_path.exists():
            # New directory - need full copy, count all source files
            total_files = 0
            for root, dirs, files in os.walk(str(self.project_root), followlinks=False):
                root_path = Path(root)
                dirs_to_remove = []
                for dir_name in dirs:
                    dir_path = root_path / dir_name
                    if self.should_exclude(dir_path, self.project_root):
                        dirs_to_remove.append(dir_name)
                for dir_name in dirs_to_remove:
                    dirs.remove(dir_name)

                for file_name in files:
                    source_file = root_path / file_name
                    if not self.should_exclude(source_file, self.project_root):
                        total_files += 1

            return (True, 0, total_files)

        changed_files = []
        new_files = []

        exclude_patterns = self.get_exclude_patterns()

        for root, dirs, files in os.walk(str(self.project_root), followlinks=False):
            root_path = Path(root)
            relative_root = root_path.relative_to(self.project_root)

            # Filter excluded directories
            dirs_to_remove = []
            for dir_name in dirs:
                dir_path = root_path / dir_name
                if self.should_exclude(dir_path, self.project_root):
                    dirs_to_remove.append(dir_name)
            for dir_name in dirs_to_remove:
                dirs.remove(dir_name)

            # Check files
            for file_name in files:
                source_file = root_path / file_name

                if self.should_exclude(source_file, self.project_root):
                    continue

                relative_file = source_file.relative_to(self.project_root)
                factory_file = factory_path / relative_file

                if not factory_file.exists():
                    new_files.append(relative_file)
                else:
                    # Compare timestamps
                    if source_file.stat().st_mtime > factory_file.stat().st_mtime:
                        changed_files.append(relative_file)

        need_copy = len(changed_files) > 0 or len(new_files) > 0
        return (need_copy, len(changed_files), len(new_files))

    def get_exclude_patterns(self) -> List[str]:
        """Get patterns to exclude from copy"""
        return [
            "node_modules",
            ".git",
            ".app-states",
            ".resource-backups",
            "android/build",
            "android/app/build",
            "android/app/.cxx",  # CMake build artifacts
            "android/.gradle",
            "android/.cxx",  # Additional CMake artifacts
            "ios/build",
            "ios/Pods",
            "ios/DerivedData",
            "*.log",
            "__pycache__",
            ".DS_Store",
            "*.pyc",
            "*.o",  # Object files
            "*.so",  # Shared libraries
            "*.a",  # Static libraries
        ]

    def should_exclude(self, path: Path, base_path: Path) -> bool:
        """Check if path should be excluded from copy"""
        relative_path = str(path.relative_to(base_path)).replace('\\', '/')
        exclude_patterns = self.get_exclude_patterns()

        for pattern in exclude_patterns:
            # Check wildcard patterns first
            if '*' in pattern:
                if fnmatch.fnmatch(relative_path, pattern):
                    return True
                # Also check each path component
                if fnmatch.fnmatch(path.name, pattern):
                    return True
            else:
                # For non-wildcard patterns, match exact path or directory
                # Pattern must match complete path components, not substrings
                path_parts = relative_path.split('/')
                pattern_parts = pattern.split('/')

                # Check if pattern matches from the start
                if len(pattern_parts) <= len(path_parts):
                    if path_parts[:len(pattern_parts)] == pattern_parts:
                        return True

                # Check if pattern matches the file/directory name
                if pattern == path.name:
                    return True

        return False

    def show_factory_directory_menu(self) -> Path:
        """
        Show interactive menu to select factory directory using arrow keys

        Returns:
            Selected factory path
        """
        import sys
        import time

        # Windows-specific import for keyboard input
        try:
            import msvcrt
        except ImportError:
            msvcrt = None

        if not msvcrt:
            # Fallback for non-Windows: simple input
            return self._show_simple_factory_menu()

        existing_dirs = self.scan_existing_factory_dirs()
        next_path = self.get_next_factory_path()

        if not existing_dirs:
            print()
            print(f"[INFO] No existing factory directories found")
            print(f"[INFO] Will create new directory: {next_path.name}")
            print()
            return next_path

        # Build menu options
        options = []

        # Option 0: New directory (default)
        need_copy_new, _, total_files = self.compare_files(next_path)
        options.append({
            "path": next_path,
            "display": f"NEW: {next_path.name}",
            "detail": f"(will copy {total_files} files)",
            "is_new": True
        })

        # Existing directories
        for dir_path in existing_dirs:
            need_copy, changed, new = self.compare_files(dir_path)
            if not need_copy:
                status = "up to date"
            else:
                status = f"{changed} changed, {new} new files"

            options.append({
                "path": dir_path,
                "display": f"{dir_path.name}",
                "detail": f"({status})",
                "is_new": False
            })

        selected_index = 0

        def draw_menu():
            os.system('cls' if os.name == 'nt' else 'clear')
            print()
            print("=" * 79)
            print("  FACTORY DIRECTORY SELECTION")
            print("=" * 79)
            print()
            print(f"Found {len(existing_dirs)} existing factory directories")
            print("-" * 50)

            for i, opt in enumerate(options):
                is_selected = (i == selected_index)
                prefix = " -> " if is_selected else "    "
                display_text = f"{prefix}{i}. {opt['display']:<25} {opt['detail']}"

                if is_selected:
                    print(f"\033[92m{display_text}\033[0m")  # Green
                else:
                    print(display_text)

            print("-" * 50)
            print()
            print("Controls:")
            print("  [Up/Down]    Navigate options")
            print("  [Enter]      Confirm selection")
            print("  [ESC]        Cancel (use default)")
            print()
            print("=" * 79)

        # Wait for output to settle and clear keyboard buffer
        time.sleep(0.3)
        while msvcrt.kbhit():
            msvcrt.getch()

        # Flush stdin
        if hasattr(sys.stdin, 'flush'):
            try:
                sys.stdin.flush()
            except:
                pass

        while True:
            draw_menu()
            print("\n>>> Press Enter to confirm, ESC to cancel <<<")
            sys.stdout.flush()

            # Wait for key press
            key = msvcrt.getch()

            if key == b'\x1b':  # ESC - use default (new directory)
                print(f"\n[INFO] Using default: {options[0]['display']}")
                return options[0]["path"]

            elif key == b'\r' or key == b'\n':  # Enter - confirm selection
                selected = options[selected_index]
                print(f"\n[OK] Selected: {selected['display']}")
                return selected["path"]

            elif key == b'\xe0' or key == b'\x00':  # Arrow keys prefix
                arrow = msvcrt.getch()

                if arrow == b'H':  # Up arrow
                    selected_index = (selected_index - 1) % len(options)

                elif arrow == b'P':  # Down arrow
                    selected_index = (selected_index + 1) % len(options)

    def _show_simple_factory_menu(self) -> Path:
        """Fallback simple menu for non-Windows systems"""
        existing_dirs = self.scan_existing_factory_dirs()
        next_path = self.get_next_factory_path()

        print()
        print("=" * 60)
        print("Factory Directory Selection")
        print("=" * 60)
        print()

        if not existing_dirs:
            print(f"[INFO] No existing factory directories found")
            print(f"[INFO] Will create new directory: {next_path.name}")
            print()
            return next_path

        print(f"[INFO] Found {len(existing_dirs)} existing factory directories:")
        print()

        # Build options
        options = []
        need_copy_new, _, total_files = self.compare_files(next_path)
        options.append({
            "path": next_path,
            "display": f"NEW: {next_path.name}",
            "detail": f"(will copy {total_files} files)"
        })

        for dir_path in existing_dirs:
            need_copy, changed, new = self.compare_files(dir_path)
            status = "up to date" if not need_copy else f"{changed} changed, {new} new files"
            options.append({
                "path": dir_path,
                "display": f"{dir_path.name}",
                "detail": f"({status})"
            })

        # Display options
        for i, opt in enumerate(options):
            prefix = "[DEFAULT]" if i == 0 else f"[{i}]      "
            print(f"  {prefix} {opt['display']:<20} {opt['detail']}")

        print()
        print("Press Enter to use default (NEW), or enter number to select:")

        try:
            choice = input(">>> ").strip()
            if not choice:
                selected = options[0]
            else:
                idx = int(choice)
                if 0 <= idx < len(options):
                    selected = options[idx]
                else:
                    print(f"[WARN] Invalid choice, using default")
                    selected = options[0]
        except (ValueError, KeyboardInterrupt):
            print(f"[WARN] Invalid input, using default")
            selected = options[0]

        print(f"[OK] Selected: {selected['display']}")
        print()
        return selected["path"]

    def copy_project(self, force: bool = False, incremental: bool = False) -> bool:
        """
        Copy project to factory directory

        Args:
            force: Force copy even if not needed
            incremental: Only copy changed/new files (for existing directories)

        Returns:
            True if successful, False otherwise
        """
        factory_path = self.get_factory_path()

        # Check if we need to copy
        if not force:
            need_copy, changed_count, new_count = self.compare_files(factory_path)
            if not need_copy:
                print(f"[INFO] Factory directory up to date: {factory_path}")
                return True

        print(f"[FACTORY] Copying project to factory directory...")
        print(f"[FACTORY] Source: {self.project_root}")
        print(f"[FACTORY] Target: {factory_path}")

        if incremental and factory_path.exists():
            print(f"[FACTORY] Incremental mode: only copying changed/new files")
        else:
            print(f"[FACTORY] Full copy mode")

        try:
            # Create factory directory
            factory_path.mkdir(parents=True, exist_ok=True)

            # Copy files using os.walk (avoids symlink issues)
            copied_files = 0
            skipped_files = 0
            excluded_dirs = 0
            excluded_files = 0

            exclude_patterns = self.get_exclude_patterns()

            for root, dirs, files in os.walk(str(self.project_root), followlinks=False):
                root_path = Path(root)
                relative_root = root_path.relative_to(self.project_root)

                # Filter out excluded directories (modify dirs in-place to skip traversal)
                dirs_to_remove = []
                for dir_name in dirs:
                    dir_path = root_path / dir_name
                    if self.should_exclude(dir_path, self.project_root):
                        dirs_to_remove.append(dir_name)
                        excluded_dirs += 1

                for dir_name in dirs_to_remove:
                    dirs.remove(dir_name)

                # Copy files in current directory
                for file_name in files:
                    source_file = root_path / file_name

                    # Check if file should be excluded
                    if self.should_exclude(source_file, self.project_root):
                        excluded_files += 1
                        continue

                    # Calculate target path
                    relative_file = source_file.relative_to(self.project_root)
                    target_file = factory_path / relative_file

                    # Incremental mode: skip if file unchanged
                    if incremental and target_file.exists():
                        if source_file.stat().st_mtime <= target_file.stat().st_mtime:
                            skipped_files += 1
                            continue

                    # Create parent directory
                    target_file.parent.mkdir(parents=True, exist_ok=True)

                    # Copy file
                    try:
                        shutil.copy2(source_file, target_file)
                        copied_files += 1

                        if copied_files % 100 == 0:
                            print(f"[FACTORY] Copied {copied_files} files...")
                    except Exception as e:
                        print(f"[WARN] Failed to copy {relative_file}: {e}")
                        excluded_files += 1

            print(f"[OK] Factory copy completed:")
            print(f"     Copied: {copied_files} files")
            if incremental:
                print(f"     Skipped: {skipped_files} files (unchanged)")
            print(f"     Excluded: {excluded_dirs} directories, {excluded_files} files")
            print(f"     Target: {factory_path}")

            return True

        except Exception as e:
            print(f"[ERROR] Failed to copy to factory: {e}")
            traceback.print_exc()
            return False

    def setup_symlinks(self):
        """
        Prepare symlink/junction information for node_modules
        Shell will create junction/symlink - NO subprocess here
        """
        from global_var_manager import GlobalVarManager

        factory_path = self.get_factory_path()
        source_node_modules = self.project_root / "node_modules"
        factory_node_modules = factory_path / "node_modules"

        # Check if junction/symlink already exists using Python's is_symlink
        # (works for junctions on Windows via pathlib)
        is_junction = False
        if factory_node_modules.exists():
            try:
                is_junction = factory_node_modules.is_symlink()
            except:
                pass

        # Remove existing node_modules if it's not a junction/symlink
        if factory_node_modules.exists() and not is_junction:
            print(f"[INFO] Removing factory node_modules directory (will use junction)")
            shutil.rmtree(factory_node_modules)

        # Write junction creation info to file variables - Shell will execute
        if not factory_node_modules.exists():
            gvm = GlobalVarManager(namespace=None)
            gvm.set("JUNCTION_SOURCE", str(source_node_modules))
            gvm.set("JUNCTION_TARGET", str(factory_node_modules))
            gvm.set("JUNCTION_REQUIRED", "true")
            print(f"[INFO] Junction required: {factory_node_modules} -> {source_node_modules}")
        else:
            print(f"[OK] Using existing node_modules junction")

    def update_metro_config(self) -> bool:
        """
        Update metro config to watch source directory

        Returns:
            True if successful, False otherwise
        """
        metro_config_path = self.get_factory_path() / "metro.config.js"

        try:
            with open(metro_config_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Update watchFolders to include source app directory
            app_src_dir = self.project_root / "src" / "apps" / self.app_namespace
            watch_path = str(app_src_dir).replace('\\', '/')

            pattern = r"watchFolders:\s*\[([^\]]*)\]"
            replacement = f"watchFolders: [\n    path.resolve(__dirname, '{watch_path}'),\n  ]"
            new_content = re.sub(pattern, replacement, content)

            if new_content != content:
                with open(metro_config_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"[OK] Updated metro config to watch source: {app_src_dir}")
                return True

            return True

        except Exception as e:
            print(f"[WARN] Failed to update metro config: {e}")
            return False

def main():
    """Main entry point for testing"""
    # For debug testing: python factory_manager.py [project_root] <app_namespace>
    if len(sys.argv) >= 3:
        # Test mode: explicit parameters
        project_root = Path(sys.argv[1])
        app_namespace = sys.argv[2]
    elif len(sys.argv) >= 2:
        # Test mode: auto-detect project root, explicit app
        from project_locator import get_project_root
        project_root = get_project_root()
        app_namespace = sys.argv[1]
    else:
        print("[ERROR] Usage: python factory_manager.py [project_root] <app_namespace>")
        return

    manager = FactoryManager(project_root, app_namespace)

    print("=" * 60)
    print("Factory Manager Test")
    print("=" * 60)
    print(f"Project Root: {project_root}")
    print(f"App Namespace: {app_namespace}")
    print(f"Factory Path: {manager.get_factory_path()}")
    print("=" * 60)
    print()

    # Copy project
    if manager.copy_project():
        print()
        # Setup symlinks
        manager.setup_symlinks()
        print()
        # Update metro config
        manager.update_metro_config()

    print()
    print("=" * 60)
    print("Factory setup completed")
    print("=" * 60)


if __name__ == '__main__':
    main()
