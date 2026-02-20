#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recursively clean deeply nested directories (handles paths exceeding 260 characters)
Uses Windows UNC path format (\\?\\) to bypass MAX_PATH limitation
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

# Fix Windows console encoding issues
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def to_unc_path(path: Path) -> str:
    """Convert path to UNC format to support long paths"""
    abs_path = path.resolve()
    unc_path = str(abs_path)
    if not unc_path.startswith("\\\\?\\"):
        if unc_path.startswith("\\\\"):
            # Network path: \\server\share -> \\?\UNC\server\share
            unc_path = "\\\\?\\UNC\\" + unc_path[2:]
        else:
            # Local path: C:\path -> \\?\C:\path
            unc_path = "\\\\?\\" + unc_path
    return unc_path

def cleanup_with_robocopy(target_dir: Path) -> bool:
    """
    Use robocopy's empty directory sync feature to delete directory
    robocopy /MIR source_dir empty_dir will delete all contents of source directory
    """
    try:
        # Create a temporary empty directory
        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            target_unc = to_unc_path(target_dir)
            temp_unc = to_unc_path(temp_path)
            
            # robocopy /MIR syncs two directories to make source match target
            # If target is empty, all contents of source will be deleted
            cmd = [
                "robocopy",
                temp_unc,  # Empty directory (source)
                target_unc,  # Directory to clean (target)
                "/MIR",  # Mirror mode
                "/R:0",  # Retry 0 times
                "/W:0",  # Wait 0 seconds
                "/NFL",  # No file list
                "/NDL",  # No directory list
                "/NJH",  # No job header
                "/NJS",  # No job summary
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            # robocopy return codes: 0-7 are success, 8+ are errors
            if result.returncode >= 8:
                print(f"robocopy failed: {result.stderr}", file=sys.stderr)
                return False
            
            # Delete the empty directory itself
            try:
                os.rmdir(target_unc)
            except OSError:
                pass  # May already be deleted or still has content
            
            return True
    except Exception as e:
        print(f"robocopy cleanup failed: {e}", file=sys.stderr)
        return False

def cleanup_with_powershell(target_dir: Path) -> bool:
    """Use PowerShell to delete long path directory"""
    try:
        target_unc = to_unc_path(target_dir)
        ps_script = f'''
$ErrorActionPreference = "Stop"
$path = "{target_unc}"
if (Test-Path $path) {{
    Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
    Write-Host "Deleted: $path"
}} else {{
    Write-Host "Path does not exist: $path"
}}
'''
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if result.returncode != 0:
            print(f"PowerShell delete failed: {result.stderr}", file=sys.stderr)
            return False
        print(result.stdout)
        return True
    except Exception as e:
        print(f"PowerShell cleanup failed: {e}", file=sys.stderr)
        return False

def cleanup_with_python_unc(target_dir: Path) -> bool:
    """Use Python to directly delete via UNC path"""
    try:
        target_unc = to_unc_path(target_dir)
        import shutil
        shutil.rmtree(target_unc)
        return True
    except Exception as e:
        print(f"Python UNC delete failed: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Recursively clean deeply nested directories (supports long paths)")
    parser.add_argument("--path", type=str, required=True, help="Directory path to clean")
    parser.add_argument("--method", type=str, choices=["robocopy", "powershell", "python", "auto"], 
                       default="auto", help="Cleanup method (auto=automatically select best method)")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, do not actually delete")
    args = parser.parse_args()

    target_dir = Path(args.path)
    if not target_dir.exists():
        print(f"Directory does not exist: {target_dir}", file=sys.stderr)
        return 2
    if not target_dir.is_dir():
        print(f"Not a directory: {target_dir}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(f"[dry-run] Will clean directory: {target_dir}")
        print(f"UNC path: {to_unc_path(target_dir)}")
        try:
            count = 0
            for p in target_dir.rglob("*"):
                count += 1
                if count <= 20:  # Show only first 20
                    print(f"  {p}")
                elif count == 21:
                    print(f"  ... (more items)")
            print(f"Found approximately {count} items")
        except Exception as e:
            print(f"Cannot traverse directory (path may be too long): {e}")
        return 0

    # Select cleanup method
    method = args.method
    if method == "auto":
        # Auto-select: prefer robocopy (most reliable), then powershell
        import shutil
        if shutil.which("robocopy"):
            method = "robocopy"
        else:
            method = "powershell"
    
    print(f"Using {method} method to clean: {target_dir}")
    print(f"UNC path: {to_unc_path(target_dir)}")
    
    success = False
    if method == "robocopy":
        success = cleanup_with_robocopy(target_dir)
    elif method == "powershell":
        success = cleanup_with_powershell(target_dir)
    elif method == "python":
        success = cleanup_with_python_unc(target_dir)
    
    if success:
        print(f"✓ Cleanup completed: {target_dir}")
        return 0
    else:
        print(f"✗ Cleanup failed: {target_dir}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
