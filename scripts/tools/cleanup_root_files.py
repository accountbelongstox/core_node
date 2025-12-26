#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clean up redundant files from root directory
Move files to appropriate subdirectories
Delete empty/temporary files
"""
import os
import shutil
from pathlib import Path
import re
import sys
import io

# Set output encoding to UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ROOT_DIR = Path(__file__).parent.parent.parent

# Directories to create/use
LOGS_DIR = ROOT_DIR / "logs"
BUGREPORTS_DIR = LOGS_DIR / "bugreports"
API_TEST_RESULTS_DIR = ROOT_DIR / "scripts" / "testing" / "api_test_results"
DOCS_REPORTS_DIR = ROOT_DIR / "docs" / "reports"

def sanitize_filename(filename):
    """Convert invalid filename to valid alphanumeric filename"""
    # Remove invalid characters, keep alphanumeric, underscore, dash, dot
    sanitized = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    return sanitized

def ensure_directories():
    """Ensure target directories exist"""
    directories = [
        LOGS_DIR,
        BUGREPORTS_DIR,
        API_TEST_RESULTS_DIR,
        DOCS_REPORTS_DIR,
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"[DIR] Ensured directory exists: {directory}")

def delete_empty_files():
    """Delete empty and temporary files"""
    files_to_delete = [
        "nul",
        "CommonConfigModel",
        "SpeechConfigModel",
        "_delete",
        "_prompts",
        "temp.ts",
    ]
    
    deleted_count = 0
    for filename in files_to_delete:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            try:
                if file_path.stat().st_size == 0 or filename in ["nul", "temp.ts", "_delete", "_prompts"]:
                    file_path.unlink()
                    print(f"[DELETE] {filename}")
                    deleted_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to delete {filename}: {e}")
    
    return deleted_count

def move_log_files():
    """Move log files to logs/ directory"""
    files_to_move = [
        ("wget-log", LOGS_DIR),
        ("dd.cmd.error.txt", LOGS_DIR),
    ]
    
    moved_count = 0
    for filename, target_dir in files_to_move:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            target_path = target_dir / filename
            try:
                shutil.move(str(file_path), str(target_path))
                print(f"[MOVE] {filename} -> {target_dir.name}/")
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename}: {e}")
    
    return moved_count

def move_test_reports():
    """Move test reports to appropriate directories"""
    # Files to move to api_test_results
    api_test_files = [
        "api_test_report.json",
        "mcp_tools_test_report.json",
    ]
    
    # Files to move to docs/reports
    docs_report_files = [
        "corrupted_videos_report.json",
    ]
    
    # Files with invalid names that need renaming
    invalid_name_files = [
        "D?programingcore_noderemote_api_test_categories.json",
        "D?programingcore_noderemote_api_test_queue.json",
    ]
    
    moved_count = 0
    
    # Move API test files
    for filename in api_test_files:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            target_path = API_TEST_RESULTS_DIR / filename
            try:
                shutil.move(str(file_path), str(target_path))
                print(f"[MOVE] {filename} -> api_test_results/")
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename}: {e}")
    
    # Move docs report files
    for filename in docs_report_files:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            target_path = DOCS_REPORTS_DIR / filename
            try:
                shutil.move(str(file_path), str(target_path))
                print(f"[MOVE] {filename} -> docs/reports/")
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename}: {e}")
    
    # Handle invalid filename files
    for filename in invalid_name_files:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            # Sanitize filename
            sanitized_name = sanitize_filename(filename)
            target_path = API_TEST_RESULTS_DIR / sanitized_name
            
            try:
                # Rename and move
                shutil.move(str(file_path), str(target_path))
                print(f"[RENAME & MOVE] {filename} -> api_test_results/{sanitized_name}")
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename}: {e}")
    
    return moved_count

def move_archive_files():
    """Move archive files to logs/bugreports/"""
    archive_files = [
        "bugreport-sdk_gphone64_x86_64-BP41.250916.009.A1-2025-12-05-07-54-12.zip",
    ]
    
    moved_count = 0
    for filename in archive_files:
        file_path = ROOT_DIR / filename
        if file_path.exists():
            target_path = BUGREPORTS_DIR / filename
            try:
                shutil.move(str(file_path), str(target_path))
                print(f"[MOVE] {filename} -> logs/bugreports/")
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename}: {e}")
    
    return moved_count

def main():
    """Main cleanup function"""
    print("=" * 60)
    print("Root Directory File Cleanup")
    print("=" * 60)
    print()
    
    # Ensure directories exist
    ensure_directories()
    print()
    
    # Delete empty files
    print("[STEP 1] Deleting empty/temporary files...")
    deleted_count = delete_empty_files()
    print()
    
    # Move log files
    print("[STEP 2] Moving log files...")
    log_moved_count = move_log_files()
    print()
    
    # Move test reports
    print("[STEP 3] Moving test reports...")
    report_moved_count = move_test_reports()
    print()
    
    # Move archive files
    print("[STEP 4] Moving archive files...")
    archive_moved_count = move_archive_files()
    print()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Deleted: {deleted_count} files")
    print(f"Moved logs: {log_moved_count} files")
    print(f"Moved reports: {report_moved_count} files")
    print(f"Moved archives: {archive_moved_count} files")
    print(f"Total processed: {deleted_count + log_moved_count + report_moved_count + archive_moved_count} files")
    print()

if __name__ == "__main__":
    main()

