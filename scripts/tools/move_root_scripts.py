#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Move all scripts from root directory to appropriate subdirectories in scripts/
Except main scripts: dd.sh and dd.cmd
Delete empty scripts
Fix invalid filenames
"""
import os
import shutil
from pathlib import Path
import re

ROOT_DIR = Path(__file__).parent
SCRIPTS_DIR = ROOT_DIR / "scripts"

# Main scripts to keep in root
MAIN_SCRIPTS = {"dd.sh", "dd.cmd"}

# Directory mapping for script categories
SCRIPT_CATEGORIES = {
    # Fix/Patch scripts
    "fixes": [
        "fix_all_singletons.py",
        "remove_subprocess_imports.py",
        "add_subprocess_where_needed.py",
        "download_correct_server.py",
        "push_server_correct.py",
        "push_jar_all_devices_fixed.py",
        "push_server_all_devices_fixed.py",
    ],
    # Debug/Diagnostic scripts
    "debug": [
        "debug_server_simple.py",
        "debug_server_startup.py",
        "diagnose_offline_devices.py",
        "check_all_server_files.py",
    ],
    # Device management scripts
    "device_management": [
        "connect_devices.py",
        "reconnect_all_devices.py",
        "restart_adb.py",
        "restart_adbd_offline_devices.py",
        "usb_enable_network_adb.py",
        "verify_device_scrcpy.py",
        "verify_device_scrcpy_en.py",
    ],
    # Push/Deploy scripts
    "deployment": [
        "push_to_all_devices.py",
        "push_scrcpy_server.py",
        "push_scrcpy_server_all_devices.py",
        "push_jar_simple.py",
    ],
    # Download scripts
    "download": [
        "download_nsrcc.py",
    ],
    # Test scripts
    "testing": [
        "COMPLETE_TEST_GUIDE.py",
        "QUICK_TEST_GUIDE.py",
        "test_mcp_chrome_browser.py",
        "test_voice_subtitle.py",
        "test_voice_subtitle_image.py",
    ],
    # Tools/Utilities
    "tools": [
        "scan_large_files.py",
        "git_package_size_stats.py",
        "check_large_files.sh",
    ],
    # Core/PyCore scripts
    "pycore": [
        "pycore_module_caller.py",
        "pymain.py",
        "run_callmodule_service.py",
    ],
    # Shell scripts (root level utilities)
    "shells": [
        "135_setup_api_domains.sh",
    ],
}

def sanitize_filename(filename):
    """Convert invalid filename to valid alphanumeric filename"""
    # Remove invalid characters, keep alphanumeric, underscore, dash, dot
    sanitized = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    return sanitized

def find_script_category(filename):
    """Find which category a script belongs to"""
    for category, scripts in SCRIPT_CATEGORIES.items():
        if filename in scripts:
            return category
    
    # Default categories based on filename patterns
    name_lower = filename.lower()
    if 'test' in name_lower:
        return "testing"
    elif 'debug' in name_lower or 'diagnose' in name_lower or 'check' in name_lower:
        return "debug"
    elif 'fix' in name_lower or 'correct' in name_lower or 'remove' in name_lower or 'add_' in name_lower:
        return "fixes"
    elif 'push' in name_lower or 'deploy' in name_lower:
        return "deployment"
    elif 'download' in name_lower:
        return "download"
    elif 'device' in name_lower or 'adb' in name_lower or 'scrcpy' in name_lower or 'connect' in name_lower or 'restart' in name_lower or 'verify' in name_lower:
        return "device_management"
    elif 'scan' in name_lower or 'git_' in name_lower or 'stats' in name_lower:
        return "tools"
    elif filename.endswith('.sh'):
        return "shells"
    else:
        return "tools"

def move_scripts():
    """Move all scripts from root to appropriate subdirectories"""
    import sys
    import io
    # Set output encoding to UTF-8
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    
    moved_count = 0
    deleted_count = 0
    renamed_count = 0
    
    # Get all script files in root
    script_files = []
    for ext in ['.sh', '.py', '.bat', '.cmd', '.ps1']:
        script_files.extend(list(ROOT_DIR.glob(f'*{ext}')))
    
    for script_file in script_files:
        # Skip main scripts
        if script_file.name in MAIN_SCRIPTS:
            continue
        
        # Check if file is empty
        if script_file.stat().st_size == 0:
            try:
                print(f"[DELETE] Empty file: {script_file.name}")
            except:
                print(f"[DELETE] Empty file: (invalid filename)")
            script_file.unlink()
            deleted_count += 1
            continue
        
        # Sanitize filename if needed
        try:
            original_name = script_file.name
        except:
            # Handle files with invalid encoding in name
            original_name = str(script_file)
            original_name = os.path.basename(original_name)
        
        sanitized_name = sanitize_filename(original_name)
        
        if original_name != sanitized_name:
            try:
                print(f"[RENAME] {original_name} -> {sanitized_name}")
            except:
                print(f"[RENAME] (invalid name) -> {sanitized_name}")
            new_path = script_file.parent / sanitized_name
            script_file.rename(new_path)
            script_file = new_path
            renamed_count += 1
        
        # Determine target directory
        category = find_script_category(script_file.name)
        target_dir = SCRIPTS_DIR / category
        target_dir.mkdir(parents=True, exist_ok=True)
        
        target_path = target_dir / script_file.name
        
        # Handle name conflicts
        if target_path.exists():
            # Add number suffix
            base_name = script_file.stem
            extension = script_file.suffix
            counter = 1
            while target_path.exists():
                new_name = f"{base_name}_{counter}{extension}"
                target_path = target_dir / new_name
                counter += 1
            print(f"[WARNING] File exists, using: {target_path.name}")
        
        # Move file
        print(f"[MOVE] {script_file.name} -> scripts/{category}/")
        shutil.move(str(script_file), str(target_path))
        moved_count += 1
    
    print(f"\n[SUMMARY]")
    print(f"  Moved: {moved_count} files")
    print(f"  Deleted: {deleted_count} empty files")
    print(f"  Renamed: {renamed_count} files with invalid names")

if __name__ == "__main__":
    move_scripts()

