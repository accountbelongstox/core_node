#!/usr/bin/env python3
"""
Script to scan and delete backup files with pattern .backup_YYYYMMDD_HHMMSS
"""

import os
import re
import sys
from pathlib import Path

# Backup file pattern: .backup_数字_数字
# Example: .backup_20251129_112520
BACKUP_PATTERN = re.compile(r'\.backup_\d{8}_\d{6}$')

def format_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def scan_backup_files(scan_path):
    """Scan directory for backup files matching the pattern"""
    backup_files = []
    scan_path_obj = Path(scan_path)
    
    if not scan_path_obj.exists():
        print(f"[ERROR] Path does not exist: {scan_path}")
        return []
    
    for root, dirs, files in os.walk(scan_path):
        for file in files:
            if BACKUP_PATTERN.search(file):
                file_path = Path(root) / file
                backup_files.append(file_path)
    
    return backup_files

def main():
    """Main function"""
    scan_path = r"D:\programing\core_node"
    
    if len(sys.argv) > 1:
        scan_path = sys.argv[1]
    
    print("")
    print("=" * 60)
    print("Backup Files Cleanup Script")
    print("=" * 60)
    print("")
    print(f"[INFO] Scanning directory: {scan_path}")
    print("[INFO] Pattern: *.backup_YYYYMMDD_HHMMSS")
    print("")
    
    # Scan for backup files
    backup_files = scan_backup_files(scan_path)
    
    if not backup_files:
        print("[INFO] No backup files found matching the pattern.")
        print("")
        return 0
    
    print(f"[INFO] Found {len(backup_files)} backup file(s):")
    print("")
    
    # Display all found files
    for index, file_path in enumerate(backup_files, 1):
        try:
            relative_path = str(file_path.relative_to(scan_path)).replace("\\", "/")
            file_size = file_path.stat().st_size
            size_str = format_size(file_size)
            print(f"  [{index}] {relative_path} ({size_str})")
        except Exception as e:
            print(f"  [{index}] {file_path} (Error: {e})")
    
    print("")
    print("=" * 60)
    print("")
    
    # Ask for confirmation
    confirm = input(f"Delete all {len(backup_files)} backup file(s)? (y/N): ").strip()
    if confirm.lower() != 'y':
        print("[INFO] Operation cancelled.")
        print("")
        return 0
    
    print("")
    print("[INFO] Deleting all backup files...")
    print("")
    
    # Delete all files at once
    deleted_count = 0
    skipped_count = 0
    
    for file_path in backup_files:
        try:
            relative_path = str(file_path.relative_to(scan_path)).replace("\\", "/")
            file_path.unlink()
            print(f"  [DELETED] {relative_path}")
            deleted_count += 1
            
        except Exception as e:
            print(f"  [ERROR] Failed to delete: {relative_path}")
            print(f"          Error: {e}")
            skipped_count += 1
    
    print("")
    print("=" * 60)
    print("Summary:")
    print(f"  Deleted: {deleted_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total:   {len(backup_files)}")
    print("=" * 60)
    print("")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

