#!/usr/bin/env python3
"""
Check for remaining QtScrcpy keywords in the project
检查项目中是否还有 QtScrcpy 关键字
"""

import os
import re
from pathlib import Path

# Keywords to search for
KEYWORDS = [
    'QtScrcpy',
    'qtscrcpy',
    'QTSCRCPY',
]

# File extensions to search
EXTENSIONS = [
    '.cmake', '.txt', '.cpp', '.h', '.hpp', '.c', '.cc',
    '.ps1', '.py', '.sh', '.bat',
    '.rc', '.qrc', '.pro', '.pri', '.ui',
    '.md', '.json', '.xml', '.yaml', '.yml',
    '.ts', '.js', '.css', '.html',
]

# Directories to exclude
EXCLUDE_DIRS = [
    'build', 'build_msvc_2022', 'ci/build_temp',
    '.git', '.vs', '.vscode', '__pycache__',
    'output', 'output_*',
    'backup', 'publish_*',
]

def should_check_file(file_path: Path) -> bool:
    """Check if file should be searched"""
    # Check extension
    if file_path.suffix not in EXTENSIONS:
        return False

    # Check if in excluded directory
    path_str = str(file_path)
    for exclude_dir in EXCLUDE_DIRS:
        if exclude_dir in path_str:
            return False

    return True

def check_file(file_path: Path, keywords: list) -> list:
    """Check file for keywords and return matches"""
    matches = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, 1):
                for keyword in keywords:
                    if keyword in line:
                        matches.append({
                            'file': str(file_path),
                            'line': line_num,
                            'keyword': keyword,
                            'content': line.strip()
                        })
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

    return matches

def main():
    project_root = Path(__file__).parent.parent
    print(f"Checking project: {project_root}")
    print(f"Keywords: {', '.join(KEYWORDS)}")
    print("-" * 80)

    all_matches = []

    # Walk through project directory
    for file_path in project_root.rglob('*'):
        if file_path.is_file() and should_check_file(file_path):
            matches = check_file(file_path, KEYWORDS)
            if matches:
                all_matches.extend(matches)

    # Group results by file
    files_with_matches = {}
    for match in all_matches:
        file_path = match['file']
        if file_path not in files_with_matches:
            files_with_matches[file_path] = []
        files_with_matches[file_path].append(match)

    # Print results
    if files_with_matches:
        print(f"\nFound {len(all_matches)} occurrences in {len(files_with_matches)} files:\n")

        for file_path in sorted(files_with_matches.keys()):
            matches = files_with_matches[file_path]
            rel_path = Path(file_path).relative_to(project_root)
            print(f"\n[FILE] {rel_path}")
            print(f"   {len(matches)} occurrences:")

            for match in matches[:5]:  # Show first 5 matches per file
                print(f"   Line {match['line']}: {match['keyword']}")
                print(f"     {match['content'][:100]}")

            if len(matches) > 5:
                print(f"   ... and {len(matches) - 5} more")

        print("\n" + "=" * 80)
        print(f"\nSummary:")
        print(f"  Total occurrences: {len(all_matches)}")
        print(f"  Files affected: {len(files_with_matches)}")
        print("\n" + "=" * 80)
    else:
        print("\n[OK] No occurrences of QtScrcpy keywords found!")
        print("   All files have been successfully renamed.")

if __name__ == '__main__':
    main()
