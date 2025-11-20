#!/usr/bin/env python3
"""
File Operations Utility Class
Handles file copying, reading, and replacement operations for Flutter build system
"""

import os
import sys
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime
import hashlib
import fnmatch

class FileOperations:
    """Utility class for file operations with progress tracking and smart copying"""

    def __init__(self):
        self.copied_files = 0
        self.skipped_files = 0
        self.total_files = 0
        self.start_time = None
        self.cleaned_dirs = 0

    @staticmethod
    def get_default_exclude_patterns() -> Set[str]:
        """Get default patterns for directories and files to exclude during copying"""
        return {
            # Version control
            '.git', '.svn', '.hg',

            # Build and cache directories
            'build', '.build_dir', '.cache', 'cache',
            '.dart_tool', '.flutter-plugins', '.flutter-plugins-dependencies',

            # Package managers
            'node_modules', '__pycache__', '.pytest_cache',
            'vendor', 'packages',

            # IDE and editor
            '.vscode', '.idea', '.vs', '.atom', '.sublime-*',

            # Temporary files
            'tmp', 'temp', '.tmp', '.temp',

            # OS specific
            '.DS_Store', 'Thumbs.db', '.Trashes',
            'Desktop.ini', '.directory',

            # Backup files
            '*.bak', '*.backup', '*.old', '*.orig',

            # Compile factory directories (avoid copying into themselves)
            'compile_factory'
        }

    @staticmethod
    def should_exclude_file(file_name: str, exclude_patterns: Set[str]) -> bool:
        """Check if a file should be excluded based on exclude patterns"""
        for pattern in exclude_patterns:
            if fnmatch.fnmatch(file_name, pattern):
                return True
        return False

    @staticmethod
    def print_exclude_patterns(exclude_patterns: Set[str]):
        """Print the exclude patterns being used (for debugging)"""
        print("[FILE-EXCLUDE] Active exclusion patterns:")
        sorted_patterns = sorted(exclude_patterns)
        for i, pattern in enumerate(sorted_patterns, 1):
            print(f"  {i:2d}. {pattern}")
        print()

    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate MD5 hash of a file for comparison"""
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return ""

    def should_copy_file(self, source_file: Path, target_file: Path) -> bool:
        """Determine if file should be copied based on modification time and content"""
        if not target_file.exists():
            return True

        # Compare modification times
        source_mtime = source_file.stat().st_mtime
        target_mtime = target_file.stat().st_mtime

        if source_mtime > target_mtime:
            return True

        # If modification times are same, compare file hashes
        if source_mtime == target_mtime:
            source_hash = self.calculate_file_hash(source_file)
            target_hash = self.calculate_file_hash(target_file)
            return source_hash != target_hash

        return False

    def print_progress(self, current_file: str, total: int, current: int):
        """Print copy progress on same line"""
        progress_percent = (current / total * 100) if total > 0 else 0
        # Truncate long paths for display
        display_file = current_file[-60:] if len(current_file) > 60 else current_file
        if len(current_file) > 60:
            display_file = "..." + display_file

        print(f"\r[COPY-PROGRESS] {progress_percent:6.1f}% ({current:4d}/{total:4d}) {display_file}", end='', flush=True)

    def count_files_recursive(self, source_dir: Path, exclude_patterns: Set[str] = None) -> int:
        """Count total files to be copied for progress tracking"""
        if exclude_patterns is None:
            exclude_patterns = self.get_default_exclude_patterns()

        count = 0
        for root, dirs, files in os.walk(source_dir):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_patterns]

            # Count only files that are not excluded
            for file in files:
                if not self.should_exclude_file(file, exclude_patterns):
                    count += 1
        return count

    def copy_with_smart_overwrite(self, source_dir: Path, target_dir: Path,
                                 exclude_patterns: Set[str] = None) -> Dict[str, int]:
        """
        Copy directory with smart overwrite - only copy changed files
        Returns statistics about the copy operation
        """
        if exclude_patterns is None:
            exclude_patterns = self.get_default_exclude_patterns()

        self.start_time = datetime.now()
        self.copied_files = 0
        self.skipped_files = 0

        # Count total files for progress
        self.total_files = self.count_files_recursive(source_dir, exclude_patterns)
        current_file_index = 0

        print(f"[FILE-OPS] Starting smart copy operation")
        print(f"[FILE-OPS] Source: {source_dir}")
        print(f"[FILE-OPS] Target: {target_dir}")
        print(f"[FILE-OPS] Total files to process: {self.total_files}")
        self.print_exclude_patterns(exclude_patterns)

        # Ensure target directory exists
        target_dir.mkdir(parents=True, exist_ok=True)

        for root, dirs, files in os.walk(source_dir):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_patterns]

            # Create relative path
            rel_path = Path(root).relative_to(source_dir)
            target_root = target_dir / rel_path
            target_root.mkdir(parents=True, exist_ok=True)

            for file in files:
                # Skip excluded files
                if self.should_exclude_file(file, exclude_patterns):
                    continue

                current_file_index += 1
                source_file = Path(root) / file
                target_file = target_root / file

                # Update progress
                relative_file_path = str(source_file.relative_to(source_dir))
                self.print_progress(relative_file_path, self.total_files, current_file_index)

                if self.should_copy_file(source_file, target_file):
                    try:
                        shutil.copy2(source_file, target_file)
                        self.copied_files += 1
                    except Exception as e:
                        print(f"\n[FILE-ERROR] Failed to copy {relative_file_path}: {e}")
                else:
                    self.skipped_files += 1

        # Clear progress line and print summary
        print("\r" + " " * 120 + "\r", end='')  # Clear the progress line

        duration = datetime.now() - self.start_time
        print(f"[FILE-OPS] Copy operation completed in {duration.total_seconds():.2f} seconds")
        print(f"[FILE-OPS] Files copied: {self.copied_files}")
        print(f"[FILE-OPS] Files skipped: {self.skipped_files}")
        print(f"[FILE-OPS] Total processed: {self.total_files}")

        return {
            'copied': self.copied_files,
            'skipped': self.skipped_files,
            'total': self.total_files,
            'duration': duration.total_seconds()
        }

    def simple_copy(self, source_dir: Path, target_dir: Path,
                   exclude_patterns: Set[str] = None) -> Dict[str, int]:
        """
        Simple directory copy without overwrite logic - for initial copies
        """
        if exclude_patterns is None:
            exclude_patterns = self.get_default_exclude_patterns()

        self.start_time = datetime.now()
        self.copied_files = 0
        self.total_files = self.count_files_recursive(source_dir, exclude_patterns)
        current_file_index = 0

        print(f"[FILE-OPS] Starting initial copy operation")
        print(f"[FILE-OPS] Source: {source_dir}")
        print(f"[FILE-OPS] Target: {target_dir}")
        print(f"[FILE-OPS] Total files: {self.total_files}")
        self.print_exclude_patterns(exclude_patterns)

        # Ensure target directory exists
        target_dir.mkdir(parents=True, exist_ok=True)

        for root, dirs, files in os.walk(source_dir):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_patterns]

            # Create relative path
            rel_path = Path(root).relative_to(source_dir)
            target_root = target_dir / rel_path
            target_root.mkdir(parents=True, exist_ok=True)

            for file in files:
                # Skip excluded files
                if self.should_exclude_file(file, exclude_patterns):
                    continue

                current_file_index += 1
                source_file = Path(root) / file
                target_file = target_root / file

                # Update progress
                relative_file_path = str(source_file.relative_to(source_dir))
                self.print_progress(relative_file_path, self.total_files, current_file_index)

                try:
                    shutil.copy2(source_file, target_file)
                    self.copied_files += 1
                except Exception as e:
                    print(f"\n[FILE-ERROR] Failed to copy {relative_file_path}: {e}")

        # Clear progress line and print summary
        print("\r" + " " * 120 + "\r", end='')  # Clear the progress line

        duration = datetime.now() - self.start_time
        print(f"[FILE-OPS] Copy operation completed in {duration.total_seconds():.2f} seconds")
        print(f"[FILE-OPS] Files copied: {self.copied_files}")
        print(f"[FILE-OPS] Total files: {self.total_files}")

        return {
            'copied': self.copied_files,
            'total': self.total_files,
            'duration': duration.total_seconds()
        }

    def cleanup_empty_directories(self, root_dir: Path) -> int:
        """Clean up empty directories recursively"""
        if not root_dir.exists():
            return 0

        cleaned_count = 0
        print(f"[CLEANUP] Scanning for empty directories in {root_dir.name}...")

        # Walk from bottom to top to ensure we can remove parent dirs after children
        for root, dirs, files in os.walk(root_dir, topdown=False):
            for dir_name in dirs:
                dir_path = Path(root) / dir_name
                try:
                    # Check if directory is empty (no files and no subdirectories)
                    if dir_path.exists() and not any(dir_path.iterdir()):
                        dir_path.rmdir()
                        cleaned_count += 1
                        print(f"[CLEANUP] Removed empty directory: {dir_path.relative_to(root_dir)}")
                except (OSError, PermissionError):
                    # Skip directories we can't remove
                    pass

        self.cleaned_dirs = cleaned_count
        if cleaned_count > 0:
            print(f"[CLEANUP] Cleaned up {cleaned_count} empty directories")
        else:
            print(f"[CLEANUP] No empty directories found")

        return cleaned_count

    def check_compilation_flag(self, target_dir: Path) -> Dict[str, bool]:
        """Check compilation status flags in target directory"""
        flags = {
            'compiled': False,
            'build_success': False
        }

        if not target_dir.exists():
            return flags

        # Check for compilation completion flag
        compiled_flag = target_dir / ".compiled"
        flags['compiled'] = compiled_flag.exists()

        # Check for successful build flag
        build_success_flag = target_dir / ".build_success"
        flags['build_success'] = build_success_flag.exists()

        return flags

    def create_compilation_flags(self, target_dir: Path, stage: str = "compiled"):
        """Create compilation status flags"""
        try:
            target_dir.mkdir(parents=True, exist_ok=True)

            if stage == "compiled":
                compiled_flag = target_dir / ".compiled"
                compiled_flag.touch()
                print(f"[BUILD-FLAG] Created compilation flag: {compiled_flag}")

            elif stage == "success":
                success_flag = target_dir / ".build_success"
                success_flag.touch()
                print(f"[BUILD-FLAG] Created build success flag: {success_flag}")

        except Exception as e:
            print(f"[BUILD-ERROR] Failed to create compilation flag: {e}")