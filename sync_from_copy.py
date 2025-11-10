#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sync updated files from core_node_copy to core_node

Scans D:\programing\core_node_copy and compares with D:\programing\core_node.
Lists files that need to be updated (target doesn't exist, newer modification time,
or different file size), waits for user confirmation, then copies them to core_node,
skipping node_modules directory.
"""

import os
import shutil
from pathlib import Path
from datetime import datetime


def should_skip_path(path: Path, skip_dirs: list = None) -> bool:
    """Check if path should be skipped."""
    if skip_dirs is None:
        skip_dirs = ['node_modules']
    
    parts = path.parts
    for skip_dir in skip_dirs:
        if skip_dir in parts:
            return True
    return False


def get_file_mtime(path: Path) -> float:
    """Get file modification time, return 0 if file doesn't exist."""
    try:
        return path.stat().st_mtime
    except (OSError, FileNotFoundError):
        return 0


def get_file_size(path: Path) -> int:
    """Get file size, return 0 if file doesn't exist."""
    try:
        return path.stat().st_size
    except (OSError, FileNotFoundError):
        return 0


def scan_directory(source_dir: Path, target_dir: Path, skip_dirs: list = None) -> list:
    """
    Scan source directory and find files that need to be updated.
    
    Files are updated if:
    - Target doesn't exist
    - Source has newer modification time
    - File sizes are different
    
    Returns list of tuples: (source_path, target_path, source_mtime, target_mtime, source_size, target_size, reason)
    """
    updated_files = []
    
    if not source_dir.exists():
        print(f"Error: Source directory does not exist: {source_dir}")
        return updated_files
    
    if not target_dir.exists():
        print(f"Warning: Target directory does not exist: {target_dir}")
        print("All files in source will be considered as new.")
    
    # Walk through source directory
    for root, dirs, files in os.walk(source_dir):
        root_path = Path(root)
        
        # Filter out skip directories
        dirs[:] = [d for d in dirs if not should_skip_path(root_path / d, skip_dirs)]
        
        for file in files:
            source_file = root_path / file
            
            # Skip if in skip directory
            if should_skip_path(source_file, skip_dirs):
                continue
            
            # Calculate relative path from source root
            try:
                rel_path = source_file.relative_to(source_dir)
            except ValueError:
                continue
            
            target_file = target_dir / rel_path
            
            # Get modification times and sizes
            source_mtime = get_file_mtime(source_file)
            target_mtime = get_file_mtime(target_file)
            source_size = get_file_size(source_file)
            target_size = get_file_size(target_file)
            
            # Determine if file needs to be updated
            reasons = []
            if target_mtime == 0:
                # Target doesn't exist
                reasons.append("Not exists")
            elif source_mtime > target_mtime:
                # Source has newer modification time
                reasons.append("Newer modification time")
            
            # Check file size difference (even if target exists and mtime is same or older)
            if target_size > 0 and source_size != target_size:
                reasons.append("Different file size")
            
            if reasons:
                reason = ", ".join(reasons)
                updated_files.append((source_file, target_file, source_mtime, target_mtime, source_size, target_size, reason))
    
    return updated_files


def format_file_info(source_path: Path, target_path: Path, source_mtime: float, target_mtime: float, 
                     source_size: int, target_size: int, reason: str, source_dir: Path) -> str:
    """Format file information for display."""
    try:
        rel_path = source_path.relative_to(source_dir)
    except ValueError:
        rel_path = source_path
    
    source_time = datetime.fromtimestamp(source_mtime).strftime('%Y-%m-%d %H:%M:%S') if source_mtime > 0 else 'N/A'
    target_time = datetime.fromtimestamp(target_mtime).strftime('%Y-%m-%d %H:%M:%S') if target_mtime > 0 else 'Not exists'
    
    def format_size(size: int) -> str:
        if size < 1024:
            return f"{size:,} bytes"
        elif size < 1024 * 1024:
            return f"{size / 1024:.2f} KB"
        else:
            return f"{size / (1024 * 1024):.2f} MB"
    
    source_size_str = format_size(source_size)
    target_size_str = format_size(target_size) if target_size > 0 else "N/A"
    
    return f"  {rel_path}\n    Reason: {reason}\n    Source: {source_time} ({source_size_str}) | Target: {target_time} ({target_size_str})"


def copy_file(source: Path, target: Path) -> bool:
    """Copy file from source to target, creating parent directories if needed."""
    try:
        # Create parent directories if they don't exist
        target.parent.mkdir(parents=True, exist_ok=True)
        
        # Copy file
        shutil.copy2(source, target)
        return True
    except Exception as e:
        print(f"    Error copying {source}: {e}")
        return False


def main():
    """Main function."""
    source_dir = Path(r"D:\programing\core_node_copy")
    target_dir = Path(r"D:\programing\core_node")
    skip_dirs = ['node_modules']
    
    print("=" * 70)
    print("File Sync Script: core_node_copy -> core_node")
    print("=" * 70)
    print(f"Source: {source_dir}")
    print(f"Target: {target_dir}")
    print(f"Skipping directories: {', '.join(skip_dirs)}")
    print("=" * 70)
    print()
    
    # Scan for updated files
    print("Scanning for updated files...")
    updated_files = scan_directory(source_dir, target_dir, skip_dirs)
    
    if not updated_files:
        print("No updated files found. All files are up to date.")
        return
    
    # Display found files
    print(f"\nFound {len(updated_files)} file(s) that need to be updated:\n")
    for i, (source, target, source_mtime, target_mtime, source_size, target_size, reason) in enumerate(updated_files, 1):
        print(f"{i}. {format_file_info(source, target, source_mtime, target_mtime, source_size, target_size, reason, source_dir)}")
    
    print("\n" + "=" * 70)
    print(f"Total: {len(updated_files)} file(s) to be copied")
    print("=" * 70)
    
    # Ask for confirmation
    print("\nDo you want to proceed with copying these files?")
    response = input("Type 'yes' to confirm, anything else to cancel: ").strip().lower()
    
    if response != 'yes':
        print("Operation cancelled.")
        return
    
    # Copy files
    print("\nCopying files...")
    success_count = 0
    error_count = 0
    
    for source, target, source_mtime, target_mtime, source_size, target_size, reason in updated_files:
        rel_path = source.relative_to(source_dir)
        print(f"Copying: {rel_path} (Reason: {reason})")
        
        if copy_file(source, target):
            success_count += 1
            print(f"  ✓ Success")
        else:
            error_count += 1
            print(f"  ✗ Failed")
    
    # Summary
    print("\n" + "=" * 70)
    print("Sync Summary:")
    print(f"  Successfully copied: {success_count}")
    print(f"  Failed: {error_count}")
    print(f"  Total: {len(updated_files)}")
    print("=" * 70)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperation interrupted by user.")
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()

