#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File validation module for win_common directory
"""

from pathlib import Path
from gitput_unified_modules.config import REQUIRED_WIN_COMMON_FILES
from gitput_unified_modules.utils import write_color_text, get_win_common_dir


def test_win_common_files() -> bool:
    """Validate win_common directory files"""
    write_color_text("=== Validating win_common directory files ===", "Yellow")
    
    win_common_dir = get_win_common_dir()
    missing_files = []
    existing_files = []
    
    for file in REQUIRED_WIN_COMMON_FILES:
        file_path = win_common_dir / file
        if file_path.exists():
            existing_files.append(file)
            write_color_text(f"[OK] Found: {file}", "Green")
        else:
            missing_files.append(file)
            write_color_text(f"[MISSING] Missing: {file}", "Red")
    
    print("")
    write_color_text("Validation Summary:", "Cyan")
    write_color_text(f"  Existing files: {len(existing_files)}", "Green")
    write_color_text(f"  Missing files: {len(missing_files)}", "Red")
    
    if missing_files:
        print("")
        write_color_text("WARNING: The following files are missing from win_common directory:", "Red")
        for missing_file in missing_files:
            write_color_text(f"  - {missing_file}", "Red")
        print("")
        write_color_text("Continuing with commit process despite missing files...", "Yellow")
    
    print("")
    return len(missing_files) == 0

