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
import heapq
import sys
from collections import defaultdict
from colorama import Fore, Style, init

init(autoreset=True)

def get_size(path):
    """Get folder size, ignoring inaccessible files"""
    total_size = 0
    for dirpath, _, filenames in os.walk(path, followlinks=False):
        for f in filenames:
            try:
                fp = os.path.join(dirpath, f)
                total_size += os.path.getsize(fp)
            except (OSError, PermissionError):
                continue
    return total_size

def format_size(size):
    """Format size in MB or GB"""
    if size >= 1_073_741_824:  # 1GB
        return f"{size / 1_073_741_824:.2f} GB"
    return f"{size / 1_048_576:.2f} MB"

def scan_drive(root="C:/", max_depth=3, top_n=10):
    """Scan disk and find the largest folders by space usage"""
    folder_sizes = defaultdict(list)
    
    for root_dir, dirs, _ in os.walk(root, topdown=True):
        depth = root_dir.count(os.sep) - root.count(os.sep) + 1
        if depth > max_depth:
            dirs.clear()  # Stop recursion beyond max depth
            continue
        
        print(f"\rScanning: {root_dir}...", end="", flush=True)
        
        for d in dirs:
            folder_path = os.path.join(root_dir, d)
            try:
                size = get_size(folder_path)
                heapq.heappush(folder_sizes[depth], (size, folder_path))
                if len(folder_sizes[depth]) > top_n:
                    heapq.heappop(folder_sizes[depth])
            except (OSError, PermissionError):
                print(f"\r{Fore.RED}Error accessing: {folder_path}{Style.RESET_ALL}")
                continue
        
        print(f"\nTop {top_n} largest folders at level {depth}:")
        for size, path in sorted(folder_sizes[depth], reverse=True):
            print(f"{format_size(size)} - {path}")

if __name__ == "__main__":
    scan_drive()