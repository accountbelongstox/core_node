#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migration script to update third_party imports to lazy loading pattern

This script updates all files that import from third_party to use the new
lazy loading getter functions.

Old pattern:
    from pycore.pyfoundations.third_party.api import get_third_package_torch, get_third_package_cv2

torch = get_third_package_torch()
cv2 = get_third_package_cv2()
    result = torch.zeros(10)

New pattern:
    from pycore.pyfoundations.third_party.api import get_third_package_torch, get_third_package_cv2
    torch = get_third_package_torch()
    cv2 = get_third_package_cv2()
    result = torch.zeros(10)
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Set, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Package name mapping: old_name -> getter_function_name
PACKAGE_MAPPING = {
    'aiohttp': 'get_third_package_aiohttp',
    'netifaces': 'get_third_package_netifaces',
    'websockets': 'get_third_package_websockets',
    'requests': 'get_third_package_requests',
    'uvicorn': 'get_third_package_uvicorn',
    'fastapi': 'get_third_package_fastapi',
    'PIL': 'get_third_package_PIL',
    'PIL_Image': 'get_third_package_PIL_Image',
    'PIL_ImageDraw': 'get_third_package_PIL_ImageDraw',
    'PIL_ImageFont': 'get_third_package_PIL_ImageFont',
    'cv2': 'get_third_package_cv2',
    'pyautogui': 'get_third_package_pyautogui',
    'psutil': 'get_third_package_psutil',
    'mss': 'get_third_package_mss',
    'torch': 'get_third_package_torch',
    'ultralytics': 'get_third_package_ultralytics',
    'numpy': 'get_third_package_numpy',
    'np': 'get_third_package_numpy',  # numpy alias
    'adb_shell': 'get_third_package_adb_shell',
    'av': 'get_third_package_av',
    'loguru': 'get_third_package_loguru',
    'yaml': 'get_third_package_yaml',
    'webview': 'get_third_package_webview',
    'tkinterweb': 'get_third_package_tkinterweb',
    'tkhtmlview': 'get_third_package_tkhtmlview',
    'pystray': 'get_third_package_pystray',
    'cnocr': 'get_third_package_cnocr',
    'pynput': 'get_third_package_pynput',
    'pypdf': 'get_third_package_pypdf',
    'pdfplumber': 'get_third_package_pdfplumber',
    'docx': 'get_third_package_docx',
    'python_docx': 'get_third_package_python_docx',
    'openpyxl': 'get_third_package_openpyxl',
    'pptx': 'get_third_package_pptx',
    'python_pptx': 'get_third_package_python_pptx',
    'sklearn': 'get_third_package_sklearn',
    'sqlalchemy': 'get_third_package_sqlalchemy',
    'fastmcp': 'get_third_package_fastmcp',
    'FastMCP': 'get_third_package_FastMCP',
    'Context': 'get_third_package_Context',
    'speechsdk': 'get_third_package_speechsdk',
    'edge_tts': 'get_third_package_edge_tts',
    'pyaudio': 'get_third_package_pyaudio',
    'win32gui': 'get_third_package_win32gui',
    'win32con': 'get_third_package_win32con',
    'win32api': 'get_third_package_win32api',
    'win32ui': 'get_third_package_win32ui',
    'pywinauto': 'get_third_package_pywinauto',
    'pygetwindow': 'get_third_package_pygetwindow',
    'uiautomation': 'get_third_package_uiautomation',
    'pyaudiowpatch': 'get_third_package_pyaudiowpatch',
}


def find_import_line(content: str) -> Tuple[str, int, int]:
    """
    Find the import line from third_party

    Returns:
        (import_line, start_pos, end_pos)
    """
    pattern = r'from pycore\.pyfoundations\.third_party import ([^\n]+)'
    match = re.search(pattern, content)
    if match:
        return match.group(0), match.start(), match.end()
    return None, -1, -1


def parse_imports(import_line: str) -> List[Tuple[str, str]]:
    """
    Parse import statement to extract package names and aliases

    Args:
        import_line: e.g. "from pycore.pyfoundations.third_party.api import torch, numpy as np"

    Returns:
        List of (package_name, alias) tuples
        e.g. [('torch', 'torch'), ('numpy', 'np')]
    """
    # Extract the imports part after "import"
    match = re.search(r'import\s+(.+)', import_line)
    if not match:
        return []

    imports_str = match.group(1)
    imports = []

    # Split by comma
    for item in imports_str.split(','):
        item = item.strip()

        # Check for "as" alias
        if ' as ' in item:
            package, alias = item.split(' as ')
            imports.append((package.strip(), alias.strip()))
        else:
            imports.append((item.strip(), item.strip()))

    return imports


def generate_new_import(imports: List[Tuple[str, str]]) -> str:
    """
    Generate new import statement using getter functions

    Args:
        imports: List of (package_name, alias) tuples

    Returns:
        New import statement
    """
    getter_funcs = []

    for package, alias in imports:
        if package in PACKAGE_MAPPING:
            getter_funcs.append(PACKAGE_MAPPING[package])
        else:
            print(f"Warning: Unknown package '{package}' - skipping")

    if not getter_funcs:
        return None

    return f"from pycore.pyfoundations.third_party.api import {', '.join(getter_funcs)}"


def generate_package_assignment(imports: List[Tuple[str, str]]) -> str:
    """
    Generate package assignment statements

    Args:
        imports: List of (package_name, alias) tuples

    Returns:
        Assignment statements as a string with proper spacing
    """
    assignments = []

    for package, alias in imports:
        if package in PACKAGE_MAPPING:
            getter_func = PACKAGE_MAPPING[package]
            assignments.append(f"{alias} = {getter_func}()")

    if not assignments:
        return ""

    # Add blank line before assignments to separate from imports
    return "\n" + "\n".join(assignments)


def update_file(file_path: Path, dry_run: bool = False) -> bool:
    """
    Update a single file with new import pattern

    Args:
        file_path: Path to file
        dry_run: If True, only print changes without modifying file

    Returns:
        True if file was modified, False otherwise
    """
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False

    # Find import line
    import_line, start_pos, end_pos = find_import_line(content)
    if not import_line:
        return False

    # Parse imports
    imports = parse_imports(import_line)
    if not imports:
        print(f"Warning: Could not parse imports in {file_path}")
        return False

    # Generate new import
    new_import = generate_new_import(imports)
    if not new_import:
        print(f"Warning: Could not generate new import for {file_path}")
        return False

    # Generate package assignments
    assignments = generate_package_assignment(imports)

    # Create new import block
    new_block = f"{new_import}\n{assignments}"

    # Replace old import with new import block
    new_content = content[:start_pos] + new_block + content[end_pos:]

    if dry_run:
        print(f"\n{'='*70}")
        print(f"File: {file_path}")
        print(f"{'='*70}")
        print(f"Old import:\n  {import_line}")
        print(f"\nNew import:\n  {new_import}")
        print(f"  {assignments}")
        return True
    else:
        try:
            file_path.write_text(new_content, encoding='utf-8')
            print(f"[OK] Updated: {file_path}")
            return True
        except Exception as e:
            print(f"[ERROR] Writing {file_path}: {e}")
            return False


def find_files_to_update(root_dir: Path) -> List[Path]:
    """
    Find all Python files that import from third_party

    Args:
        root_dir: Root directory to search

    Returns:
        List of file paths
    """
    files = []

    # Search in pycore and pyapps
    for pattern in ['pycore/**/*.py', 'pyapps/**/*.py', 'scripts/**/*.py']:
        for file_path in root_dir.glob(pattern):
            # Skip third_party.py itself
            if file_path.name == 'third_party.py':
                continue

            # Check if file imports from third_party
            try:
                content = file_path.read_text(encoding='utf-8')
                if 'from pycore.pyfoundations.third_party import' in content:
                    files.append(file_path)
            except Exception:
                pass

    return sorted(files)


def main():
    """Main migration script"""
    import argparse

    parser = argparse.ArgumentParser(description='Migrate third_party imports to lazy loading')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without modifying files')
    parser.add_argument('--file', type=str, help='Update a specific file only')
    args = parser.parse_args()

    if args.file:
        # Update single file
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return 1

        success = update_file(file_path, dry_run=args.dry_run)
        return 0 if success else 1

    # Find all files to update
    print("Scanning for files to update...")
    files = find_files_to_update(PROJECT_ROOT)
    print(f"Found {len(files)} files to update\n")

    if args.dry_run:
        print("DRY RUN MODE - No files will be modified\n")

    # Update each file
    success_count = 0
    fail_count = 0

    for file_path in files:
        if update_file(file_path, dry_run=args.dry_run):
            success_count += 1
        else:
            fail_count += 1

    # Summary
    print(f"\n{'='*70}")
    print(f"Migration Summary")
    print(f"{'='*70}")
    print(f"Total files: {len(files)}")
    print(f"Successfully updated: {success_count}")
    print(f"Failed: {fail_count}")

    if args.dry_run:
        print(f"\nTo apply changes, run without --dry-run flag")

    return 0 if fail_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
