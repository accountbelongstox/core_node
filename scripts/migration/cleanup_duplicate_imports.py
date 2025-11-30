#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cleanup script to remove duplicate direct imports after migration

This script removes old direct imports that are duplicates of the new
getter function pattern.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Patterns to remove (direct imports that should now use getters)
DIRECT_IMPORT_PATTERNS = [
    r'^import numpy as np\s*$',
    r'^import numpy\s*$',
    r'^import cv2\s*$',
    r'^import torch\s*$',
    r'^import ultralytics\s*$',
    r'^import sklearn\s*$',
]


def has_getter_import(content: str) -> bool:
    """Check if file uses new getter pattern"""
    return 'get_third_package_' in content


def remove_duplicate_imports(content: str) -> Tuple[str, List[str]]:
    """
    Remove duplicate direct imports

    Args:
        content: File content

    Returns:
        (cleaned_content, removed_lines)
    """
    if not has_getter_import(content):
        return content, []

    lines = content.split('\n')
    removed = []
    new_lines = []

    for line in lines:
        should_remove = False
        for pattern in DIRECT_IMPORT_PATTERNS:
            if re.match(pattern, line.strip()):
                should_remove = True
                removed.append(line.strip())
                break

        if not should_remove:
            new_lines.append(line)

    return '\n'.join(new_lines), removed


def process_file(file_path: Path, dry_run: bool = False) -> bool:
    """
    Process a single file

    Args:
        file_path: Path to file
        dry_run: If True, only show changes without modifying

    Returns:
        True if file was modified
    """
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"[ERROR] Reading {file_path}: {e}")
        return False

    new_content, removed = remove_duplicate_imports(content)

    if not removed:
        return False

    if dry_run:
        print(f"\n{'='*70}")
        print(f"File: {file_path}")
        print(f"{'='*70}")
        print(f"Removed imports:")
        for line in removed:
            print(f"  - {line}")
        return True
    else:
        try:
            file_path.write_text(new_content, encoding='utf-8')
            print(f"[OK] Cleaned: {file_path}")
            print(f"      Removed: {', '.join(removed)}")
            return True
        except Exception as e:
            print(f"[ERROR] Writing {file_path}: {e}")
            return False


def find_files_to_clean(root_dir: Path) -> List[Path]:
    """Find all Python files that may have duplicate imports"""
    files = []

    for pattern in ['pycore/**/*.py', 'pyapps/**/*.py']:
        for file_path in root_dir.glob(pattern):
            if file_path.name == 'third_party.py':
                continue

            try:
                content = file_path.read_text(encoding='utf-8')
                if has_getter_import(content):
                    # Check if has any direct imports
                    for pattern in DIRECT_IMPORT_PATTERNS:
                        if re.search(pattern, content, re.MULTILINE):
                            files.append(file_path)
                            break
            except Exception:
                pass

    return sorted(files)


def main():
    """Main cleanup script"""
    import argparse

    parser = argparse.ArgumentParser(description='Cleanup duplicate imports')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without modifying')
    parser.add_argument('--file', type=str, help='Clean a specific file only')
    args = parser.parse_args()

    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"[ERROR] File not found: {file_path}")
            return 1

        success = process_file(file_path, dry_run=args.dry_run)
        return 0 if success else 1

    # Find all files to clean
    print("Scanning for files with duplicate imports...")
    files = find_files_to_clean(PROJECT_ROOT)
    print(f"Found {len(files)} files to clean\n")

    if args.dry_run:
        print("DRY RUN MODE - No files will be modified\n")

    # Process each file
    success_count = 0
    fail_count = 0

    for file_path in files:
        if process_file(file_path, dry_run=args.dry_run):
            success_count += 1
        else:
            fail_count += 1

    # Summary
    print(f"\n{'='*70}")
    print(f"Cleanup Summary")
    print(f"{'='*70}")
    print(f"Total files: {len(files)}")
    print(f"Successfully cleaned: {success_count}")
    print(f"Failed: {fail_count}")

    if args.dry_run:
        print(f"\nTo apply changes, run without --dry-run flag")

    return 0 if fail_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
