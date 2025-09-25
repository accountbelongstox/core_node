# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import os
import shutil
from pathlib import Path
from typing import Optional, Dict, List
import hashlib
import fnmatch
import logging
from datetime import datetime
from provider.build_provider import FLUTTER_SKIP_PATTERNS
from tools.pyprint import Print

class BPFileOperations:
    """
    A utility class for file and directory operations.
    Provides methods for smart directory copying with file comparison.
    """
    
    class CopyStats:
        """Class to store copy statistics"""
        def __init__(self):
            self.copied = 0
            self.skipped = 0
            self.failed = 0
            self.total_files = 0
            self.errors = []

    @staticmethod
    def calculate_file_hash(file_path: str) -> str:
        """
        Calculate the MD5 hash of a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MD5 hash of the file content
        """
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    @staticmethod
    def _print_stats(stats: 'BPFileOperations.CopyStats') -> None:
        """
        Print current copy statistics on a single line
        """
        Print.print_single_line_info(
            f"Total files processed: {stats.total_files} | "
            f"Files copied: {stats.copied} | "
            f"Files skipped: {stats.skipped} | "
            f"Files failed: {stats.failed}"
        )

    @staticmethod
    def copy_directory_with_comparison(src_dir: str, dest_dir: str, 
                                      ignore_patterns: Optional[list] = None,
                                      verbose: bool = True) -> Dict[str, int]:
        """
        Copy a directory to another location with smart file comparison.
        Only copies files that have been modified or don't exist in destination.
        Skips files and directories matching ignore_patterns (supports wildcards like .cursor*, build*, etc).
        Directories matching skip patterns are not created in the destination.
        """
        src_path = Path(src_dir)
        dest_path = Path(dest_dir)
        stats = BPFileOperations.CopyStats()
        
        if not src_path.exists():
            raise ValueError(f"Source directory {src_dir} does not exist")

        if not dest_path.exists():
            dest_path.mkdir(parents=True, exist_ok=True)
        skip_count = 0
        copy_count = 0
        create_dir_count = 0
        size_mismatch_count = 0
        newer_count = 0
        up_to_date_count = 0
        failed_count = 0
        total_count = 0

        Print.info(f"\nStarting directory copy from {src_dir} to {dest_dir}")
        Print.info("=" * 80)

        def should_skip(rel_path: Path, patterns: list) -> bool:
            # Check all parts of the path for pattern matches
            rel_str = str(rel_path)
            for pattern in patterns:
                # Match against each part of the path and the full path
                if fnmatch.fnmatch(rel_str, pattern):
                    return True
                for part in rel_path.parts:
                    if fnmatch.fnmatch(part, pattern):
                        return True
            return False

        try:
            for item in src_path.glob('**/*'):
                rel_path = item.relative_to(src_path)
                dest_item = dest_path / rel_path
                stats.total_files += 1

                # Skip ignored files and directories (including directories before creation)
                if ignore_patterns and should_skip(rel_path, ignore_patterns):
                    if verbose:
                        skip_count += 1
                        pass
                    continue

                # Only create destination directories if not skipped
                if item.is_dir():
                    dest_item.mkdir(parents=True, exist_ok=True)
                    if verbose:
                        create_dir_count += 1
                    continue

                try:
                    # If destination file doesn't exist, copy it
                    if not dest_item.exists():
                        shutil.copy2(item, dest_item)
                        stats.copied += 1
                        if verbose:
                            copy_count += 1
                        continue

                    # Compare file sizes first
                    if item.stat().st_size != dest_item.stat().st_size:
                        shutil.copy2(item, dest_item)
                        stats.copied += 1
                        if verbose:
                            size_mismatch_count += 1
                        continue

                    # If sizes are equal, compare modification times
                    if item.stat().st_mtime > dest_item.stat().st_mtime:
                        shutil.copy2(item, dest_item)
                        stats.copied += 1
                        if verbose:
                            newer_count += 1
                        continue

                    # Skip if file exists and is up to date
                    stats.skipped += 1
                    if verbose:
                        up_to_date_count += 1

                except Exception as e:
                    stats.failed += 1
                    stats.errors.append(f"Error copying {rel_path}: {str(e)}")
                    if verbose:
                        failed_count += 1

                # Update statistics display
                BPFileOperations._print_stats(stats)

            # Print final summary
            print("\nCopy operation completed")
            print("=" * 80)
            
            if stats.failed > 0:
                print("\nFailed files:")
                for error in stats.errors:
                    print(f"- {error}")

            Print.info(f"Total files processed: {stats.total_files}")
            Print.info(f"Files copied: {stats.copied}")
            Print.info(f"Files skipped: {stats.skipped}")
            Print.info(f"Files failed: {stats.failed}")
            Print.info(f"Errors: {stats.errors}")

            return {
                'total': stats.total_files,
                'copied': stats.copied,
                'skipped': stats.skipped,
                'failed': stats.failed,
                'errors': stats.errors
            }

        except Exception as e:
            print(f"\nCritical error: {str(e)}")
            raise

    @staticmethod
    def remove_empty_directories(path: str) -> None:
        """
        Recursively remove empty directories.
        
        Args:
            path: Directory path to start from
        """
        path = Path(path)
        for item in path.glob('**/*'):
            if item.is_dir() and not any(item.iterdir()):
                item.rmdir()

    @staticmethod
    def copy_flutter_directory(src_dir: str, dest_dir: str, 
                             additional_skip_patterns: Optional[List[str]] = None,
                             verbose: bool = True) -> Dict[str, int]:
        """
        Copy a Flutter project directory while skipping common unnecessary directories and files.
        Skips files and directories matching FLUTTER_SKIP_PATTERNS and additional patterns (supports wildcards like .cursor*, build*, etc).
        
        Args:
            src_dir: Source Flutter project directory path
            dest_dir: Destination directory path
            additional_skip_patterns: Optional list of additional patterns to skip
            verbose: If True, prints detailed progress information
            
        Returns:
            Dictionary with copy statistics
        """
        # Combine default Flutter skip patterns with additional patterns
        skip_patterns = FLUTTER_SKIP_PATTERNS.copy()
        if additional_skip_patterns:
            skip_patterns.extend(additional_skip_patterns)
        print("\nStarting Flutter project copy")
        return BPFileOperations.copy_directory_with_comparison(src_dir, dest_dir, skip_patterns, verbose)

# Example usage:
if __name__ == "__main__":
    # Example of using the copy_directory_with_comparison method
    src_dir = "path/to/source"
    dest_dir = "path/to/destination"
    
    # Copy with default settings (copies all files)
    BPFileOperations.copy_directory_with_comparison(src_dir, dest_dir)
    
    # Copy with ignore patterns (e.g., ignore .git and temp files)
    ignore_patterns = ['.git*', '*.tmp', '*.bak']
    BPFileOperations.copy_directory_with_comparison(src_dir, dest_dir, ignore_patterns)