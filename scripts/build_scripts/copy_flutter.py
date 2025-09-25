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
import sys
import subprocess
import hashlib
import colorama
from datetime import datetime

colorama.init()

class Printer:
    """Utility class for formatted console output"""
    COLORS = {
        'info': colorama.Fore.BLUE,
        'warn': colorama.Fore.YELLOW,
        'error': colorama.Fore.RED,
        'success': colorama.Fore.GREEN,
        'debug': colorama.Fore.MAGENTA,
        'reset': colorama.Style.RESET_ALL
    }

    @staticmethod
    def _print(level: str, message: str):
        color = Printer.COLORS.get(level, Printer.COLORS['reset'])
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"{timestamp} {color}[{level.upper()}]{Printer.COLORS['reset']} {message}")

    @classmethod
    def info(cls, message: str): cls._print('info', message)
    @classmethod
    def warn(cls, message: str): cls._print('warn', message)
    @classmethod
    def error(cls, message: str): cls._print('error', message)
    @classmethod
    def success(cls, message: str): cls._print('success', message)
    @classmethod
    def debug(cls, message: str): cls._print('debug', message)

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RED = '\033[91m'
    ENDC = '\033[0m'

def print_status(status, message, color):
    """Print a GitHub-like status message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    # Pad status to 12 characters for alignment
    status_padded = f"{status:<12}"
    print(f"{timestamp} {color}{status_padded}{Colors.ENDC} {message}")

def calculate_md5(file_path):
    """Calculate MD5 hash of a file."""
    md5_hash = hashlib.md5()
    with open(file_path, "rb") as f:
        # Read the file in chunks to handle large files
        for chunk in iter(lambda: f.read(4096), b""):
            md5_hash.update(chunk)
    return md5_hash.hexdigest()

def copy_flutter_project(source_dir, dest_dir):
    # Statistics counters
    stats = {
        'new': 0,      # New files copied
        'modified': 0, # Files updated
        'skipped': 0,  # Files skipped (identical)
        'total': 0     # Total files processed
    }

    # Directories to exclude
    exclude_dirs = {
        '.git',
        '.dart_tool',
        'build',
        '.idea',
        '.vscode',
        '.pub-cache',
        '.pub',
        'ios/Pods',
        'android/.gradle',
        '.flutter-plugins-dependencies',
        '.packages',
        'pubspec.lock'
    }

    def should_copy(path):
        # Check if any part of the path contains excluded directories
        parts = path.split(os.sep)
        return not any(part in exclude_dirs for part in parts)

    try:
        # Initial scan
        Printer.info(f"Scanning source directory: {os.path.abspath(source_dir)}")
        files_to_process = []
        
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            rel_path = os.path.relpath(root, source_dir)
            
            if should_copy(rel_path):
                for file in files:
                    if file not in exclude_dirs:
                        src_file = os.path.abspath(os.path.join(root, file))
                        dest_root = os.path.abspath(os.path.join(dest_dir, rel_path))
                        dest_file = os.path.abspath(os.path.join(dest_root, file))
                        files_to_process.append((src_file, dest_file, dest_root, rel_path, file))
                        stats['total'] += 1

        Printer.info(f"Found {stats['total']} files to process")
        print("\n" + "="*100 + "\n")  # Separator line

        # Create destination directory if needed
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
            Printer.success(f"Created destination directory: {os.path.abspath(dest_dir)}")

        # Process files
        for src_file, dest_file, dest_root, rel_path, filename in files_to_process:
            # Ensure destination directory exists
            os.makedirs(dest_root, exist_ok=True)

            # Prepare detailed path information
            path_info = (
                f"\nSource: {src_file}\n"
                f"Dest:   {dest_file}\n"
                f"RelPath: {rel_path}/{filename}"
            )

            # Check if file exists and compare
            if os.path.exists(dest_file):
                src_md5 = calculate_md5(src_file)
                dest_md5 = calculate_md5(dest_file)
                
                if src_md5 == dest_md5:
                    Printer.info(f"Skipping identical file: {path_info}")
                    stats['skipped'] += 1
                else:
                    Printer.warn(f"Updating modified file: {path_info}")
                    shutil.copy2(src_file, dest_file)
                    stats['modified'] += 1
            else:
                Printer.success(f"Adding new file: {path_info}")
                shutil.copy2(src_file, dest_file)
                stats['new'] += 1

        # Print summary with separator lines
        print("\n" + "="*100)
        Printer.info("\nOperation Summary:")
        print("-"*100)
        print(f"Added:     {stats['new']} files")
        print(f"Modified:  {stats['modified']} files")
        print(f"Skipped:   {stats['skipped']} files")
        print(f"Total:     {stats['total']} files")
        print("-"*100 + "\n")

        Printer.success("All operations completed successfully!")
        return True

    except Exception as e:
        Printer.error(f"Process failed: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        Printer.error("Usage: python copy_flutter.py <source_dir> <dest_dir>")
        sys.exit(1)

    source_dir = sys.argv[1]
    dest_dir = sys.argv[2]

    success = copy_flutter_project(source_dir, dest_dir)
    sys.exit(0 if success else 1)
