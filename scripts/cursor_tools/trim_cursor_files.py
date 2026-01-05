#!/usr/bin/env python3

"""
Trim Cursor Files Script
=========================
Scans all cursor_*.md files under core_node directory and trims them to last 2000 lines
if they exceed 2000 lines.

Author: Auto-generated
Date: 2026-01-05
"""

import os
import sys
import argparse
from pathlib import Path
from typing import List, Tuple
import tempfile
import shutil

# ANSI Color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

# Directories to skip during recursive scan
SKIP_DIRS = {
    # Node.js
    'node_modules',
    '.npm',
    '.yarn',
    '.pnp',
    'bower_components',
    'jspm_packages',

    # Build/Dist directories
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.output',
    '.turbo',
    '.vitepress',
    '.docusaurus',
    '_site',

    # Python
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',
    '.nox',
    'venv',
    'env',
    '.venv',
    '.env',
    'site-packages',
    '.eggs',
    '*.egg-info',
    'htmlcov',
    'coverage',
    '.coverage',

    # PHP/Laravel
    'vendor',
    'storage',
    'bootstrap',
    '.phpunit.cache',
    '.phpunit.result.cache',

    # Dart/Flutter
    '.dart_tool',
    '.flutter-plugins',
    '.flutter-plugins-dependencies',
    'android',
    'ios',

    # Mobile development
    'Pods',
    '.gradle',

    # Rust
    'target',

    # Go
    'pkg',
    'bin',

    # Version control
    '.git',
    '.svn',
    '.hg',
    '.gitignore',

    # IDEs
    '.idea',
    '.vscode',
    '.vs',
    '.eclipse',
    '.settings',

    # Bundlers/Packagers cache
    '.parcel-cache',
    '.webpack',
    '.rollup.cache',

    # Infrastructure/DevOps
    '.terraform',
    '.serverless',
    '.vagrant',
    '.ansible',

    # Cache directories
    '.cache',
    'cache',
    '.tmp',
    'tmp',
    'temp',

    # Logs
    'logs',
    'log',

    # Static assets (unlikely to have cursor_*.md)
    'public',
    'static',
    'assets',
    'uploads',
    'media',
    'images',
    'img',
    'fonts',

    # Database
    'db',
    'database',
    'migrations',

    # Others
    '.DS_Store',
    'Thumbs.db',
    '.sass-cache',
    '.less-cache',
}

class FileStats:
    """Statistics for file processing"""
    def __init__(self):
        self.total_files = 0
        self.processed_files = 0
        self.skipped_files = 0
        self.error_files = 0
        self.total_lines_removed = 0
        self.total_size_saved = 0

def print_header(message: str):
    """Print a header message"""
    print(f"{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{message}{Colors.RESET}")
    print(f"{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print()

def print_info(message: str):
    """Print an info message"""
    print(f"{Colors.CYAN}{message}{Colors.RESET}")

def print_success(message: str):
    """Print a success message"""
    print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")

def print_warning(message: str):
    """Print a warning message"""
    print(f"{Colors.YELLOW}→ {message}{Colors.RESET}")

def print_error(message: str):
    """Print an error message"""
    print(f"{Colors.RED}✗ {message}{Colors.RESET}")

def should_skip_dir(dir_name: str) -> bool:
    """Check if directory should be skipped"""
    return dir_name in SKIP_DIRS

def find_cursor_files(root_dir: Path) -> List[Path]:
    """
    Recursively find all cursor_*.md files under root_dir
    Skip directories in SKIP_DIRS
    """
    cursor_files = []

    for root, dirs, files in os.walk(root_dir):
        # Remove directories to skip from the walk
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]

        # Find cursor_*.md files
        for file in files:
            if file.startswith('cursor_') and file.endswith('.md'):
                file_path = Path(root) / file
                cursor_files.append(file_path)

    return cursor_files

def count_lines(file_path: Path) -> int:
    """Count the number of lines in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception as e:
        print_error(f"Failed to count lines in {file_path.name}: {e}")
        return 0

def get_file_size(file_path: Path) -> int:
    """Get file size in bytes"""
    try:
        return file_path.stat().st_size
    except Exception:
        return 0

def format_size(size_bytes: int) -> str:
    """Format size in bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def trim_file(file_path: Path, keep_lines: int, min_lines: int, stats: FileStats) -> bool:
    """
    Trim file to keep only the last keep_lines lines if file has more than min_lines

    Args:
        file_path: Path to the file to trim
        keep_lines: Number of lines to keep from the end
        min_lines: Minimum lines required to trigger trimming
        stats: Statistics object to update

    Returns:
        True if file was trimmed, False otherwise
    """
    stats.total_files += 1

    # Get relative path for display
    try:
        rel_path = file_path.relative_to(Path.cwd())
    except ValueError:
        rel_path = file_path

    print(f"{Colors.BLUE}Processing: {rel_path}{Colors.RESET}")

    # Check if file is readable
    if not file_path.is_file() or not os.access(file_path, os.R_OK):
        print_error(f"Skipped: Not readable")
        stats.skipped_files += 1
        print()
        return False

    # Count lines
    line_count = count_lines(file_path)
    if line_count == 0:
        print_error(f"Skipped: Could not read file")
        stats.error_files += 1
        print()
        return False

    print(f"  Current lines: {line_count}")

    # Check if trimming is needed
    if line_count <= min_lines:
        print_warning(f"Skipped (≤ {min_lines} lines, no need to trim)")
        stats.skipped_files += 1
        print()
        return False

    # Get original file size
    original_size = get_file_size(file_path)

    try:
        # Read last keep_lines lines
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        last_lines = lines[-keep_lines:]

        # Write to temporary file
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False,
                                          suffix='.tmp', dir=file_path.parent) as tmp_file:
            tmp_path = Path(tmp_file.name)
            tmp_file.writelines(last_lines)

        # Verify temporary file
        new_line_count = count_lines(tmp_path)

        if new_line_count == 0:
            print_error("Failed: Temporary file is empty")
            tmp_path.unlink()
            stats.error_files += 1
            print()
            return False

        # Get original file permissions
        original_stat = file_path.stat()

        # Replace original file with trimmed version
        shutil.move(str(tmp_path), str(file_path))

        # Restore permissions
        try:
            os.chmod(file_path, original_stat.st_mode)
        except Exception:
            pass  # Ignore permission errors

        # Get new file size
        new_size = get_file_size(file_path)
        size_saved = original_size - new_size

        # Update statistics
        removed_lines = line_count - new_line_count
        stats.processed_files += 1
        stats.total_lines_removed += removed_lines
        stats.total_size_saved += size_saved

        print_success(f"Trimmed: {line_count} → {new_line_count} lines (removed {removed_lines})")
        print(f"  {Colors.GREEN}Size: {format_size(original_size)} → {format_size(new_size)} "
              f"(saved {format_size(size_saved)}){Colors.RESET}")
        print()
        return True

    except Exception as e:
        print_error(f"Failed to trim file: {e}")
        stats.error_files += 1
        print()
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Trim cursor_*.md files to last N lines if they exceed threshold',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                        # Use defaults (2000 lines)
  %(prog)s --keep 1000            # Keep last 1000 lines
  %(prog)s --min 5000             # Only trim files > 5000 lines
  %(prog)s --root /path/to/dir    # Scan different root directory
  %(prog)s --dry-run              # Show what would be done without actually doing it
        """
    )

    parser.add_argument(
        '--root',
        type=Path,
        default=None,
        help='Root directory to scan (default: core_node directory)'
    )

    parser.add_argument(
        '--keep',
        type=int,
        default=2000,
        help='Number of lines to keep from end (default: 2000)'
    )

    parser.add_argument(
        '--min',
        type=int,
        default=None,
        help='Minimum lines to trigger trimming (default: same as --keep)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without actually trimming files'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show verbose output including skipped directories'
    )

    args = parser.parse_args()

    # Determine root directory
    if args.root:
        root_dir = args.root.resolve()
    else:
        # Find core_node directory
        script_dir = Path(__file__).resolve().parent
        root_dir = script_dir.parent.parent  # Go up to core_node

    if not root_dir.exists():
        print_error(f"Root directory does not exist: {root_dir}")
        sys.exit(1)

    if not root_dir.is_dir():
        print_error(f"Root path is not a directory: {root_dir}")
        sys.exit(1)

    # Set min_lines
    min_lines = args.min if args.min is not None else args.keep

    # Print header
    print_header(f"Trim cursor_*.md files to last {args.keep} lines")

    print_info(f"Root directory: {root_dir}")
    print_info(f"File pattern:   cursor_*.md")
    print_info(f"Keep lines:     {args.keep}")
    print_info(f"Min lines:      {min_lines} (trim only if file > {min_lines} lines)")
    if args.dry_run:
        print_info(f"Mode:           DRY RUN (no files will be modified)")
    print_info(f"Skipping directories: {len(SKIP_DIRS)} patterns")
    print()

    # Find all cursor_*.md files
    print_info("Scanning for cursor_*.md files...")
    cursor_files = find_cursor_files(root_dir)

    if not cursor_files:
        print_warning("No cursor_*.md files found")
        sys.exit(0)

    print_info(f"Found {len(cursor_files)} cursor_*.md file(s)")
    print()

    # Process files
    stats = FileStats()

    for file_path in sorted(cursor_files):
        if args.dry_run:
            # Dry run mode - just show what would be done
            line_count = count_lines(file_path)
            try:
                rel_path = file_path.relative_to(root_dir)
            except ValueError:
                rel_path = file_path

            print(f"{Colors.BLUE}{rel_path}{Colors.RESET}")
            print(f"  Lines: {line_count}")

            if line_count > min_lines:
                removed = line_count - args.keep
                print(f"  {Colors.YELLOW}→ Would trim: {line_count} → {args.keep} (remove {removed} lines){Colors.RESET}")
            else:
                print(f"  {Colors.YELLOW}→ Would skip (≤ {min_lines} lines){Colors.RESET}")
            print()
            stats.total_files += 1
        else:
            # Actually trim files
            trim_file(file_path, args.keep, min_lines, stats)

    # Print summary
    print_header("Summary")
    print(f"Total files found:    {Colors.BLUE}{stats.total_files}{Colors.RESET}")
    print(f"Successfully trimmed: {Colors.GREEN}{stats.processed_files}{Colors.RESET}")
    print(f"Skipped:              {Colors.YELLOW}{stats.skipped_files}{Colors.RESET}")
    print(f"Errors:               {Colors.RED}{stats.error_files}{Colors.RESET}")

    if not args.dry_run and stats.processed_files > 0:
        print(f"Total lines removed:  {Colors.BLUE}{stats.total_lines_removed}{Colors.RESET}")
        print(f"Total size saved:     {Colors.BLUE}{format_size(stats.total_size_saved)}{Colors.RESET}")

    print(f"{Colors.BLUE}{'=' * 60}{Colors.RESET}")

    # Exit code
    if stats.error_files > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
