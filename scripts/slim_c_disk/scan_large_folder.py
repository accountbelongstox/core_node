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
import argparse
from collections import defaultdict

def get_target_directories(root_path, target_depth):
    """Collect all directories at the target depth."""
    target_dirs = []

    def scan(current_path, current_depth):
        try:
            with os.scandir(current_path) as it:
                for entry in it:
                    if entry.is_dir(follow_symlinks=False):
                        if current_depth == target_depth:
                            target_dirs.append(entry.path)
                        else:
                            scan(entry.path, current_depth + 1)
        except:
            pass  # Skip directories with permission issues

    scan(root_path, 1)  # Start scanning from depth 1
    return target_dirs

def calculate_directory_size(dir_path):
    """Calculate the total size of a single directory."""
    total_size = 0
    try:
        for entry in os.scandir(dir_path):
            try:
                if entry.is_file(follow_symlinks=False):
                    total_size += entry.stat(follow_symlinks=False).st_size
                elif entry.is_dir(follow_symlinks=False):
                    total_size += calculate_directory_size(entry.path)
            except:
                continue
    except:
        pass
    return total_size

def format_size(size):
    """Format the size into a human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} PB"

def main():
    parser = argparse.ArgumentParser(description='Scan directory sizes at a specified depth.')
    parser.add_argument('path', nargs='?', default='C:\\', help='The root directory path to scan (default: C:\\)')
    parser.add_argument('-d', '--depth', type=int, default=3,
                        help='The target directory depth (default: 3)')
    parser.add_argument('-n', '--top', type=int, default=100,
                        help='Show the top N largest folders (default: 10)')

    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"Error: Path '{args.path}' does not exist!")
        return

    # 1. Collect all target directories
    print(f"Collecting all directories at depth {args.depth}...")
    target_dirs = get_target_directories(args.path, args.depth)
    print(f"Found {len(target_dirs)} directories to analyze.")

    # 2. Start calculating sizes
    print("\nStarting directory size calculation...")
    dir_sizes = []
    for i, dir_path in enumerate(target_dirs, 1):
        print(f"Processing ({i}/{len(target_dirs)}): {dir_path}")
        size = calculate_directory_size(dir_path)
        dir_sizes.append((dir_path, size))

    # 3. Summarize the results
    print("\nAnalysis complete! Summarizing results...")
    dir_sizes.sort(key=lambda x: x[1], reverse=True)

    print(f"\nTop largest folders (Depth: {args.depth}):")
    print(f"{'Rank':<5} {'Size':<15} Folder Path")
    print("-" * 80)

    for i, (path, size) in enumerate(dir_sizes[:args.top], 1):
        size_str = format_size(size)
        print(f"{i:<5} {size_str:<15} {path}")

if __name__ == '__main__':
    main()